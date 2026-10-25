import type { GridEdgeSource } from './edgeProfiles';

export interface GridSeamAddress { readonly url: string; readonly bytes: number; readonly sha256: string }
interface GridSeamData {
  readonly plans: readonly (readonly [string, readonly number[][]])[];
  readonly edges: readonly (readonly [string, Extract<GridEdgeSource, { kind: 'declared' }>])[];
}
const sides = ['north', 'east', 'south', 'west'] as const;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((item: unknown) => typeof item === 'number' && Number.isFinite(item));
const matrix = (value: unknown): value is number[][] => Array.isArray(value) && value.every(numbers);
function observation(value: unknown): boolean {
  return record(value) && typeof value['entryWidth'] === 'number' && Number.isFinite(value['entryWidth'])
    && (value['geometry'] === undefined || value['geometry'] === 'ground' || value['geometry'] === 'void')
    && (value['waterSurface'] === undefined || typeof value['waterSurface'] === 'number' && Number.isFinite(value['waterSurface']))
    && (value['sourceSurface'] === undefined || typeof value['sourceSurface'] === 'string')
    && (value['outflows'] === undefined || Array.isArray(value['outflows']) && value['outflows'].every((row: unknown) => record(row)
      && typeof row['from'] === 'number' && Number.isFinite(row['from']) && typeof row['to'] === 'number' && Number.isFinite(row['to'])));
}
function edge(value: unknown): value is Extract<GridEdgeSource, { kind: 'declared' }> {
  if (!record(value) || value['kind'] !== 'declared' || !record(value['profiles']) || !record(value['observations'])) return false;
  const profiles = value['profiles'], observations = value['observations'];
  return sides.every(side => {
    const row = profiles[side];
    return record(row) && numbers(row['heights']) && matrix(row['colours']) && typeof row['roadHeight'] === 'number' && observation(observations[side]);
  });
}
function data(value: unknown): value is GridSeamData {
  if (!record(value) || !Array.isArray(value['plans']) || !Array.isArray(value['edges'])) return false;
  const plans = value['plans'], edges = value['edges'];
  return plans.every((row: unknown) => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && matrix(row[1]))
    && edges.every((row: unknown) => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && edge(row[1]));
}

/** No module cache owns the parsed rows. The session consumes them during construction;
 * existing edge and seam certifiers still check every physical profile/lattice. */
export async function readGridSeamData(address: GridSeamAddress, read: (url: string) => Promise<Response>): Promise<GridSeamData> {
  if (!/^\/assets\/grid-seams-[a-f0-9]{8}\.json$/u.test(address.url) || !/^[a-f0-9]{64}$/u.test(address.sha256)
    || !address.url.includes(address.sha256.slice(0, 8)) || !Number.isSafeInteger(address.bytes)
    || address.bytes <= 0 || address.bytes > 16 * 1024 * 1024) throw new Error('Invalid grid seam address');
  const response = await read(address.url);
  if (!response.ok) throw new Error(`Grid seam data ${response.status}`);
  if (response.body === null) throw new Error('Grid seam data body is missing');
  const wire = new Uint8Array(address.bytes), reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      if (part.value.length > wire.length - size) throw new Error('Grid seam data size differs from the build');
      wire.set(part.value, size); size += part.value.length;
    }
    if (size !== wire.length) throw new Error('Grid seam data size differs from the build');
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', wire.buffer));
  if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== address.sha256) throw new Error('Grid seam data differs from the build');
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(wire));
  if (!data(parsed)) throw new Error('Invalid grid seam data');
  return parsed;
}
