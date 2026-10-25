import { bakeSignalSand, bakeSandFiles } from './sand';
import { bakeSignalSkirt } from './skirt';

/** Original texture and skirt bytes as cache-owned results, without source-file writes. */
export function bakeSignalSandSources(pack: (bytes: Uint8Array) => Uint8Array, zstd: (bytes: Uint8Array) => Uint8Array): ReadonlyMap<string, Uint8Array> {
  const { shadow, trail, grain, meanR, meanGlint } = bakeSignalSand();
  const skirt = bakeSignalSkirt();
  const maps = bakeSandFiles({ shadow, trail, grain }, zstd);
  const files = new Map<string, Uint8Array>();
  files.set('sand/skirt.bin', pack(skirt.bytes));
  for (const [hash, bytes] of maps.bytes) files.set(`assets/${hash}`, bytes);
  const json = (name: string, rows: unknown): void => { files.set(name, new TextEncoder().encode(`${JSON.stringify(rows, null, 2)}\n`)); };
  json('sandMaps.json', maps.rows);
  json('sand.json', { meanR, meanGlint });
  json('skirt.json', skirt.rows);
  return files;
}
