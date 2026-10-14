import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { live } from '@wildshard/engine/models/live';
import { GEAR_MODELS } from './models/gear';
import { SIGNAL_MODEL_SPECIMENS } from './data/rigLibrary';
import { DUNE_LIBRARY, preloadDuneMeshes } from './world/meshes';
import { lastBakedWorld, loadBakedWorld } from './world/baked';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [
  ...GEAR_MODELS.slice(0,1).map(model=>live(model)), ...DUNE_LIBRARY.models(SIGNAL_MODEL_SPECIMENS).map(model=>live(model)),
  ...GEAR_MODELS.slice(5).map(model=>live(model)), ...GEAR_MODELS.slice(1,5).map(model=>live(model)),
];
/** The roster once the generated models (C6) and the baked world (SF72: the tower) have loaded, so the Model Explorer shows them. */
export async function roster(): Promise<typeof ROSTER> { await Promise.all([preloadDuneMeshes(), lastBakedWorld() ?? loadBakedWorld()]); return ROSTER; }
