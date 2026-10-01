import { defineModel } from '#engine';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { buildWhipModel } from '../weapons/whipModel';
import { buildTower } from '../world/tower';
import { rayGeometry } from '../species/duneRay';
import { TOWER } from '../layout';
import { STRINGS } from '../strings';

const FILE = 'src/shards/sunscar-dunes/models/gear.ts';
export const whipModel = defineModel({ id: 'sunscar-dunes/bullwhip', name: STRINGS.whip, category: 'gear', pipeline: 'code', file: FILE, defaults: {},
  build: () => { const parts = buildWhipModel(); parts.coil.visible = true; return parts.root; } });
/** The tower on flat ground, centred on the origin. */
export const towerModel = defineModel({ id: 'sunscar-dunes/signal-tower', name: STRINGS.tower, category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: () => { const parts = buildTower(0, () => 0), group = new Group(); parts.root.position.set(-TOWER.x, 0, -TOWER.z); parts.fire.visible = true; group.add(parts.root); return group; } });
export const rayModel = defineModel({ id: 'sunscar-dunes/dune-ray', name: STRINGS.ray, category: 'creatures', pipeline: 'code', file: FILE, defaults: {},
  build: () => new Mesh(rayGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true })) });
