import type { TextureTranscodeSupport } from '@wildshard/format/contentBounds';
import type { ShardContext } from "../plugin/context";
import type { ResidencyAllocator, ResidencyClaim } from '../grid/allocator';
import { assetCost, parseKtx2 } from '@wildshard/format/product';
import { admitScript } from '@wildshard/format/scriptAdmission';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { clientScriptViewCost } from '@wildshard/format/clientScripts';
import { compendiumSketches } from '@wildshard/format/compendiumSketches';

/** Re-read released transport through the verified reader before reserving costs.
 * Reserve only library and commons bytes in the session's one allocator; render rings and the sim registry own their claims. */
export async function leaseClientLibrary(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: { allocator: ResidencyAllocator; scope: Pick<ShardContext['scope'], 'onDispose' | 'disposed'>; owner: string; textures?: TextureTranscodeSupport; read?: (ref: string) => Promise<Uint8Array> }): Promise<void> {
  const files = new Map(source.files.map((file) => [file.hash, file])), closure = new Set<string>();
  const pending = [...source.library];
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined || closure.has(ref)) continue;
    closure.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
  }
  const claims: ResidencyClaim[] = [];
  for (const ref of closure) {
    if (ref.startsWith('commons:')) continue;
    const file = files.get(ref); if (file === undefined) throw new Error('Missing admitted library residency');
    const wire = assets.get(ref) ?? await ports.read?.(ref);
    if (wire === undefined) throw new Error('Missing admitted library residency');
    claims.push({ id: `library:${source.identity.slug}:${ref}`, category: 'library', bytes: file.decoded + (file.kind === 'ktx2' ? parseKtx2(wire, ports.textures).gpu : file.gpu), owner: ports.owner, distance: 0, needed: true });
  }
  for (const hash of source.requires.commons) {
    const bytes = assets.get(`commons:${hash}`) ?? await ports.read?.(`commons:${hash}`); if (bytes === undefined) throw new Error('Missing admitted commons residency');
    const cost = assetCost('commons', bytes);
    claims.push({ id: `commons:${hash}`, category: 'commons', bytes: cost.decoded + cost.gpu, owner: 'platform', distance: 0, needed: true });
  }
  for (const module of new Set(source.clientScripts.bindings.map((binding) => binding.module))) {
    const bytes = assets.get(module) ?? await ports.read?.(module); if (bytes === undefined) throw new Error('Missing admitted client script');
    // Guest memory is per instance, unlike shared immutable library bytes.
    claims.push({ id: `library:${ports.owner}:client-memory:${module}`, category: 'library', bytes: admitScript(bytes).maximumPages * 65536 * 3, owner: ports.owner, distance: 0, needed: true });
  }
  const views = clientScriptViewCost(source.clientScripts);
  if (views.capacity > 0) claims.push({ id: `library:${ports.owner}:client-views`, category: 'library', bytes: views.decoded + views.gpu, owner: ports.owner, distance: 0, needed: true });
  let sketchIndex = 0;
  for (const sketch of compendiumSketches(source.rows, assets).values()) claims.push({ id: `library:${ports.owner}:sketch:${sketchIndex++}`, category: 'library', bytes: sketch.decoded + sketch.gpu, owner: ports.owner, distance: 0, needed: true });
  if (ports.scope.disposed) throw new Error('Library residency owner left during admission');
  const leases: ReturnType<ResidencyAllocator['reserve']>[] = [];
  try {
    for (const claim of claims) {
      const lease = ports.allocator.reserve(claim); if (lease === null) throw new Error('Library residency admission deferred'); leases.push(lease);
    }
  } catch (error) { for (const lease of leases) lease?.release(); throw error; }
  ports.scope.onDispose(() => { for (const lease of leases) lease?.release(); });
}
