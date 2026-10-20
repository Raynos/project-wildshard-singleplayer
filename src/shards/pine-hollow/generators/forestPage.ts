import * as v from 'valibot';
import { ForestPageSchema } from '@wildshard/format/forestPage';
import { nameBlob } from '@wildshard/sdk/blobs';
import { CABIN_LIFE } from './cabinLook';
import { CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { cabinAmbienceRows } from './ambience';
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import looks from '../data/lookMaterials.generated.json' with { type: 'json' };

export const FOREST_PAGE = v.parse(ForestPageSchema, {
  id: 'pine.forest', graphs: looks.runtime, wildlife: 'look/wildlife-draw.json',
  streams: { group: 'streams.root', water: 'streams.water', spray: 'streams.spray' },
  ground: { appearance: 'look/cover-appearance.json', layout: 'world/floor.json', sources: timbers.shardfile.files.filter(file => file.kind === 'glb').map(file => file.hash),
    kinds: ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'].map(id => ({ id, geometry: `pine-undergrowth-${id}` })),
    far: 'pine.undergrowthFar', shadow: 'pine.undergrowthShadows', cells: { size: 32, pad: 2.5, extraFar: 2 } },
  buildings: { id: 'pine.cabins', root: 'cabins.root', shells: 'cabins.shells', life: CABIN_LIFE,
    shared: 'pine.sharedCabinLights', shadow: 'pine.cabinDetailShadows', sites: 'world/building-sites.json',
    variants: ['phone', 'desktop'].flatMap(tier => [false, true].flatMap(shadow => [false, true].map(shared => ({ tier, shadow, shared,
      file: `scenes/cabins/living/${tier}-${String(shadow)}-${String(shared)}.json` })))),
    light: CABIN_LIGHT, hearth: HEARTH_LOOKS.smoke, sunParam: 'sunColour', lampsParam: 'lamps', shadeParam: 'shade', nightShade: .8, sightSlack: .75,
    material: 'materials.', save: 'cabins', ...cabinAmbienceRows(),
  }, props: ['props.rocks', 'props.stumps', 'props.log'],
});
export const FOREST_PAGE_BLOB = nameBlob('world/forest-page.json', 'json', new TextEncoder().encode(JSON.stringify(FOREST_PAGE)));
