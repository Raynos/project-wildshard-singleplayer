import type { ShardContext } from '../shard/context';
import type { ResidencyAllocator, ResidencyClaim } from '../grid/allocator';
import { assetCost } from './assets';
import { admitScript } from '@wildshard/engine/script/admission';
import type { Shardfile } from './schema';
import { clientScriptViewCost } from './clientScripts';
import { compendiumSketches } from './sketch';

/** Reserve only library and commons bytes in the session's one allocator; render rings and the sim registry own their claims. */
export function leaseClientLibrary(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: { allocator: ResidencyAllocator; scope: Pick<ShardContext['scope'], 'onDispose'>; owner: string }): void {
  const files = new Map(source.files.map((file) => [file.hash, file])), closure = new Set<string>();
  const pending = [...source.library];
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined || closure.has(ref)) continue;
    closure.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
  }
  const claims: ResidencyClaim[] = [];
  for (const ref of closure) {
    if (ref.startsWith('commons:')) continue;
    const file = files.get(ref); if (file === undefined || !assets.has(ref)) throw new Error('Missing admitted library residency');
    claims.push({ id: `library:${source.identity.slug}:${ref}`, category: 'library', bytes: file.decoded + file.gpu, owner: ports.owner, distance: 0, needed: true });
  }
  for (const hash of source.requires.commons) {
    const bytes = assets.get(`commons:${hash}`); if (bytes === undefined) throw new Error('Missing admitted commons residency');
    const kind = bytes[0] === 171 ? 'ktx2' : bytes[0] === 103 ? 'glb' : bytes[0] === 82 ? 'audio' : 'binary', cost = assetCost(kind, bytes);
    claims.push({ id: `commons:${hash}`, category: 'commons', bytes: cost.decoded + cost.gpu, owner: 'platform', distance: 0, needed: true });
  }
  for (const module of new Set(source.clientScripts.bindings.map((binding) => binding.module))) {
    const bytes = assets.get(module); if (bytes === undefined) throw new Error('Missing admitted client script');
    // Guest memory is per instance, unlike shared immutable library bytes.
    claims.push({ id: `library:${ports.owner}:client-memory:${module}`, category: 'library', bytes: admitScript(bytes).maximumPages * 65536 * 3, owner: ports.owner, distance: 0, needed: true });
  }
  const views = clientScriptViewCost(source.clientScripts);
  if (views.capacity > 0) claims.push({ id: `library:${ports.owner}:client-views`, category: 'library', bytes: views.decoded + views.gpu, owner: ports.owner, distance: 0, needed: true });
  let sketchIndex = 0;
  for (const sketch of compendiumSketches(source.rows, assets).values()) claims.push({ id: `library:${ports.owner}:sketch:${sketchIndex++}`, category: 'library', bytes: sketch.decoded + sketch.gpu, owner: ports.owner, distance: 0, needed: true });
  const leases: ReturnType<ResidencyAllocator['reserve']>[] = [];
  try {
    for (const claim of claims) {
      const lease = ports.allocator.reserve(claim); if (lease === null) throw new Error('Library residency admission deferred'); leases.push(lease);
    }
  } catch (error) { for (const lease of leases) lease?.release(); throw error; }
  ports.scope.onDispose(() => { for (const lease of leases) lease?.release(); });
}
