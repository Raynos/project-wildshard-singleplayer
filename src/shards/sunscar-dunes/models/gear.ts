import { defineModel } from '#engine';
import { Group } from 'three';
import { WhipModel } from '../weapons/whipModel';
import { buildTower } from '../world/tower';
import { STRINGS } from '../strings';

export const whipModel = defineModel({ id: 'sunscar-dunes/bullwhip', name: STRINGS.whip, category: 'gear',
  pipeline: 'code', file: 'src/shards/sunscar-dunes/weapons/whipModel.ts', defaults: {}, build: () => new WhipModel().root });
export const towerModel = defineModel({ id: 'sunscar-dunes/signal-tower', name: STRINGS.tower, category: 'buildings',
  pipeline: 'code', file: 'src/shards/sunscar-dunes/world/tower.ts', defaults: {}, build: () => { const g = new Group(), t = buildTower(2); t.fire.visible = true; g.add(t.root); return g; } });
