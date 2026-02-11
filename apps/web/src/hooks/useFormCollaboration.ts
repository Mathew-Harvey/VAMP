import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

interface FieldLock {
  entryId: string;
  field: string;
  userId: string;
  userName: string;
}

export interface FormCollaboration {
  connected: boolean;
  callActive: boolean;
  callParticipantCount: number;
  // Field-level locks: "entryId:field" -> FieldLock
  locks: Map<string, FieldLock>;
  isFieldLockedByOther: (entryId: string, field: string) => boolean;
  getFieldLocker: (entryId: string, field: string) => FieldLock | null;
  lockField: (entryId: string, field: string) => void;
  unlockField: (entryId: string, field: string) => void;
  // Live data sync
  liveData: Map<string, Record<string, any>>;
  getLiveValue: (entryId: string, field: string, defaultValue: any) => any;
  updateField: (entryId: string, field: string, value: any) => void;
  // Screenshots
  addScreenshot: (entryId: string, dataUrl: string) => void;
  removeScreenshot: (entryId: string, index: number) => void;
  liveAttachments: Map<string, string>;
  // Mark complete
  completeEntry: (entryId: string) => void;
  liveStatuses: Map<string, string>;
}

export function useFormCollaboration(workOrderId: string): FormCollaboration {
  const { accessToken, user } = useAuthStore();
  const [connected, setConnected] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callParticipantCount, setCallParticipantCount] = useState(0);
  const [locks, setLocks] = useState<Map<string, FieldLock>>(new Map());
  const [liveData, setLiveData] = useState<Map<string, Record<string, any>>>(new Map());
  const [liveAttachments, setLiveAttachments] = useState<Map<string, string>>(new Map());
  const [liveStatuses, setLiveStatuses] = useState<Map<string, string>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const s = io(window.location.origin, {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
      s.emit('form:join', { workOrderId });
      s.emit('room:status', { workOrderId });
    });
    s.on('disconnect', () => setConnected(false));

    // Video call status
    s.on('room:status', ({ count, isActive }: any) => { setCallActive(isActive); setCallParticipantCount(count); });
    s.on('room:count', ({ count }: any) => { setCallActive(count > 0); setCallParticipantCount(count); });

    // Field lock events
    s.on('form:lock-state', ({ locks: lockList }: { locks: FieldLock[] }) => {
      const m = new Map<string, FieldLock>();
      for (const l of lockList) m.set(`${l.entryId}:${l.field}`, l);
      setLocks(m);
    });

    s.on('form:locked', ({ entryId, field, userId, userName }: any) => {
      setLocks((prev) => { const next = new Map(prev); next.set(`${entryId}:${field}`, { entryId, field, userId, userName }); return next; });
    });

    s.on('form:unlocked', ({ entryId, field }: any) => {
      setLocks((prev) => { const next = new Map(prev); next.delete(`${entryId}:${field}`); return next; });
    });

    s.on('form:lock-denied', ({ entryId, field, lockedBy }: any) => {
      setLocks((prev) => { const next = new Map(prev); next.set(`${entryId}:${field}`, { entryId, field, userId: lockedBy.userId, userName: lockedBy.userName }); return next; });
    });

    // Live field updates
    s.on('form:updated', ({ entryId, field, value }: any) => {
      setLiveData((prev) => { const next = new Map(prev); const e = next.get(entryId) || {}; next.set(entryId, { ...e, [field]: value }); return next; });
    });

    // Screenshot events
    s.on('form:screenshot-added', ({ entryId, attachments }: any) => {
      setLiveAttachments((prev) => { const next = new Map(prev); next.set(entryId, attachments); return next; });
    });
    s.on('form:screenshot-removed', ({ entryId, attachments }: any) => {
      setLiveAttachments((prev) => { const next = new Map(prev); next.set(entryId, attachments); return next; });
    });

    // Completion
    s.on('form:completed', ({ entryId }: any) => {
      setLiveStatuses((prev) => { const next = new Map(prev); next.set(entryId, 'COMPLETED'); return next; });
      // Remove all locks for this entry
      setLocks((prev) => {
        const next = new Map(prev);
        for (const key of prev.keys()) { if (key.startsWith(`${entryId}:`)) next.delete(key); }
        return next;
      });
    });

    return () => {
      for (const [, timer] of debounceTimers.current) clearTimeout(timer);
      debounceTimers.current.clear();
      s.emit('form:leave', { workOrderId });
      s.disconnect();
      socketRef.current = null;
    };
  }, [workOrderId, accessToken]);

  const isFieldLockedByOther = useCallback((entryId: string, field: string) => {
    const lock = locks.get(`${entryId}:${field}`);
    return !!lock && lock.userId !== user?.id;
  }, [locks, user?.id]);

  const getFieldLocker = useCallback((entryId: string, field: string) => {
    return locks.get(`${entryId}:${field}`) || null;
  }, [locks]);

  const lockField = useCallback((entryId: string, field: string) => {
    socketRef.current?.emit('form:lock', { workOrderId, entryId, field });
  }, [workOrderId]);

  const unlockField = useCallback((entryId: string, field: string) => {
    socketRef.current?.emit('form:unlock', { workOrderId, entryId, field });
  }, [workOrderId]);

  const getLiveValue = useCallback((entryId: string, field: string, defaultValue: any) => {
    const entryData = liveData.get(entryId);
    if (entryData && field in entryData) return entryData[field];
    return defaultValue;
  }, [liveData]);

  // Debounced field update
  const updateField = useCallback((entryId: string, field: string, value: any) => {
    const key = `${entryId}:${field}`;
    setLiveData((prev) => { const next = new Map(prev); const e = next.get(entryId) || {}; next.set(entryId, { ...e, [field]: value }); return next; });
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(key, setTimeout(() => {
      socketRef.current?.emit('form:update', { workOrderId, entryId, field, value });
      debounceTimers.current.delete(key);
    }, 300));
  }, [workOrderId]);

  const addScreenshot = useCallback((entryId: string, dataUrl: string) => {
    socketRef.current?.emit('form:screenshot', { workOrderId, entryId, dataUrl });
  }, [workOrderId]);

  const removeScreenshot = useCallback((entryId: string, index: number) => {
    socketRef.current?.emit('form:screenshot-remove', { workOrderId, entryId, index });
  }, [workOrderId]);

  const completeEntry = useCallback((entryId: string) => {
    socketRef.current?.emit('form:complete', { workOrderId, entryId });
  }, [workOrderId]);

  return {
    connected, callActive, callParticipantCount,
    locks, isFieldLockedByOther, getFieldLocker, lockField, unlockField,
    liveData, getLiveValue, updateField,
    addScreenshot, removeScreenshot, liveAttachments,
    completeEntry, liveStatuses,
  };
}
