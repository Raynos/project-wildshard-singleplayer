import type {GridMode} from './catalogue';

export interface GridEntryDownload { readonly url: string; readonly bytes: number }

/** Compiler facts only. Callers may declare these exact bytes without
 * starting a fetch; original runtime admission still verifies every body. */
export function gridStripDownloadRows(mode: GridMode, home: string): readonly GridEntryDownload[] {
  const text = document.getElementById('boot-module-files')?.textContent;
  if (!text) return [];
  try {
    const input: unknown = JSON.parse(text), key = `${Number(mode.developer)}${Number(mode.devserver)}${Number(mode.nineDragon)}`;
    const bank: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, 'gridEntryDownloads') : undefined;
    const modes: unknown = typeof bank === 'object' && bank !== null ? Reflect.get(bank, key) : undefined;
    const rows: unknown = typeof modes === 'object' && modes !== null ? Reflect.get(modes, home) : undefined;
    if (!Array.isArray(rows) || rows.length !== 3) return [];
    const result: GridEntryDownload[] = [];
    for (const row of rows as unknown[]) {
      if (typeof row !== 'object' || row === null) return [];
      const url: unknown = Reflect.get(row, 'url'), bytes: unknown = Reflect.get(row, 'bytes');
      if (typeof url !== 'string' || !/^\/assets\/grid-strip-(?:(?:book|page)-[a-f0-9]{8}\.json|mesh-[a-f0-9]{8}\.bin)$/u.test(url)
        || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 16 * 1024 * 1024) return [];
      result.push({url, bytes});
    }
    return result;
  } catch { return []; }
}

/** Let the existing HTTP/worker URL cache finish the exact selected seam
 * page across fresh-document travel. Runtime still checks every original
 * byte, full hash, placement and collider declaration before consuming it. */
export function startGridStripDownload(mode: GridMode, home: string): void {
    for (const {url, bytes} of gridStripDownloadRows(mode, home)) {
      const consume = async (response: Response): Promise<void> => {
        if (response.body === null) return;
        const reader = response.body.getReader(); let total = 0;
        try { for (;;) {
          const part = await reader.read(); if (part.done) break;
          total += part.value.length; if (total > bytes) { await reader.cancel(); break; }
        } } finally { reader.releaseLock(); }
      };
      void fetch(url, {keepalive: true, priority: 'low'}).then(consume).catch(() => undefined);
    }
}
