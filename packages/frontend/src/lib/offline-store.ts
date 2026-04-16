/**
 * Offline action queue backed by localStorage.
 * For production, consider migrating to IndexedDB for better capacity and
 * binary data support, but localStorage is sufficient for small action queues.
 */

export interface OfflineAction {
  id: string;
  type: 'check_in' | 'check_out';
  payload: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

const STORAGE_KEY = 'smart_attendance_offline_queue';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readQueue(): OfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(actions: OfflineAction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    // Storage full — clear synced items and retry
    const unsynced = actions.filter((a) => !a.synced);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unsynced));
  }
}

/** Add a new offline action to the queue. Returns the generated id. */
export function addOfflineAction(
  action: Omit<OfflineAction, 'id' | 'synced'>
): string {
  const queue = readQueue();
  const id = generateId();
  queue.push({ ...action, id, synced: false });
  writeQueue(queue);
  return id;
}

/** Get all actions that have not been synced yet. */
export function getUnsynced(): OfflineAction[] {
  return readQueue().filter((a) => !a.synced);
}

/** Mark a specific action as synced by id. */
export function markSynced(id: string): void {
  const queue = readQueue();
  const idx = queue.findIndex((a) => a.id === id);
  if (idx !== -1) {
    queue[idx].synced = true;
    writeQueue(queue);
  }
}

/** Remove all synced actions from the queue. */
export function clearSynced(): void {
  const queue = readQueue().filter((a) => !a.synced);
  writeQueue(queue);
}
