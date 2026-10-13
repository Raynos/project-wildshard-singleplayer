import { Scene, type BufferGeometry } from 'three';
import { bake, type BakedScene } from '@wildshard/sdk/bake';
import { signalTerrainSource } from './tiles';
import { signalRocksPiece } from './rocks';
import { signalDressingPiece } from './dressing';
import { signalTowerPiece } from './tower';
import { signalBraziersPiece, signalCaravanPiece, signalWellPiece } from './places';

/** Signal Dunes' static world as one three.js scene: the code-built pieces, each a `BakedPiece` of instanced kinds. */
export function signalDunesScene(shell: BufferGeometry): Scene {
  const scene = new Scene();
  scene.name = 'sunscar-dunes';
  scene.add(signalRocksPiece(), signalDressingPiece(), signalTowerPiece(), signalCaravanPiece(), signalWellPiece(shell), signalBraziersPiece());
  return scene;
}

/**
 * SF80 (`bake(scene, identity)`): Signal's scene and its dune field through the SDK's one bake call: the 80 terrain tiles
 * and critical collider (`data/tiles.json`), each piece's kinds GLB and rows (`data/<piece>.json`), and `scene.json` in
 * `<project>/.wildshard/cache/sunscar-dunes/` when a project root is given. Run by `bake-signal-world.mjs` and
 * `scripts/bake-hybrid-tiles.mjs`.
 */
export const signalDunesBake = (shell: BufferGeometry, project?: string): BakedScene =>
  bake(signalDunesScene(shell), { slug: 'sunscar-dunes', name: 'Signal Dunes' }, { terrain: signalTerrainSource(), ...(project === undefined ? {} : { project }) });
