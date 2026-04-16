'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getUnsynced,
  markSynced,
  clearSynced,
  type OfflineAction,
} from '@/lib/offline-store';
import apiClient from '@/lib/api-client';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  // On the server, assume online
  return true;
}

export function useOfflineQueue() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Refresh pending count
  const refreshCount = useCallback(() => {
    setPendingCount(getUnsynced().length);
  }, []);

  // Sync all pending actions to the server
  const syncNow = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (syncInProgress.current) return { synced: 0, failed: 0 };
    syncInProgress.current = true;
    setIsSyncing(true);

    const pending = getUnsynced();
    if (pending.length === 0) {
      syncInProgress.current = false;
      setIsSyncing(false);
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    try {
      const { data: response } = await apiClient.post('/attendance/bulk-sync', {
        records: pending.map((a: OfflineAction) => a.payload),
      });

      const result = response.data ?? response;
      // Mark individual actions as synced
      const createdCount = result.created ?? 0;
      if (createdCount > 0 || result.skipped > 0) {
        pending.forEach((a: OfflineAction) => markSynced(a.id));
        synced = pending.length;
        clearSynced();
      } else {
        failed = pending.length;
      }
    } catch {
      // Network or server error — keep actions in queue for retry
      failed = pending.length;
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
      refreshCount();
    }

    return { synced, failed };
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncInProgress.current) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  // Periodically refresh count (in case addOfflineAction is called elsewhere)
  useEffect(() => {
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
    refreshCount,
  };
}
