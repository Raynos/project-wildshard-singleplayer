import { parseKtx2 } from '@wildshard/sdk/assets';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { bakeSandFiles } from './sand';

/** Verified existing texture rows and the original zero-mean grain constants. */
export interface SignalSandMetadata {
  readonly maps: ReturnType<typeof bakeSandFiles>['rows'];
  readonly means: { readonly meanR: number; readonly meanGlint: number };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function document(files: ReadonlyMap<string, Uint8Array>, name: string): unknown {
  const bytes = files.get(name);
  if (bytes === undefined || bytes.length === 0 || bytes.length > 4096) throw new Error('Missing or oversized sand metadata');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
/** Recompute costs and hashes from owned KTX2 bytes; cached declarations cannot understate them. */
export function signalSandMetadata(files: ReadonlyMap<string, Uint8Array>): SignalSandMetadata {
  const means = document(files, 'sand.json'), maps = document(files, 'sandMaps.json');
  if (!record(means) || Object.keys(means).sort().join(',') !== 'meanGlint,meanR'
    || typeof means['meanR'] !== 'number' || !Number.isFinite(means['meanR']) || means['meanR'] < 0 || means['meanR'] > 1
    || typeof means['meanGlint'] !== 'number' || !Number.isFinite(means['meanGlint']) || Math.abs(means['meanGlint']) > 1
    || !record(maps) || Object.keys(maps).sort().join(',') !== 'grain,shadow,trail') throw new Error('Invalid sand metadata');
  const hashes = new Set<string>();
  const file = (name: 'grain' | 'trail' | 'shadow'): SignalSandMetadata['maps']['grain'] => {
    const row = maps[name];
    if (!record(row) || typeof row['hash'] !== 'string' || !/^[a-f0-9]{64}$/u.test(row['hash'])) throw new Error('Invalid sand map reference');
    const hash = row['hash'], bytes = files.get(`assets/${hash}`);
    if (bytes === undefined || hashes.has(hash) || hashImmutableBytes(bytes) !== hash) throw new Error('Sand map bytes differ');
    const expected = { hash, kind: 'ktx2' as const, compressed: bytes.length, ...parseKtx2(bytes), dependencies: [], critical: false as const };
    if (encodeCanonicalJson(row) !== encodeCanonicalJson(expected)) throw new Error('Sand map costs differ');
    hashes.add(hash); return expected;
  };
  return { means: { meanR: means['meanR'], meanGlint: means['meanGlint'] },
    maps: { grain: file('grain'), trail: file('trail'), shadow: file('shadow') } };
}
