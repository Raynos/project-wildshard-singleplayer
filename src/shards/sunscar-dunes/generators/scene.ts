import { Scene, type BufferGeometry } from 'three';
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
