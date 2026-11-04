import { Scene } from 'three';
import { SKY_IDENTITY, type SkyPiece } from './piece';
import { skyWinchHousePiece } from './winchHouse';
import { skyRoostPiece } from './roost';
import { skyDocksPiece } from './skyDock';
import { skyCrownPiece } from './crown';
import { skyMillPiece } from './mill';
import { skyBookStandPiece } from './bookStand';
import { skyKnollsPiece } from './knoll';
import { skyGeometriesPiece } from './geometries';
import { skyIsletRigPiece } from './isletRig';
import { skyDressingPiece } from './dressing';

/** Each code-built piece: its GLB's name under `public/assets/far-reach/baked/`, its rows file under `data/`, its builder. */
export const SKY_PIECES: readonly { glb: string; rows: string; piece: () => SkyPiece<object> }[] = [
  { glb: 'winch-house', rows: 'winchHouse', piece: skyWinchHousePiece }, { glb: 'roost', rows: 'roost', piece: skyRoostPiece },
  { glb: 'docks', rows: 'docks', piece: skyDocksPiece }, { glb: 'crown', rows: 'crown', piece: skyCrownPiece },
  { glb: 'mill', rows: 'mill', piece: skyMillPiece }, { glb: 'book-stand', rows: 'bookStand', piece: skyBookStandPiece },
  { glb: 'knolls', rows: 'knolls', piece: skyKnollsPiece }, { glb: 'geometries', rows: 'geometries', piece: skyGeometriesPiece },
  { glb: 'islet-rig', rows: 'isletRig', piece: skyIsletRigPiece }, { glb: 'dressing', rows: 'dressing', piece: skyDressingPiece },
];

/** Sky Reach's code-built world pieces as one three.js scene, each a `BakedPiece` of instanced kinds, in `SKY_PIECES` order. */
export function skyReachScene(): Scene {
  const scene = new Scene();
  scene.name = SKY_IDENTITY.slug;
  for (const { piece } of SKY_PIECES) scene.add(piece());
  return scene;
}
