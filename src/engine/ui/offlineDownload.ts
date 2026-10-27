/**
 * G727 / iPhone downloads I9: Settings' "Download everything" for offline play. The engine knows no products: the game
 * installs this port at page start (src/entry.ts) and the save panel (SavePanel.ts) offers it, its size first.
 */
import type { Scope } from '../app/scope';
import { engineString } from '../strings';

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

const megabytes = (bytes: number): string => Math.max(1, Math.round(bytes / 1e6)).toString();
/** G727 / I9: "Download everything" for offline play, its size first, then its progress; again resumes a stopped one */
function offlineRow(scope: Scope, port: OfflineDownload): HTMLElement & { refresh: () => void } {
  const box = document.createElement('div');
  const label = document.createElement('div'); label.className = 'ws-gmenu-label'; label.textContent = engineString('s_offline_title');
  const note = document.createElement('div'); note.className = 'ws-gmenu-note'; note.textContent = engineString('s_offline_note');
  const status = document.createElement('div'); status.className = 'ws-gmenu-note'; status.setAttribute('role', 'status');
  let busy = false;
  const go = document.createElement('button'); go.type = 'button'; go.className = 'ws-gmenu-btn';
  const size = (): void => {
    go.disabled = true; go.textContent = engineString('s_offline_sizing');
    void port.size().then((bytes) => {
      if (busy) return undefined;
      go.textContent = bytes === 0 ? engineString('s_offline_ready') : bytes === null ? engineString('s_offline_unknown') : engineString('s_offline_download', [megabytes(bytes)]);
      go.disabled = bytes === 0; return undefined;
    }).catch(() => { if (!busy) { go.textContent = engineString('s_offline_unknown'); go.disabled = false; } });
  };
  scope.listen(go, 'click', () => {
    if (busy) return;
    busy = true; go.disabled = true;
    void port.start(scope, (done, total) => { status.textContent = engineString('s_offline_progress', [megabytes(done), megabytes(total)]); })
      .then((end) => { status.textContent = end === 'done' ? engineString('s_offline_done') : engineString('s_offline_stopped'); return undefined; })
      .catch(() => { status.textContent = engineString('s_offline_stopped'); })
      .finally(() => { busy = false; size(); });
  });
  size();
  box.append(label, note, go, status);
  return Object.assign(box, { refresh: (): void => { if (!busy) size(); } });
}

/** The "Offline play" row over the installed port (null without one): the pause menu's save panel and the title's boot
 *  settings both show it; `refresh` re-reads the size (an open of the panel). */
export function buildOfflineRow(scope: Scope): (HTMLElement & { refresh: () => void }) | null {
  return installed === null ? null : offlineRow(scope, installed);
}
