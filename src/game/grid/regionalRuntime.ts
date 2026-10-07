import type { Scope } from '@wildshard/engine/app/scope';
import type { PlayerFrameQueries } from '@wildshard/engine/player/Player';
import type { ShardContext } from '../shard/context';
import type { ShardManifest } from '../shard/manifest';
import type { ShardPlayHost } from '../shard/runtime';
import type { ShardWorld } from '../shard/world';
import type { HybridResident } from '../shardfile/hybrid';
import type { AdmittedProduct } from '../shardfile/product';
import type { GridCell } from './assembly';
import type { ResidencyAllocator } from './allocator';
import type { LiveGridRegion } from './live';
import type { GridLoadout } from './wallet';
import { runtimeAccountedBytes, type RuntimeCost } from './runtimeCost';

function sameMeasurement(a: RuntimeCost, b: RuntimeCost): boolean {
  return (['webContentMB', 'glMB', 'engineBaseMB', 'rev', 'device', 'evidence'] as const).every(key => a[key] === b[key]);
}

/**
 * A transitional region pays for its whole opaque runtime. The first-party manifest and admitted declaration must
 * share the reviewed measurement and its images-first provenance; an empty declarative sim is never its estimate.
 * The caller reserves these bytes through the page's ordinary allocator before constructing the regional shell.
 */
export function regionalRuntimeAccountedBytes(admitted: Pick<AdmittedProduct, 'source'>, manifest: Pick<ShardManifest, 'slug' | 'runtimeCost'>): number {
  const { source } = admitted;
  const { slug: declaredIdentity } = source.identity, { slug: registeredIdentity } = manifest;
  if (declaredIdentity !== registeredIdentity) throw new Error('Regional runtime identity differs from its trusted manifest');
  const declared = source.runtime?.cost, measured = manifest.runtimeCost;
  if (declared === undefined || measured === undefined) throw new Error('Regional runtime requires reviewed whole-runtime measurements');
  const bytes = runtimeAccountedBytes(declared);
  runtimeAccountedBytes(measured);
  if (!sameMeasurement(declared, measured) || (declared.imagesFirst === undefined) !== (measured.imagesFirst === undefined)
    || !sameMeasurement(declared.imagesFirst ?? declared, measured.imagesFirst ?? measured)) throw new Error('Regional runtime measurement differs from its trusted manifest');
  return bytes;
}

/** Existing page services lent to a regional shell; it never constructs another renderer, player or input loop. */
export interface RegionalRuntimePage {
  readonly world: ShardWorld;
  readonly play: ShardPlayHost;
  readonly context: ShardContext;
}

/** Fully admitted immutable content and the one page owner, supplied before any trusted gameplay hook executes. */
export interface RegionalRuntimeRequest {
  readonly cell: GridCell;
  readonly admitted: AdmittedProduct;
  readonly manifest: ShardManifest;
  readonly page: RegionalRuntimePage;
  readonly allocator: ResidencyAllocator;
  readonly scope: Scope;
}

/**
 * The view adapter owns the real region, including critical terrain/colliders and a registry whose additions target
 * its own Physics. Its resident context supplies regional sky/terrain/forest; afterWorld and afterKit finish the shell
 * stages only inside the cell, including the real AnimalManager, equipment, inventory and progress before trusted play.
 * The resident's scope owns disposal in dependency order. A synthetic empty host cannot stand in for this contract.
 */
export interface PreparedRegionalRuntime {
  readonly region: LiveGridRegion;
  readonly queries: PlayerFrameQueries;
  readonly resident: HybridResident;
  readonly loadout: GridLoadout;
  /** Flush authored runtime progress and native continuation; false keeps the traveller in the source frame. */
  readonly checkpoint: () => boolean;
}

/** Trusted composition-root adapter. Module admission precedes this call; world/kit/play remain interior-only. */
export type RegionalRuntimeFactory = (request: RegionalRuntimeRequest) => Promise<PreparedRegionalRuntime>;
