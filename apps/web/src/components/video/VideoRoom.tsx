import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useCallStore } from '@/stores/call.store';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Camera,
  Monitor, Minimize2, Volume2, VolumeX, Users,
  Loader2,
} from 'lucide-react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function getSocketServerOrigin(): string {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!apiBase) return window.location.origin;
  try {
    return new URL(apiBase).origin;
  } catch {
    return window.location.origin;
  }
}

interface Peer { socketId: string; userId: string; userName: string; connection: RTCPeerConnection; stream?: MediaStream }
interface VideoRoomProps { workOrderId: string; onScreenshot?: (dataUrl: string) => void; screenshotMode?: boolean; compact?: boolean }
type DeviceState = { hasCamera: boolean; hasMic: boolean; checked: boolean };

export default function VideoRoom({ workOrderId, onScreenshot, screenshotMode, compact }: VideoRoomProps) {
  const { accessToken } = useAuthStore();
  const { setInCall, setFocusedPeer: setStoreFocusedPeer, setCaptureFunction } = useCallStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [isJoined, setIsJoined] = useState(false);
  const [roomCount, setRoomCount] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [devices, setDevices] = useState<DeviceState>({ hasCamera: true, hasMic: true, checked: false });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [noCameraPromptScreenShare, setNoCameraPromptScreenShare] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [focusedPeer, setFocusedPeer] = useState<string | null>(null);
  const [audioOutputEnabled, setAudioOutputEnabled] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  // Separate refs for grid and focused local video so both can show simultaneously
  const localGridVideoRef = useRef<HTMLVideoElement>(null);
  const focusedVideoRef = useRef<HTMLVideoElement>(null);
  // Hidden video element for screenshot capture (always has stream, even in PiP)
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { socketRef.current = socket; }, [socket]);

  // Assign local stream to all local video elements whenever it changes
  useEffect(() => {
    if (localStream) {
      if (localGridVideoRef.current) localGridVideoRef.current.srcObject = localStream;
      if (focusedVideoRef.current) focusedVideoRef.current.srcObject = localStream;
      if (captureVideoRef.current) captureVideoRef.current.srcObject = localStream;
    }
  }, [localStream, focusedPeer]);

  useEffect(() => {
    async function detectDevices() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices({ hasCamera: devs.some((d) => d.kind === 'videoinput'), hasMic: devs.some((d) => d.kind === 'audioinput'), checked: true });
      } catch { setDevices({ hasCamera: true, hasMic: true, checked: true }); }
    }
    detectDevices();
  }, []);

  useEffect(() => {
    const s = io(getSocketServerOrigin(), {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });
    setSocket(s);
    s.on('connect', () => s.emit('room:status', { workOrderId }));
    s.on('room:status', ({ count, isActive }: any) => { setRoomCount(count); setIsCallActive(isActive); });
    s.on('room:count', ({ count }: any) => { setRoomCount(count); setIsCallActive(count > 0); });
    return () => { s.disconnect(); };
  }, [workOrderId, accessToken]);

  // Get or create a PeerConnection for a given socket ID
  const ensurePeerConnection = useCallback((socketId: string, userId: string, userName: string): RTCPeerConnection => {
    const existing = peersRef.current.get(socketId);
    if (existing?.connection && existing.connection.signalingState !== 'closed') {
      return existing.connection;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks so remote side can receive our media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }

    // Collect remote tracks into a single stream per peer
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      remoteStream.addTrack(event.track);
      const ex = peersRef.current.get(socketId);
      if (ex) { ex.stream = remoteStream; peersRef.current.set(socketId, { ...ex }); setPeers(new Map(peersRef.current)); }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socketRef.current?.emit('signal:ice-candidate', { targetSocketId: socketId, candidate: event.candidate.toJSON() });
    };

    peersRef.current.set(socketId, { socketId, userId, userName, connection: pc, stream: undefined });
    setPeers(new Map(peersRef.current));
    return pc;
  }, []);

  // Send an offer to a peer
  const sendOffer = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal:offer', { targetSocketId: socketId, offer });
    } catch {
      // Ignore offer creation failures during rapid reconnects.
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // New joiner receives list of existing participants - create peer connections only.
    // Existing participants will initiate offers through peer:joined.
    socket.on('room:state', async ({ participants }: any) => {
      for (const p of participants) {
        ensurePeerConnection(p.socketId, p.userId, p.userName);
      }
    });

    // Existing participant sees new joiner - create connection and send offer
    socket.on('peer:joined', async ({ socketId, userId, userName }: any) => {
      const pc = ensurePeerConnection(socketId, userId, userName);
      await sendOffer(socketId, pc);
    });

    // Receive offer and answer it.
    socket.on('signal:offer', async ({ fromSocketId, userId, userName, offer }: any) => {
      const pc = ensurePeerConnection(fromSocketId, userId, userName);
      try {
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' } as any);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const queued = pendingIceRef.current.get(fromSocketId) || [];
        for (const c of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        pendingIceRef.current.delete(fromSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('signal:answer', { targetSocketId: fromSocketId, answer });
      } catch {
        // Ignore stale offer during reconnect races.
      }
    });

    socket.on('signal:answer', async ({ fromSocketId, answer }: any) => {
      const pc = peersRef.current.get(fromSocketId)?.connection;
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          const queued = pendingIceRef.current.get(fromSocketId) || [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingIceRef.current.delete(fromSocketId);
        } catch {
          // Ignore stale answer during reconnect races.
        }
      }
    });

    socket.on('signal:ice-candidate', async ({ fromSocketId, candidate }: any) => {
      const pc = peersRef.current.get(fromSocketId)?.connection;
      if (!candidate) return;
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        const queued = pendingIceRef.current.get(fromSocketId) || [];
        queued.push(candidate);
        pendingIceRef.current.set(fromSocketId, queued);
      }
    });

    socket.on('peer:left', ({ socketId }: any) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        if (peer.connection) try { peer.connection.close(); } catch {}
        peersRef.current.delete(socketId);
        pendingIceRef.current.delete(socketId);
        setPeers(new Map(peersRef.current));
        setFocusedPeer((current) => (current === socketId ? null : current));
      }
    });

    return () => { socket.off('room:state'); socket.off('peer:joined'); socket.off('signal:offer'); socket.off('signal:answer'); socket.off('signal:ice-candidate'); socket.off('peer:left'); };
  }, [socket, ensurePeerConnection, sendOffer]);

  const joinCall = useCallback(async () => {
    setJoining(true); setJoinError(''); setNoCameraPromptScreenShare(false);
    let stream: MediaStream | null = null;
    const vc: MediaTrackConstraints = { width: { min: 1280, ideal: 1920, max: 2560 }, height: { min: 720, ideal: 1080, max: 1440 }, frameRate: { min: 15, ideal: 30, max: 30 } };
    const ac: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    for (const attempt of [{ video: vc, audio: ac }, { video: vc, audio: false }, { video: false, audio: ac }] as any[]) {
      try { stream = await navigator.mediaDevices.getUserMedia(attempt); break; } catch { continue; }
    }
    if (!stream) { setNoCameraPromptScreenShare(true); setJoining(false); return; }
    const gotV = stream.getVideoTracks().length > 0, gotA = stream.getAudioTracks().length > 0;
    setVideoEnabled(gotV); setAudioEnabled(gotA);
    setLocalStream(stream); localStreamRef.current = stream;
    setIsJoined(true); setInCall(true); setJoining(false);
    socket?.emit('room:join', { workOrderId });
  }, [socket, workOrderId, setInCall]);

  const joinWithScreenShare = useCallback(async () => {
    setJoining(true); setJoinError('');
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      let audioStream: MediaStream | null = null;
      try { audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); } catch {}
      const tracks = [...ss.getTracks()]; if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const combined = new MediaStream(tracks);
      setVideoEnabled(true); setAudioEnabled(!!audioStream); setScreenSharing(true);
      setLocalStream(combined); localStreamRef.current = combined;
      ss.getVideoTracks()[0].onended = () => leaveCall();
      setIsJoined(true); setInCall(true); setJoining(false); setNoCameraPromptScreenShare(false);
      socket?.emit('room:join', { workOrderId });
    } catch { setJoinError('Screen sharing was cancelled.'); setJoining(false); }
  }, [socket, workOrderId, setInCall]);

  const leaveCall = useCallback(() => {
    for (const [, p] of peersRef.current) p.connection.close();
    peersRef.current.clear(); setPeers(new Map());
    pendingIceRef.current.clear();
    localStream?.getTracks().forEach((t) => t.stop()); setLocalStream(null);
    socket?.emit('room:leave', { workOrderId });
    setIsJoined(false); setInCall(false); setFocusedPeer(null); setScreenSharing(false); setPipActive(false);
  }, [socket, localStream, workOrderId, setInCall]);

  const toggleVideo = useCallback(() => { if (localStream) { const t = localStream.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setVideoEnabled(t.enabled); } } }, [localStream]);
  const toggleAudio = useCallback(() => { if (localStream) { const t = localStream.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setAudioEnabled(t.enabled); } } }, [localStream]);

  const replaceOrAddVideoTrack = useCallback(async (track: MediaStreamTrack) => {
    for (const [, p] of peersRef.current) {
      if (!p.connection) continue;
      const sender = p.connection.getSenders().find((x) => x.track?.kind === 'video');
      try {
        if (sender) {
          await sender.replaceTrack(track);
        } else if (localStreamRef.current) {
          p.connection.addTrack(track, localStreamRef.current);
          await sendOffer(p.socketId, p.connection);
        }
      } catch {}
    }
  }, [sendOffer]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const vt = s.getVideoTracks()[0];
        if (vt) await replaceOrAddVideoTrack(vt);
        localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
        localStreamRef.current = s;
        setLocalStream(s);
        setScreenSharing(false);
      } catch {}
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
        const st = ss.getVideoTracks()[0];
        await replaceOrAddVideoTrack(st);
        st.onended = () => toggleScreenShare();
        localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
        const ns = new MediaStream([st, ...(localStreamRef.current?.getAudioTracks() || [])]);
        localStreamRef.current = ns;
        setLocalStream(ns);
        setScreenSharing(true);
      } catch {}
    }
  }, [screenSharing, replaceOrAddVideoTrack]);

  // Capture screenshot from any stream - works in PiP, focused, or unfocused
  const captureFromStream = useCallback((stream: MediaStream) => {
    const tmpVideo = document.createElement('video');
    tmpVideo.srcObject = stream;
    tmpVideo.muted = true;
    tmpVideo.playsInline = true;
    tmpVideo.style.position = 'fixed';
    tmpVideo.style.opacity = '0';
    tmpVideo.style.pointerEvents = 'none';
    document.body.appendChild(tmpVideo);

    const doCapture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = tmpVideo.videoWidth || 1920;
      canvas.height = tmpVideo.videoHeight || 1080;
      canvas.getContext('2d')?.drawImage(tmpVideo, 0, 0);
      onScreenshot?.(canvas.toDataURL('image/jpeg', 0.85));
      tmpVideo.pause();
      tmpVideo.srcObject = null;
      tmpVideo.remove();
    };

    if (tmpVideo.readyState >= 2) {
      requestAnimationFrame(doCapture);
    } else {
      tmpVideo.onloadeddata = () => requestAnimationFrame(doCapture);
    }
    tmpVideo.play().catch(() => {
      // Fallback: capture from hidden ref
      if (captureVideoRef.current?.videoWidth) {
        const c = document.createElement('canvas');
        c.width = captureVideoRef.current.videoWidth;
        c.height = captureVideoRef.current.videoHeight;
        c.getContext('2d')?.drawImage(captureVideoRef.current, 0, 0);
        onScreenshot?.(c.toDataURL('image/jpeg', 0.85));
      }
      tmpVideo.remove();
    });
  }, [onScreenshot]);

  // Screenshot from focused peer, or fall back to local
  const takeScreenshot = useCallback(() => {
    let stream: MediaStream | null | undefined = null;
    if (focusedPeer === 'local') stream = localStreamRef.current;
    else if (focusedPeer) stream = peersRef.current.get(focusedPeer)?.stream;
    // Fallback: if nothing focused, grab local stream (useful in PiP)
    if (!stream) stream = localStreamRef.current;
    if (stream) captureFromStream(stream);
  }, [focusedPeer, captureFromStream]);

  // Screenshot a specific stream by peer socket ID (for PiP mode picker)
  const screenshotPeer = useCallback((peerSocketId: string) => {
    const stream = peersRef.current.get(peerSocketId)?.stream;
    if (stream) captureFromStream(stream);
  }, [captureFromStream]);

  const screenshotLocal = useCallback(() => {
    if (localStreamRef.current) captureFromStream(localStreamRef.current);
  }, [captureFromStream]);

  // Sync focused peer to global store so form buttons can check
  useEffect(() => {
    setStoreFocusedPeer(focusedPeer);
  }, [focusedPeer, setStoreFocusedPeer]);

  // Expose capture function to global store so form can trigger directly
  useEffect(() => {
    if (isJoined) {
      setCaptureFunction(() => {
        // Grab the focused stream
        let stream: MediaStream | null | undefined = null;
        const fp = focusedPeer;
        if (fp === 'local') stream = localStreamRef.current;
        else if (fp) stream = peersRef.current.get(fp)?.stream;
        if (!stream) stream = localStreamRef.current;
        if (!stream) return null;

        // Capture frame from stream
        const tmpVideo = document.createElement('video');
        tmpVideo.srcObject = stream;
        tmpVideo.muted = true;
        tmpVideo.playsInline = true;
        tmpVideo.style.position = 'fixed';
        tmpVideo.style.opacity = '0';
        tmpVideo.style.pointerEvents = 'none';
        document.body.appendChild(tmpVideo);

        const doCapture = () => {
          const canvas = document.createElement('canvas');
          canvas.width = tmpVideo.videoWidth || 1920;
          canvas.height = tmpVideo.videoHeight || 1080;
          canvas.getContext('2d')?.drawImage(tmpVideo, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          tmpVideo.pause(); tmpVideo.srcObject = null; tmpVideo.remove();

          const storeCallback = useCallStore.getState().screenshotCallback;
          if (storeCallback) {
            storeCallback(dataUrl);
          } else {
            onScreenshot?.(dataUrl);
          }
        };

        if (tmpVideo.readyState >= 2) { requestAnimationFrame(doCapture); }
        else { tmpVideo.onloadeddata = () => requestAnimationFrame(doCapture); }
        tmpVideo.play().catch(() => { tmpVideo.remove(); });

        return null;
      });
    } else {
      setCaptureFunction(null);
    }
    return () => setCaptureFunction(null);
  }, [isJoined, focusedPeer, onScreenshot, setCaptureFunction]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      for (const [, p] of peersRef.current) p.connection.close();
      pendingIceRef.current.clear();
    };
  }, []);

  const peerList = Array.from(peers.values());
  const hasNoVideoTrack = localStream ? localStream.getVideoTracks().length === 0 : false;
  const hasNoAudioTrack = localStream ? localStream.getAudioTracks().length === 0 : false;

  // ── Pre-join states ──
  if (noCameraPromptScreenShare && !isJoined) {
    return (
      <div className="rounded-lg border bg-slate-900 p-8 text-center">
        <VideoOff className="mx-auto h-12 w-12 text-amber-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Camera Detected</h3>
        <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">You can still join by sharing your screen.</p>
        {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
        <div className="flex justify-center gap-3">
          <Button onClick={joinWithScreenShare} size="lg" disabled={joining}><Monitor className="mr-2 h-5 w-5" /> Share Screen to Join</Button>
          <Button onClick={() => setNoCameraPromptScreenShare(false)} variant="outline" className="text-white border-white/30">Cancel</Button>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="rounded-lg border bg-slate-900 p-8 text-center">
        <Video className="mx-auto h-12 w-12 text-ocean mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Video Call</h3>
        {isCallActive && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" /><span className="text-green-400 text-sm">Call in progress</span>
            <Badge variant="outline" className="text-white border-white/30"><Users className="h-3 w-3 mr-1" /> {roomCount}</Badge>
          </div>
        )}
        {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
        {!devices.checked ? <Loader2 className="mx-auto h-6 w-6 text-ocean animate-spin" /> : (
          <>
            {!devices.hasCamera && !devices.hasMic && <p className="text-amber-400 text-xs mb-3">No camera or mic detected. You can join with screen share.</p>}
            {!devices.hasCamera && devices.hasMic && <p className="text-amber-400 text-xs mb-3">No camera detected. You'll join audio-only.</p>}
            {devices.hasCamera && !devices.hasMic && <p className="text-amber-400 text-xs mb-3">No mic detected. Mic will be muted.</p>}
            {!isCallActive && <p className="text-slate-400 text-sm mb-4">Start a video call with your team</p>}
            <Button onClick={joinCall} size="lg" disabled={joining} className={isCallActive ? 'bg-green-600 hover:bg-green-700' : ''}>
              {joining ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</> : <><Video className="mr-2 h-5 w-5" /> {isCallActive ? 'Join Call' : 'Start Call'}</>}
            </Button>
          </>
        )}
      </div>
    );
  }

  // ── In call: PiP active → compact UI with screenshot access ──
  if (pipActive) {
    return (
      <div className="rounded-lg border bg-slate-900 overflow-hidden">
        <video ref={captureVideoRef} autoPlay playsInline muted className="hidden" />
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Video className="h-5 w-5 text-ocean" />
            <p className="text-white text-sm font-medium">Picture-in-Picture active</p>
          </div>
          {/* Screenshot buttons for each stream */}
          {screenshotMode && onScreenshot && (
            <div className="space-y-1.5 mb-3">
              <p className="text-slate-400 text-xs">Capture screenshot from:</p>
              <Button onClick={screenshotLocal} className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white" size="sm">
                <Camera className="h-3.5 w-3.5 mr-2 text-ocean" /> Your camera{screenSharing ? ' (Screen)' : ''}
              </Button>
              {peerList.map((peer) => (
                <Button key={peer.socketId} onClick={() => screenshotPeer(peer.socketId)}
                  className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-white" size="sm"
                  disabled={!peer.stream}>
                  <Camera className="h-3.5 w-3.5 mr-2 text-ocean" /> {peer.userName}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 p-3 bg-slate-800">
          <Button variant={audioEnabled ? 'outline' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full h-10 w-10" disabled={hasNoAudioTrack}>
            {audioEnabled && !hasNoAudioTrack ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button variant={videoEnabled ? 'outline' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full h-10 w-10" disabled={hasNoVideoTrack && !screenSharing}>
            {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button variant={screenSharing ? 'default' : 'outline'} size="icon" onClick={toggleScreenShare} className="rounded-full h-10 w-10"><Monitor className="h-4 w-4" /></Button>
          <div className="mx-1" />
          <Button variant="destructive" size="icon" onClick={leaveCall} className="rounded-full h-10 w-10"><PhoneOff className="h-4 w-4" /></Button>
          <span className="ml-2 text-slate-400 text-xs flex items-center gap-1"><Users className="h-3 w-3" /> {roomCount}</span>
        </div>
      </div>
    );
  }

  // ── In call: full UI ──
  return (
    <div className="rounded-lg border bg-slate-900 overflow-hidden">
      {/* Hidden video for screenshot capture (always has local stream, even during PiP) */}
      <video ref={captureVideoRef} autoPlay playsInline muted className="hidden" />

      {/* Focused main video */}
      {focusedPeer && (
        <div className="relative bg-black aspect-video">
          {focusedPeer === 'local' ? (
            <video ref={focusedVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          ) : (
            <PeerVideo peerId={focusedPeer} peers={peers} muted={!audioOutputEnabled} className="w-full h-full object-contain" />
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-sm px-2 py-1 rounded">
            {focusedPeer === 'local' ? 'You' : peers.get(focusedPeer)?.userName}
          </div>
          {screenshotMode && onScreenshot && (
            <Button onClick={takeScreenshot} className="absolute bottom-3 right-3 bg-ocean hover:bg-ocean/80" size="sm">
              <Camera className="mr-2 h-4 w-4" /> Capture Screenshot
            </Button>
          )}
          <button onClick={() => setFocusedPeer(null)} className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded hover:bg-black/80">
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grid */}
      <div className={`grid gap-1 p-1 ${!focusedPeer ? (peerList.length <= 1 ? 'grid-cols-2' : peerList.length <= 3 ? 'grid-cols-2' : 'grid-cols-3') : 'grid-cols-4'}`}>
        <div className={`relative bg-slate-800 rounded overflow-hidden cursor-pointer aspect-video ${focusedPeer === 'local' ? 'ring-2 ring-ocean' : ''}`}
          onClick={() => setFocusedPeer(focusedPeer === 'local' ? null : 'local')}>
          <video ref={localGridVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            You{screenSharing ? ' (Screen)' : ''}{hasNoAudioTrack ? ' (No mic)' : ''}
          </div>
          {(!videoEnabled || hasNoVideoTrack) && !screenSharing && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800"><VideoOff className="h-8 w-8 text-slate-500" /></div>
          )}
        </div>
        {peerList.map((peer) => (
          <div key={peer.socketId}
            className={`relative bg-slate-800 rounded overflow-hidden cursor-pointer aspect-video ${focusedPeer === peer.socketId ? 'ring-2 ring-ocean' : ''}`}
            onClick={() => setFocusedPeer(focusedPeer === peer.socketId ? null : peer.socketId)}>
            {peer.stream ? (
              <PeerVideo peerId={peer.socketId} peers={peers} muted={!audioOutputEnabled} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-ocean/20 flex items-center justify-center text-ocean font-bold text-lg">{peer.userName[0]?.toUpperCase()}</div>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">{peer.userName}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 p-3 bg-slate-800">
        <Button variant={audioEnabled ? 'outline' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full h-10 w-10" disabled={hasNoAudioTrack}>
          {audioEnabled && !hasNoAudioTrack ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button variant={videoEnabled ? 'outline' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full h-10 w-10" disabled={hasNoVideoTrack && !screenSharing}>
          {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button variant={screenSharing ? 'default' : 'outline'} size="icon" onClick={toggleScreenShare} className="rounded-full h-10 w-10" title="Share screen">
          <Monitor className="h-4 w-4" />
        </Button>
        <Button variant={audioOutputEnabled ? 'outline' : 'destructive'} size="icon" onClick={() => setAudioOutputEnabled(!audioOutputEnabled)} className="rounded-full h-10 w-10">
          {audioOutputEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        {screenshotMode && focusedPeer && onScreenshot && (
          <Button onClick={takeScreenshot} className="rounded-full h-10 bg-ocean hover:bg-ocean/80" size="sm"><Camera className="h-4 w-4 mr-1" /> Capture</Button>
        )}
        <div className="mx-1" />
        <Button variant="destructive" size="icon" onClick={leaveCall} className="rounded-full h-10 w-10"><PhoneOff className="h-4 w-4" /></Button>
        <span className="ml-2 text-slate-400 text-xs flex items-center gap-1"><Users className="h-3 w-3" /> {roomCount}</span>
      </div>
    </div>
  );
}

// Separate component for peer video to ensure stream is always assigned correctly
function PeerVideo({ peerId, peers, muted, className }: { peerId: string; peers: Map<string, Peer>; muted: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const peer = peers.get(peerId);

  useEffect(() => {
    if (ref.current && peer?.stream) {
      ref.current.srcObject = peer.stream;
    }
  }, [peer?.stream]);

  return <video ref={ref} id={`peer-video-${peerId}`} autoPlay playsInline muted={muted} className={className} />;
}
