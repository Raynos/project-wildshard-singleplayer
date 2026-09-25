/**
 * GPU-compressed textures (E157): which file a loader fetches when textures ride as KTX2 instead of images.
 *
 * A JPEG / WebP decodes to RGBA8 on the GPU — 4 bytes a texel, ~5.3 with mips — however small the file was. KTX2 / Basis
 * Universal files (scripts/bake-ktx2.mjs) are transcoded to a format the GPU samples compressed: ASTC 4×4 on the iPhone
 * (1 byte a texel), BC7 / ASTC on desktop, ETC2 for the ETC1S planes (½ byte). Same pictures, a quarter of the memory,
 * no decode on the main thread and no mipmap generation — which is what lets several shards stay resident on a phone.
 *
 * `gpuFile(served)` maps a URL the tier already fetches (after `tierUrl`: the phone's `.phone.webp` / `.phone.glb`) to its
 * KTX2 stand-in (`/assets/gpu/…-<hash8>.ktx2|glb|gltf`, content-addressed), or undefined — no stand-in, or KTX2 is off.
 * Images: the texture loaders ask (src/core/ktx2.ts); models: `tierUrl` itself swaps a .glb / .gltf (src/boot/bytes.ts),
 * so three's loaders, the boot pack and the manifest all see the same file.
 *
 * The switch is the player's (the look is their call): `?tex=ktx2` / `?tex=img` for a page, main menu ▸ Settings ▸
 * Textures for good; 'auto' is TEX_DEFAULT. Only the default's files are in the boot manifest / pack, so the default path
 * never downloads both sets.
 */
import { GPU_FILES } from './gpu.generated';
import { TIER } from '../core/tier';
import { setting } from '../ui/Settings';

/** what 'auto' means (E157: the A/B board progress/…-e157-ktx2-*.jpg decides) */
export const TEX_DEFAULT: 'ktx2' | 'img' = 'img';
const picked = setting('tex');
export const TEX_MODE: 'ktx2' | 'img' = picked === 'auto' ? TEX_DEFAULT : picked;

const MAP: Readonly<Record<string, string>> = TEX_MODE === 'ktx2' ? GPU_FILES[TIER] : {};
let usable = TEX_MODE === 'ktx2';

/** the KTX2 stand-in of a file this tier fetches (a path, after tierUrl), or undefined */
export function gpuFile(served: string): string | undefined {
  return usable ? MAP[served] : undefined;
}

/** this device cannot sample KTX2 after all (no renderer to detect support with): every loader takes the image again */
export function disableGpuFiles(): void { usable = false; }
