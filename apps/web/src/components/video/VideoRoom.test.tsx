import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoRoom from './VideoRoom';

type Handler = (payload?: any) => void;

class FakeSocket {
  id = 'local-socket';
  handlers = new Map<string, Handler[]>();
  emitted: Array<{ event: string; payload: any }> = [];

  on(event: string, cb: Handler) {
    const existing = this.handlers.get(event) || [];
    existing.push(cb);
    this.handlers.set(event, existing);
    return this;
  }

  off(event: string) {
    this.handlers.delete(event);
    return this;
  }

  emit(event: string, payload?: any) {
    this.emitted.push({ event, payload });
    return this;
  }

  disconnect() {
    return this;
  }

  trigger(event: string, payload?: any) {
    const listeners = this.handlers.get(event) || [];
    listeners.forEach((cb) => cb(payload));
  }
}

class FakeTrack {
  kind: 'audio' | 'video';
  enabled = true;
  constructor(kind: 'audio' | 'video') {
    this.kind = kind;
  }
  stop() {}
}

class FakeMediaStream {
  tracks: FakeTrack[];
  constructor(tracks: FakeTrack[] = [new FakeTrack('video'), new FakeTrack('audio')]) {
    this.tracks = tracks;
  }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  addTrack(track: FakeTrack) { this.tracks.push(track); }
}

class FakeRTCPeerConnection {
  static instances: FakeRTCPeerConnection[] = [];
  signalingState: RTCPeerConnectionState | RTCSignalingState = 'stable';
  localDescription: any = null;
  remoteDescription: any = null;
  ontrack: ((event: any) => void) | null = null;
  onicecandidate: ((event: any) => void) | null = null;
  private senders: Array<{ track: any; replaceTrack: ReturnType<typeof vi.fn> }> = [];
  addIceCandidate = vi.fn(async (_candidate: any) => undefined);

  constructor() {
    FakeRTCPeerConnection.instances.push(this);
  }

  addTrack(track: any) {
    this.senders.push({ track, replaceTrack: vi.fn(async () => undefined) });
    return {};
  }

  getSenders() {
    return this.senders;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'fake-offer' };
  }

  async setLocalDescription(desc: any) {
    this.localDescription = desc;
    if (desc?.type === 'offer') this.signalingState = 'have-local-offer';
    if (desc?.type === 'rollback' || desc?.type === 'answer') this.signalingState = 'stable';
  }

  async setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
    if (desc?.type === 'offer') this.signalingState = 'have-remote-offer';
    if (desc?.type === 'answer') this.signalingState = 'stable';
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'fake-answer' };
  }

  close() {
    this.signalingState = 'closed' as any;
  }
}

const fakeSocket = new FakeSocket();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ accessToken: 'fake-token' }),
}));

vi.mock('@/stores/call.store', () => ({
  useCallStore: () => ({
    setInCall: vi.fn(),
    setFocusedPeer: vi.fn(),
    setCaptureFunction: vi.fn(),
  }),
}));

describe('VideoRoom signaling', () => {
  beforeEach(() => {
    fakeSocket.handlers.clear();
    fakeSocket.emitted = [];
    FakeRTCPeerConnection.instances = [];

    (globalThis as any).MediaStream = FakeMediaStream;
    (globalThis as any).RTCPeerConnection = FakeRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = function (value: any) { return value; };
    (globalThis as any).RTCIceCandidate = function (value: any) { return value; };

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => [{ kind: 'videoinput' }, { kind: 'audioinput' }]),
        getUserMedia: vi.fn(async () => new FakeMediaStream()),
        getDisplayMedia: vi.fn(async () => new FakeMediaStream([new FakeTrack('video')])),
      },
    });
  });

  it('emits offer on peer join and flushes queued ICE after receiving offer', async () => {
    render(<VideoRoom workOrderId="wo-1" />);

    await userEvent.click(await screen.findByRole('button', { name: /start call/i }));

    await waitFor(() => {
      expect(fakeSocket.emitted.some((e) => e.event === 'room:join')).toBe(true);
    });

    await act(async () => {
      fakeSocket.trigger('peer:joined', { socketId: 'remote-1', userId: 'u2', userName: 'Remote' });
    });

    await waitFor(() => {
      expect(
        fakeSocket.emitted.some((e) => e.event === 'signal:offer' && e.payload?.targetSocketId === 'remote-1'),
      ).toBe(true);
    });

    const candidate = { candidate: 'candidate-1', sdpMid: '0', sdpMLineIndex: 0 };
    await act(async () => {
      fakeSocket.trigger('signal:ice-candidate', { fromSocketId: 'remote-1', candidate });
      fakeSocket.trigger('signal:offer', {
        fromSocketId: 'remote-1',
        userId: 'u2',
        userName: 'Remote',
        offer: { type: 'offer', sdp: 'remote-offer' },
      });
    });

    await waitFor(() => {
      expect(
        fakeSocket.emitted.some((e) => e.event === 'signal:answer' && e.payload?.targetSocketId === 'remote-1'),
      ).toBe(true);
    });

    const remotePc = FakeRTCPeerConnection.instances[0];
    expect(remotePc).toBeTruthy();
    expect(remotePc.addIceCandidate).toHaveBeenCalled();
  });
});

