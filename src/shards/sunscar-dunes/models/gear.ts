import { defineModel } from '@wildshard/engine/models/model';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { buildWhipModel } from '../weapons/whipModel';
import { buildTower } from '../world/tower';
import { lastBakedWorld } from '../world/baked';
import { buildBrazier, buildCaravan, buildWell } from '../world/places';
import { skittererGeometry } from '../species/skitterer';
import { striderSpecimen } from '../species/strider';
import { rayGeometry } from '../species/duneRay';
import { matriarchBody } from '../species/matriarch';
import { scoutModelGroup } from '../quest/scout';
import { CARAVAN, TOWER, WELL } from '../data/layout';
import { STRINGS } from '../data/strings';

const FILE = 'src/shards/sunscar-dunes/models/gear.ts';
/** C6: the caravan, the well, the brazier and the strider are Hunyuan3D-2 models (`art/sunscar-dunes/round-7-models/`), each with its code model as the stand-in. */
export const whipModel = defineModel({ id: 'sunscar-dunes/bullwhip', name: STRINGS.whip, category: 'gear', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => { const parts = buildWhipModel(); parts.coil.visible = true; return parts.root; } });
/** The world's own tower from its bake (SF72, `generators/tower.ts`), its deck's ground at the origin. */
export const towerModel = defineModel({ id: 'sunscar-dunes/signal-tower', name: STRINGS.tower, category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: () => {
    const parts = buildTower(lastBakedWorld() ?? new Map()), group = new Group();
    parts.root.position.set(-TOWER.x, TOWER.deck - parts.deckY, -TOWER.z); parts.fire.visible = true; group.add(parts.root); return group;
  } });
export const rayModel = defineModel({ id: 'sunscar-dunes/dune-ray', name: STRINGS.ray, category: 'creatures', pipeline: 'code', file: FILE, defaults: {},
  build: () => new Mesh(rayGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true })) });
const creature = (geometry: ReturnType<typeof rayGeometry>, scale = 1): Mesh => {
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true })); mesh.scale.setScalar(scale); return mesh;
};
/** A world piece rebuilt on flat ground and moved to the origin. */
const centred = (root: Group, x: number, z: number): Group => { const group = new Group(); root.position.x -= x; root.position.z -= z; group.add(root); return group; };
export const caravanModel = defineModel({ id: 'sunscar-dunes/caravan', name: STRINGS.caravan, category: 'props', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => centred(buildCaravan(() => 0).root, CARAVAN.x, CARAVAN.z) });
export const wellModel = defineModel({ id: 'sunscar-dunes/dry-well', name: STRINGS.well, category: 'buildings', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => centred(buildWell(() => 0).root, WELL.x, WELL.z) });
export const brazierModel = defineModel({ id: 'sunscar-dunes/waymark-brazier', name: STRINGS.waymark, category: 'props', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => { const parts = buildBrazier(0, 0, () => 0); parts.fire.visible = true; parts.oil.visible = true; return parts.root; } });
export const skittererModel = defineModel({ id: 'sunscar-dunes/sand-skitterer', name: STRINGS.skitterer, category: 'creatures', pipeline: 'code', file: FILE, defaults: {},
  build: () => creature(skittererGeometry()) });
export const striderModel = defineModel({ id: 'sunscar-dunes/dune-strider', name: STRINGS.strider, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => creature(striderSpecimen()) });
export const matriarchModel = defineModel({ id: 'sunscar-dunes/dune-matriarch', name: STRINGS.matriarch, category: 'creatures', pipeline: ['hunyuan', 'code'], file: FILE, defaults: {},
  build: () => creature(matriarchBody() ?? rayGeometry(), 3.6) });
/** Sefa, the caravan scout who gives the quest (loop 2): the generated figure at her own origin. */
export const scoutModel = defineModel({ id: 'sunscar-dunes/caravan-scout', name: STRINGS.scoutName, category: 'people', pipeline: ['hunyuan'], file: FILE, defaults: {},
  build: () => scoutModelGroup() });
