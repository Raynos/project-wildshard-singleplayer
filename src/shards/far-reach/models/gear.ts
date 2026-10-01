import { defineModel } from '#engine';
import { fanModel } from '../weapons/fanModel';
import { windmill } from '../world/shapes';
import { STRINGS } from '../strings';

export const fanEntry = defineModel({ id: 'far-reach/war-fan', name: STRINGS.fan, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => fanModel() });
export const windmillEntry = defineModel({ id: 'far-reach/windmill', name: STRINGS.mill, category: 'buildings',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => windmill().group });
