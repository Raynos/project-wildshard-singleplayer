import { defineModel } from '#engine';
import { buildWhip } from '../weapons/whipModel';
import { buildTower } from '../world/tower';
import { TOWER } from '../layout';
import { STRINGS } from '../strings';

export const whipModel = defineModel({ id: 'sunscar-dunes/bullwhip', name: STRINGS.whip, category: 'gear',
  pipeline: 'code', file: 'src/shards/sunscar-dunes/weapons/whipModel.ts', defaults: {}, build: () => buildWhip().model });
export const towerModel = defineModel({ id: 'sunscar-dunes/signal-tower', name: STRINGS.tower, category: 'buildings',
  pipeline: 'code', file: 'src/shards/sunscar-dunes/world/tower.ts', defaults: {}, build: () => buildTower(TOWER.deck, TOWER.half, 0).group });
