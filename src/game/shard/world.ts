import type { World } from '#engine';
import type { ShardManifest } from './manifest';

/** Game presentation metadata stays beside the generic engine world. */
export interface ShardWorld extends World { chunk: ShardManifest }
