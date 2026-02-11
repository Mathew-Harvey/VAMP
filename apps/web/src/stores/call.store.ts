import { create } from 'zustand';

interface CallState {
  activeWorkOrderId: string | null;
  activeWorkOrderTitle: string | null;
  isPanelOpen: boolean;
  isInCall: boolean;
  // Focused peer in the video room ('local' or socket ID)
  focusedPeerId: string | null;
  // The capture function provided by VideoRoom
  captureFunction: (() => string | null) | null;
  // Direct screenshot callback for a form entry
  screenshotTargetEntryId: string | null;
  screenshotCallback: ((dataUrl: string) => void) | null;

  startCall: (workOrderId: string, title: string) => void;
  endCall: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setInCall: (inCall: boolean) => void;
  setFocusedPeer: (peerId: string | null) => void;
  setCaptureFunction: (fn: (() => string | null) | null) => void;
  setScreenshotTarget: (entryId: string | null, callback: ((dataUrl: string) => void) | null) => void;
  // Remote call awareness (set by useFormCollaboration when another user starts a call)
  remoteCallActive: boolean;
  remoteCallCount: number;
  remoteCallWorkOrderId: string | null;
  remoteCallWorkOrderTitle: string | null;
  setRemoteCall: (active: boolean, count: number, workOrderId: string | null, title: string | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeWorkOrderId: null,
  activeWorkOrderTitle: null,
  isPanelOpen: false,
  isInCall: false,
  focusedPeerId: null,
  captureFunction: null,
  screenshotTargetEntryId: null,
  screenshotCallback: null,

  startCall: (workOrderId, title) =>
    set({ activeWorkOrderId: workOrderId, activeWorkOrderTitle: title, isPanelOpen: true }),

  endCall: () =>
    set({
      activeWorkOrderId: null, activeWorkOrderTitle: null,
      isPanelOpen: false, isInCall: false,
      focusedPeerId: null, captureFunction: null,
      screenshotTargetEntryId: null, screenshotCallback: null,
    }),

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  setInCall: (isInCall) => set({ isInCall }),
  setFocusedPeer: (peerId) => set({ focusedPeerId: peerId }),
  setCaptureFunction: (fn) => set({ captureFunction: fn }),

  setScreenshotTarget: (entryId, callback) =>
    set({ screenshotTargetEntryId: entryId, screenshotCallback: callback }),

  remoteCallActive: false,
  remoteCallCount: 0,
  remoteCallWorkOrderId: null,
  remoteCallWorkOrderTitle: null,
  setRemoteCall: (active, count, workOrderId, title) =>
    set({ remoteCallActive: active, remoteCallCount: count, remoteCallWorkOrderId: workOrderId, remoteCallWorkOrderTitle: title }),
}));
