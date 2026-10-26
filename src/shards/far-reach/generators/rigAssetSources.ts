import type { EmittedBlobs } from '@wildshard/sdk/blobs';
import { SKY_CREATURES, SKY_CREATURE_RIGS, type SkyCreature } from './fileInventory';

/** Existing two-tier variant policy accepted by the metadata translator. */
export interface SkyRigGpuFiles { readonly phone: Readonly<Record<string, string>>; readonly desktop: Readonly<Record<string, string>> }
/** Existing native rig references plus their admitted tier-selection policy. */
export interface SkyRigAssetSources {
  readonly urls: Readonly<Record<SkyCreature, string>>;
  readonly gpuFiles: SkyRigGpuFiles;
}

/** Translate only admitted rig identities; preserve all unrelated GPU entries and refuse missing variants. */
export function skyRigAssetSources(files: EmittedBlobs['files'], original: SkyRigGpuFiles): SkyRigAssetSources {
  const urls = { 'storm-roc': 'world/rigs/storm-roc.glb', 'sky-goat': 'world/rigs/sky-goat.glb',
    'drift-ray': 'world/rigs/drift-ray.glb', 'gale-wisp': 'world/rigs/gale-wisp.glb' };
  const address = (name: string): string => {
    const matches = files.filter(file => file.name === name), file = matches[0];
    if (matches.length !== 1 || file === undefined || file.kind !== 'glb' || !/^[a-f0-9]{64}$/u.test(file.hash)) {
      throw new Error(`Sky rig mapping needs exactly one admitted GLB: ${name}`);
    }
    if (file.path !== `blobs/glb/${file.hash}.glb`) throw new Error('Sky rig blob path differs from admitted GLB identity');
    return `/shardfiles/far-reach/${file.path}`;
  };
  const targets = new Map<string, string>(SKY_CREATURES.map(creature =>
    [SKY_CREATURE_RIGS[creature], address(urls[creature])]));
  const originalPhone = original.phone[SKY_CREATURE_RIGS['storm-roc']];
  if (originalPhone === undefined) throw new Error('Sky rig mapping needs the original phone variant');
  targets.set(originalPhone, address('world/rigs/storm-roc.phone.glb'));
  if (new Set(targets.values()).size !== 5) throw new Error('Sky rig mapping cannot alias original representations');
  const tier = (rows: Readonly<Record<string, string>>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [source, target] of Object.entries(rows)) {
      if (targets.has(source) && !targets.has(target)) throw new Error('Sky rig variant is not admitted');
      const key = targets.get(source) ?? source;
      if (Object.hasOwn(result, key)) throw new Error('Sky rig mapping has a repeated translated source');
      result[key] = targets.get(target) ?? target;
    }
    return result;
  };
  return { urls, gpuFiles: { phone: tier(original.phone), desktop: tier(original.desktop) } };
}
