/** Build-owned spawn IO, in fetch order. Later streaming is a different set. */
export interface SpawnFile {readonly url: string; readonly bytes: number; readonly hash: string; readonly wireBytes?: number}
export interface SpawnManifest {
  readonly version: 1; readonly shard: string; readonly tier: 'phone' | 'desktop'; readonly flow: 'client' | 'grid';
  readonly files: readonly SpawnFile[]; readonly totalBytes: number; readonly wireBytes?: number;
}
export interface SpawnManifestAddress {readonly url: string; readonly bytes: number; readonly totalBytes: number; readonly files: number; readonly wireBytes?: number}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const size = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const path = (value: unknown): value is string => typeof value === 'string' && /^\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*(?:\?v=[a-f0-9]{8,64})?$/u.test(value)
  && !value.split('/').some(part => part === '.' || part === '..');
/** Decode only the small transport grammar. No hashing or product admission. */
export function readSpawnManifest(input: unknown): SpawnManifest {
  if (!object(input) || input['version'] !== 1 || typeof input['shard'] !== 'string' || !/^[a-z0-9_-]+$/u.test(input['shard'])
    || input['tier'] !== 'phone' && input['tier'] !== 'desktop' || input['flow'] !== 'client' && input['flow'] !== 'grid'
    || !size(input['totalBytes']) || !Array.isArray(input['files']) || input['files'].length > 8192) throw new Error('Invalid spawn manifest');
  const files: SpawnFile[] = [], seen = new Set<string>(); let total = 0, wire = 0;
  for (const file of input['files']) {
    if (!object(file) || !path(file['url']) || !size(file['bytes']) || typeof file['hash'] !== 'string' || !/^[a-f0-9]{64}$/u.test(file['hash'])
      || seen.has(file['url']) || file['wireBytes'] !== undefined && !size(file['wireBytes'])) throw new Error('Invalid spawn file');
    seen.add(file['url']); files.push({url: file['url'], bytes: file['bytes'], hash: file['hash'], ...(file['wireBytes'] === undefined ? {} : {wireBytes: file['wireBytes']})}); total += file['bytes'];
    if (size(file['wireBytes'])) wire += file['wireBytes'];
  }
  if (!Number.isSafeInteger(total) || total !== input['totalBytes']) throw new Error('Spawn manifest total differs');
  if (input['wireBytes'] !== undefined && (!size(input['wireBytes']) || !Number.isSafeInteger(wire) || wire !== input['wireBytes'] || files.some(file => file.wireBytes === undefined))
    || input['wireBytes'] === undefined && files.some(file => file.wireBytes !== undefined)) throw new Error('Spawn manifest wire total differs');
  return {version: 1, shard: input['shard'], tier: input['tier'], flow: input['flow'], files, totalBytes: total, ...(input['wireBytes'] === undefined ? {} : {wireBytes: input['wireBytes']})};
}
export function readSpawnManifestAddress(input: unknown): SpawnManifestAddress {
  if (!object(input) || !path(input['url']) || !size(input['bytes']) || input['bytes'] > 2_000_000
    || !size(input['totalBytes']) || input['wireBytes'] !== undefined && !size(input['wireBytes']) || !size(input['files']) || input['files'] > 8192) throw new Error('Invalid spawn manifest address');
  return {url: input['url'], bytes: input['bytes'], totalBytes: input['totalBytes'], files: input['files'], ...(input['wireBytes'] === undefined ? {} : {wireBytes: input['wireBytes']})};
}
