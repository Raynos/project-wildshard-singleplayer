/**
 * G727 / iPhone downloads I9: Settings' "Download everything" for offline play. The engine knows no products: the game
 * installs this port at page start (src/entry.ts) and the save panel (SavePanel.ts) offers it, its size first.
 */
import type { Scope } from '../app/scope';

/** How a whole download ended: everything stored, the device ran out of space, or it stopped (offline, a newer deploy). */
export type OfflineDownloadEnd = 'done' | 'quota' | 'stopped' | 'error';

export interface OfflineDownload {
  /** the wire bytes still to download for offline play (null: not known, e.g. no content cache) */
  readonly size: () => Promise<number | null>;
  /** download all of it; `progress(done, total)` in wire bytes as it goes; resolves when it ends. `owner` paces it. */
  readonly start: (owner: Scope, progress: (done: number, total: number) => void) => Promise<OfflineDownloadEnd>;
}

let installed: OfflineDownload | null = null;
/** The game's port (one a page); the save panel shows nothing without it. */
export function installOfflineDownload(port: OfflineDownload): void { installed = port; }
/** The installed port, or null. */
export function offlineDownload(): OfflineDownload | null { return installed; }
