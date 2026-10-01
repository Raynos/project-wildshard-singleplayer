import { defineModel } from '#engine';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { WhipModel } from '../weapons/whipModel';
import { buildTower } from '../world/tower';
import { rayBody, rayTail } from '../species/duneRay';
import { STRINGS } from '../strings';

const FILE = 'src/shards/sunscar-dunes/models/gear.ts';
export const whipModel = defineModel({ id: 'sunscar-dunes/whip', name: STRINGS.whipModel, category: 'gear', pipeline: 'code', file: FILE, defaults: {},
  build: () => { const model = new WhipModel(); model.pose(0, 0); return model.root; } });
export const towerModel = defineModel({ id: 'sunscar-dunes/tower', name: STRINGS.towerModel, category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: () => { const built = buildTower(); built.fire.visible = true; built.light.intensity = 0; return built.tower; } });
export const rayModel = defineModel({ id: 'sunscar-dunes/duneRay', name: STRINGS.rayModel, category: 'creatures', pipeline: 'code', file: FILE, defaults: {},
  build: () => { const group = new Group(), skin = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }); group.add(new Mesh(rayBody(), skin), new Mesh(rayTail(), skin)); return group; } });
