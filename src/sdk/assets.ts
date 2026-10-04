import { assetCost as cost, parseAudio as audio, parseGlb as glb, parseKtx2 as ktx2, type AssetCost as Cost } from '@wildshard/game/shardfile/assets';

/** Actual parsed residency and draw costs, independent of author declarations. */
export type AssetCost = Cost;
/** Admit a self-contained GLB and derive its geometry and instance costs. */
export function parseGlb(bytes: Uint8Array): Cost { return glb(bytes); }
/** Admit bounded KTX2 mip ranges and conservative transcode residency. */
export function parseKtx2(bytes: Uint8Array): Cost { return ktx2(bytes); }
/** Admit bounded PCM audio and derive decoded sample residency. */
export function parseAudio(bytes: Uint8Array): Cost { return audio(bytes); }
/** Select the game's shared asset parser for CLI and browser admission. */
export function assetCost(kind: string, bytes: Uint8Array): Cost { return cost(kind, bytes); }
