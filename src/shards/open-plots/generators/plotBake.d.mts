/** GR9: the plot bake's typed surface for the build program (`plotBake.mjs`). */
import type { ImagePixels } from '@wildshard/sharddev/bake/image';
import type { normalizeWorldGlb } from '@wildshard/sharddev/bake/world';

export interface PlotIdea { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string; readonly layout?: string; readonly scaffold?: boolean; readonly coarseLandmark?: string; readonly pool?: string }
/** The build context's image codecs and world reader (no native codec enters the config bundle). */
export interface PlotBakeTools {
  readonly readImagePixels: (bytes: Uint8Array) => Promise<ImagePixels>;
  readonly writeImagePixels: (image: ImagePixels) => Promise<Uint8Array>;
  readonly normalizeWorldGlb: typeof normalizeWorldGlb;
}
/** One idea's world GLB bytes; every input arrives through `read(path)` (a repo-relative path). */
export function ideaWorld(idea: PlotIdea, read: (path: string) => Uint8Array, tools: PlotBakeTools): Promise<Uint8Array>;
/** The idea rows (`outputs.json`). */
export const ideas: readonly PlotIdea[];
