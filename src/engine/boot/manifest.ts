/** The authored level inventory is the sole pack/world file source, for either texture mode. */
import type { BootSpec } from '../level/spec';
import type { ChunkFiles } from './bytes';
import { texMode, type TexMode } from './gpuFiles';
import { TIER } from '../core/tier';

export function chunkFiles(level: { readonly boot?: BootSpec }, tex: TexMode = texMode()): ChunkFiles {
  const sources = level.boot?.sources;
  if (sources === undefined) throw new Error('Level boot has no authored asset sources');
  return sources(TIER, tex);
}
