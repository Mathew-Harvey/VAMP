import { useCallStore } from '@/stores/call.store';
import VideoRoom from './VideoRoom';
import { Button } from '@/components/ui/button';
import { X, Minus, Maximize2, PictureInPicture2, Move, Fullscreen } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';

export default function FloatingCallPanel() {
  const {
    activeWorkOrderId, activeWorkOrderTitle, isPanelOpen,
    isInCall, endCall, closePanel, openPanel, screenshotCallback,
  } = useCallStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  // Arbitrary size via drag resize
  const [panelWidth, setPanelWidth] = useState(480);
  const [panelHeight, setPanelHeight] = useState(400);
  const MIN_W = 300; const MAX_W = 1200; const MIN_H = 250; const MAX_H = 900;

  // Dragging position
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Resizing
  const [resizing, setResizing] = useState<string | null>(null); // 'e', 'w', 's', 'n', 'se', 'sw', 'ne', 'nw'
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });

  // --- Drag handlers ---
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }, [isFullscreen]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  // --- Resize handlers ---
  const onResizeStart = useCallback((edge: string) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: panelWidth, h: panelHeight, px: rect.left, py: rect.top };
    setResizing(edge);
  }, [panelWidth, panelHeight]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      let newW = resizeStart.current.w;
      let newH = resizeStart.current.h;
      let newX = position?.x ?? undefined;
      let newY = position?.y ?? undefined;

      if (resizing.includes('e')) newW = Math.min(MAX_W, Math.max(MIN_W, resizeStart.current.w + dx));
      if (resizing.includes('w')) { newW = Math.min(MAX_W, Math.max(MIN_W, resizeStart.current.w - dx)); if (position) newX = resizeStart.current.px + dx; }
      if (resizing.includes('s')) newH = Math.min(MAX_H, Math.max(MIN_H, resizeStart.current.h + dy));
      if (resizing.includes('n')) { newH = Math.min(MAX_H, Math.max(MIN_H, resizeStart.current.h - dy)); if (position) newY = resizeStart.current.py + dy; }

      setPanelWidth(newW);
      setPanelHeight(newH);
      if (newX !== undefined || newY !== undefined) {
        setPosition({ x: newX ?? position?.x ?? 0, y: newY ?? position?.y ?? 0 });
      }
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, position]);

  // --- PiP ---
  const requestPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
        return;
      }
      const videos = panelRef.current?.querySelectorAll('video:not(.hidden)');
      let target: HTMLVideoElement | null = null;
      if (videos) {
        for (const v of Array.from(videos)) {
          const el = v as HTMLVideoElement;
          if (el.videoWidth > 0 && el.offsetParent !== null) { target = el; break; }
        }
      }
      if (!target) return;
      await target.requestPictureInPicture();
      setPipActive(true);
      target.addEventListener('leavepictureinpicture', () => setPipActive(false), { once: true });
    } catch (err) { console.error('PiP failed:', err); }
  }, []);

  if (!activeWorkOrderId) return null;

  // Minimized bubble
  if (!isPanelOpen || isMinimized) {
    if (!isInCall) return null;
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button onClick={() => { openPanel(); setIsMinimized(false); }}
          className="flex items-center gap-2 rounded-full bg-slate-900 text-white pl-4 pr-3 py-2.5 shadow-2xl border border-slate-700 hover:bg-slate-800 transition-colors">
          <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium">In call</span>
          <span className="text-xs text-slate-400 max-w-[120px] truncate">{activeWorkOrderTitle}</span>
          <Maximize2 className="h-4 w-4 ml-1 text-slate-400" />
        </button>
      </div>
    );
  }

  const posStyle = isFullscreen ? undefined : position
    ? { left: position.x, top: position.y, width: panelWidth, height: panelHeight }
    : { right: 16, bottom: 16, width: panelWidth, height: panelHeight };

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 shadow-2xl overflow-hidden border border-slate-700 flex flex-col ${
        isFullscreen ? 'inset-0 rounded-none' : 'rounded-xl'
      }`}
      style={posStyle as any}
    >
      {/* Resize handles (not in fullscreen) */}
      {!isFullscreen && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize z-10 hover:bg-ocean/30" onMouseDown={onResizeStart('n')} />
          <div className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize z-10 hover:bg-ocean/30" onMouseDown={onResizeStart('s')} />
          <div className="absolute top-0 bottom-0 left-0 w-1.5 cursor-w-resize z-10 hover:bg-ocean/30" onMouseDown={onResizeStart('w')} />
          <div className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize z-10 hover:bg-ocean/30" onMouseDown={onResizeStart('e')} />
          <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-20" onMouseDown={onResizeStart('nw')} />
          <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-20" onMouseDown={onResizeStart('ne')} />
          <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-20" onMouseDown={onResizeStart('sw')} />
          <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-20" onMouseDown={onResizeStart('se')} />
        </>
      )}

      {/* Header bar */}
      <div className={`flex items-center justify-between bg-slate-800 px-3 py-2 select-none shrink-0 ${!isFullscreen ? 'cursor-move' : ''}`}
        onMouseDown={onDragStart}>
        <div className="flex items-center gap-2 min-w-0">
          {!isFullscreen && <Move className="h-3 w-3 text-slate-500 shrink-0" />}
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-sm font-medium text-white truncate">{activeWorkOrderTitle || 'Video Call'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={requestPiP} title="Picture in Picture">
            <PictureInPicture2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"
            onClick={() => { setIsFullscreen(!isFullscreen); setPosition(null); }} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <Fullscreen className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsMinimized(true)} title="Minimize">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={endCall} title="End call">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Video room - fills remaining space */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <VideoRoom
          workOrderId={activeWorkOrderId}
          compact
          onScreenshot={screenshotCallback || undefined}
          screenshotMode={!!screenshotCallback}
        />
      </div>
    </div>
  );
}
