import { assetCost as cost, assetOverdraw as raster, parseAudio as audio, parseGlb as glb, parseKtx2 as ktx2, type AssetCost as Cost } from '@wildshard/game/shardfile/assets';

/** Actual parsed residency and draw costs, independent of author declarations. */
export type AssetCost = Cost;
/** Decode a JSON-safe authored payload before admission. Call assetCost to validate its kind and charge residency. */
export function assetBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), character => character.codePointAt(0) ?? 0);
}
/** Admit a self-contained GLB and derive its geometry and instance costs. */
export function parseGlb(bytes: Uint8Array): Cost { return glb(bytes); }
/** Admit bounded KTX2 mip ranges and conservative transcode residency. */
export function parseKtx2(bytes: Uint8Array): Cost { return ktx2(bytes); }
/** Admit bounded PCM audio and derive decoded sample residency. */
export function parseAudio(bytes: Uint8Array): Cost { return audio(bytes); }
/** Select the game's shared asset parser for CLI and browser admission. */
export function assetCost(kind: string, bytes: Uint8Array): Cost { return cost(kind, bytes); }
/** Advisory raster layers from actual geometry and material alpha modes, before culling or occlusion. */
export type OverdrawEstimate = ReturnType<typeof raster>;
/** Derive the shared conservative raster estimate without accepting an author-supplied number. */
export function assetOverdraw(kind: string, bytes: Uint8Array): OverdrawEstimate { return raster(kind, bytes); }
