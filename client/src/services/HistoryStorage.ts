import type { TransferHistoryEntry } from '../shared/types.js';

const STORAGE_KEY = 'devdrop_transfer_history';
export const MAX_HISTORY_ENTRIES = 50;

export class HistoryStorage {
  public static getHistory(): TransferHistoryEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[HistoryStorage] Failed to read history from localStorage:', e);
      return [];
    }
  }

  public static addEntry(entry: Omit<TransferHistoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): TransferHistoryEntry {
    const newEntry: TransferHistoryEntry = {
      id: entry.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || Date.now(),
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      fileType: entry.fileType,
      direction: entry.direction,
      peerDeviceName: entry.peerDeviceName,
      durationSec: entry.durationSec,
      averageSpeedBytesPerSec: entry.averageSpeedBytesPerSec,
      verified: entry.verified,
      status: entry.status,
    };

    try {
      const current = this.getHistory();
      // Prepend the new entry, limit to MAX_HISTORY_ENTRIES
      const updated = [newEntry, ...current].slice(0, MAX_HISTORY_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[HistoryStorage] Failed to persist history entry:', e);
    }

    return newEntry;
  }

  public static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[HistoryStorage] Failed to clear history:', e);
    }
  }

  public static removeEntry(id: string): void {
    try {
      const current = this.getHistory();
      const filtered = current.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('[HistoryStorage] Failed to remove history entry:', e);
    }
  }
}
