import type { ShardManifest } from '../shard/manifest';
import { bootPageMode, pageGridInstance, type PageMode } from './boot';
import { gridMemoryAdmissionOn } from './debug';
import { PageResidency } from './pageResidency';
import { runtimeAccountedBytes } from './runtimeCost';

/** The composition root passes this selection to hydration and startSession; its grid intent has already been consumed. */
export interface PageResidencyBoot {
  readonly mode: PageMode;
  readonly instance: string | null;
  readonly residency?: PageResidency;
}

/**
 * G144's default-off boot seam. Call before descriptor hydration and any world construction. Opaque homes must supply
 * reviewed measurements here, since their hybrid data hook runs after bootstrap. Data homes are admitted by the loader
 * against their declared sim cost, then their actual library and tile claims. The root disposes failed hydration; the
 * successful session installs the owner's level lifetime. Row OFF preserves the existing late page-mode selection.
 */
export function preparePageResidency(manifest: Pick<ShardManifest, 'slug' | 'shardfile' | 'runtimeCost'>, configuredSlug?: string): PageResidencyBoot | undefined {
  if (!gridMemoryAdmissionOn()) return undefined;
  const mode = bootPageMode(configuredSlug ?? manifest.slug);
  if (mode !== 'grid') return { mode, instance: null };
  const instance = pageGridInstance();
  if (instance === null) throw new Error('Grid residency requires the consumed home instance');
  const residency = new PageResidency();
  try {
    if (configuredSlug === undefined && manifest.shardfile === undefined) {
      if (manifest.runtimeCost === undefined) throw new Error('Grid runtime home requires reviewed memory measurements before bootstrap');
      residency.admitHome(instance, runtimeAccountedBytes(manifest.runtimeCost));
    }
    return { mode, instance, residency };
  } catch (error) { residency.dispose(); throw error; }
}

