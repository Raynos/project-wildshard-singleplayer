import type { bakeColourTexture } from '@wildshard/sdk/bake/texture';

/** Offline library catalogue writer; the explicit entry supplies its shared pixel encoder. */
export declare function bakeTextureLibrary(root: string, input: string, options: { encoder: typeof bakeColourTexture; encode: boolean; check: boolean }): Promise<void>;
