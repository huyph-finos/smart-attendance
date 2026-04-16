'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getUnsynced,
  markSynced,
  clearSynced,
  type OfflineAction,
} from '@/lib/offline-store';

const API_BULK_SYNC = '/api/attendance/bulk-sync';

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
      const response = await fetch(API_BULK_SYNC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: pending }),
      });

      if (response.ok) {
        const result = await response.json();
        // Mark individual actions as synced based on server response
        const syncedIds: string[] = result.syncedIds ?? pending.map((a: OfflineAction) => a.id);
        syncedIds.forEach((id: string) => markSynced(id));
        synced = syncedIds.length;
        failed = pending.length - synced;
        clearSynced();
      } else {
        // Server error — keep actions in queue for retry
        failed = pending.length;
      }
    } catch {
      // Network error — keep actions in queue
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
