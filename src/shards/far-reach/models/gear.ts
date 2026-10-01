import { defineModel } from '#engine';
import { buildFan } from '../weapons/fanModel';
import { STRINGS } from '../strings';

export const fanModel = defineModel({ id: 'far-reach/war-fan', name: STRINGS.fan, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/weapons/fanModel.ts', defaults: {}, build: () => buildFan().model });
