import { defineModel } from '@wildshard/engine/models/model';
import { fanParts } from '../runtime/weapons/heldFan';
import { bridgeKit, windmill, vane } from '../world/shapes';
import { keeper } from '../quest/keeper';
import { STRINGS } from '../data/strings';

export const fanEntry = defineModel({ id: 'far-reach/war-fan', name: STRINGS.fan, category: 'gear',
  pipeline: 'code', file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => fanParts().root });
export const windmillEntry = defineModel({ id: 'far-reach/windmill', name: STRINGS.mill, category: 'buildings',
  pipeline: ['code'], file: 'src/shards/far-reach/world/mill.ts', defaults: {}, build: () => windmill().group });
/** The rope-bridge kit: Hunyuan3D-2 deck segment and anchor post (`art/far-reach/round-9-bridge/`), code ropes. */
export const bridgeEntry = defineModel({ id: 'far-reach/rope-bridge', name: STRINGS.rope, category: 'buildings',
  pipeline: ['hunyuan', 'code'], file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => bridgeKit() });
/** The bridge-keeper (loop 3): Hunyuan3D-2 from `art/far-reach/round-13-loop-3/ref-keeper.jpg`, a waving arm split off in code. */
export const keeperEntry = defineModel({ id: 'far-reach/keeper', name: STRINGS.keeperName, category: 'people',
  pipeline: ['hunyuan', 'code'], file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => { const k = keeper(0); k.group.position.set(0, 0, 0); k.group.rotation.y = 0; return k.group; } });

/** The wind vane retains its original prop model and builder. */
export const vaneEntry = defineModel({ id: 'far-reach/wind-vane', name: STRINGS.vane, category: 'props', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/far-reach/models/gear.ts', defaults: {}, build: () => vane().group });
