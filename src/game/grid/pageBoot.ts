import type { ShardManifest } from '../shard/manifest';
import { bootPageMode, pageGridInstance, type PageMode } from './boot';
import { PageResidency } from './pageResidency';
import { pageGridRecovery } from './recoveryBoot';
import type { GridRecoveryRecord } from './recovery';
import { runtimeAccountedBytes } from './runtimeCost';
import { ResidencyAllocator } from './allocator';
import { MemoryAdmission } from './memoryAdmission';
import { isDev } from '@wildshard/engine/core/devMode';
import { contentCost } from '@wildshard/engine/core/contentCost';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
/** The composition root passes this selection to hydration and startSession; its grid intent has already been consumed. */
export interface PageResidencyBoot {
  readonly mode: PageMode;
  readonly instance: string | null;
  readonly residency?: PageResidency;
  /** G216: one trusted page policy also reaches data-only SHARD SELECT validation and its warning surface. */
  readonly memory: MemoryAdmission;
  /** Validated recovery uses the ordinary owner, then returns to the road. */
  readonly recovery?: NonNullable<GridRecoveryRecord>;
}

/**
 * G144's single grid boot seam. Call before descriptor hydration and any world construction. Opaque homes must supply
 * reviewed measurements here, since their hybrid data hook runs after bootstrap. Data homes are admitted by the loader
 * against their declared sim cost, then their actual library and tile claims. The root disposes failed hydration; the
 * successful session installs the owner's level lifetime.
 */
export function preparePageResidency(manifest: Pick<ShardManifest, 'slug' | 'shardfile' | 'runtimeCost'>, configuredSlug?: string, memory = new MemoryAdmission(isDev)): PageResidencyBoot {
  const mode = bootPageMode(configuredSlug ?? manifest.slug);
  const measuredHome = configuredSlug === undefined && manifest.shardfile === undefined;
  if (mode !== 'grid' && (!measuredHome || manifest.runtimeCost === undefined)) return { mode, instance: null, memory };
  const instance = mode === 'grid' ? pageGridInstance() : manifest.slug;
  if (instance === null) throw new Error('Grid residency requires the consumed home instance');
  const residency = new PageResidency(new ResidencyAllocator({ memory }));
  try {
    if (measuredHome) {
      if (manifest.runtimeCost === undefined) throw new Error('Grid runtime home requires reviewed memory measurements before bootstrap');
      const bytes = runtimeAccountedBytes(manifest.runtimeCost), row = manifest.runtimeCost;
      const cost = contentCost({ l0: 0, l1: 0, far: 0, libraries: 0, sims: bytes, commons: 0, overlap: CONTENT_CAPS.overlap });
      if (!memory.accept({ stage: 'runtime', owner: instance, id: `sim:${instance}`, claimedBytes: bytes,
        accountedBytes: cost.accounted, playingBytes: cost.playing, loadingBytes: cost.loading,
        measured: { webContentBytes: Math.ceil(row.webContentMB * 1_000_000), glBytes: Math.ceil(row.glMB * 1_000_000), engineBaseBytes: Math.ceil(row.engineBaseMB * 1_000_000),
          rev: row.rev, device: row.device, evidence: row.evidence } })) throw new Error('Home residency admission deferred by the shared budget');
      residency.admitHome(instance, bytes, true);
    }
    const recovery = mode === 'grid' ? pageGridRecovery() : null;
    return { mode, instance, residency, memory, ...(recovery === null ? {} : { recovery }) };
  } catch (error) { residency.dispose(); throw error; }
}
