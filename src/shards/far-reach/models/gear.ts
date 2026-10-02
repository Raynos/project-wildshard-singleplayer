import { defineModel } from '#engine';
import { fanModel } from '../weapons/fanModel';
import { bridgeKit, windmill } from '../world/shapes';
import { STRINGS } from '../strings';

export const fanEntry = defineModel({ id: 'far-reach/war-fan', name: STRINGS.fan, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => fanModel() });
export const windmillEntry = defineModel({ id: 'far-reach/windmill', name: STRINGS.mill, category: 'buildings',
  pipeline: ['hunyuan', 'code'], file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => windmill().group });
/** The rope-bridge kit: Hunyuan3D-2 deck segment and anchor post (`art/far-reach/round-9-bridge/`), code ropes. */
export const bridgeEntry = defineModel({ id: 'far-reach/rope-bridge', name: STRINGS.rope, category: 'buildings',
  pipeline: ['hunyuan', 'code'], file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => bridgeKit() });
