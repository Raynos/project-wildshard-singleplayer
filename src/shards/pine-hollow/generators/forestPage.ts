import * as v from 'valibot';
import { ForestPageSchema } from '@wildshard/format/forestPage';
import { nameBlob } from '@wildshard/sdk/blobs';
import { CABIN_LIFE } from './cabinLook';
import { CABIN_LIGHT } from './cabinAssembly';
import { HEARTH_LOOKS } from './hearthLook';
import { cabinAmbienceRows } from './ambience';
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import FOREST_LOOKS from '../data/forestLook.json' with { type: 'json' };
import water from '../data/waterLook.json' with { type: 'json' };
import looks from '../data/lookMaterials.generated.json' with { type: 'json' };

export const FOREST_PAGE = v.parse(ForestPageSchema, {
  treeLooks: [{ look: FOREST_LOOKS.bark, band: 'trunk' }, { look: FOREST_LOOKS.needles, band: 'cards' }, { look: FOREST_LOOKS.twigs, band: 'twigs' }, { look: FOREST_LOOKS.far, band: 'far' }].map(row => ({ look: row.look, band: row.band, fade: 'fade', viewer: 'viewer' })),
  water: { object: 'pond', look: water.looks.pond, looks: Object.values(water.looks), ripples: 'ripples', skyline: 'skyline', centre: 'skyC', probe: 'waterSkyline' },
  id: 'pine.forest', sliceMs: 30, graphs: looks.runtime, wildlife: 'look/wildlife-draw.json',
  streams: { group: 'streams.root', water: 'streams.water', spray: 'streams.spray' },
  ground: { appearance: 'look/cover-appearance.json', layout: 'world/floor.json', sources: timbers.shardfile.files.filter(file => file.kind === 'glb').map(file => file.hash),
    kinds: ([['ferns', 'fern', 'Fern'], ['shrubs', 'bilberry-shrub', 'Bilberry shrub'], ['litter', 'needle-litter', 'Needle litter'], ['stones', 'pebbles', 'Pebbles'],
      ['moss', 'moss-patch', 'Moss patch'], ['reeds', 'reeds', 'Reeds']] as const).map(([id, model, name]) => ({ id, geometry: `pine-undergrowth-${id}`, model: `pine-hollow/${model}`, name })),
    far: 'pine.undergrowthFar', shadow: 'pine.undergrowthShadows', cells: { size: 32, pad: 2.5, extraFar: 2 } },
  buildings: { id: 'pine.cabins', root: 'cabins.root', shells: 'cabins.shells', life: CABIN_LIFE,
    shared: 'pine.sharedCabinLights', shadow: 'pine.cabinDetailShadows', sites: 'world/building-sites.json',
    variants: ['phone', 'desktop'].flatMap(tier => [false, true].flatMap(shadow => [false, true].map(shared => ({ tier, shadow, shared,
      file: `scenes/cabins/living/${tier}-${String(shadow)}-${String(shared)}.json` })))),
    light: CABIN_LIGHT, hearth: HEARTH_LOOKS.smoke, sunParam: 'sunColour', lampsParam: 'lamps', shadeParam: 'shade', nightShade: .8, sightSlack: .75,
    material: 'materials.', save: 'cabins', ...cabinAmbienceRows(),
  }, props: ['props.rocks', 'props.stumps', 'props.log'],
  // the waystones' lanterns (PH-L3): a banked ember by day, the full flame at night, a slow flicker, gone past 150 m
  lanterns: { texture: 'glow', color: 0xffa050, size: .95, order: 6, range: 150, day: .1, flicker: [.1, 9.3, .05, 23.1],
    light: { color: 0xffb060, intensity: 9, distance: 12, decay: 2 }, rows: ['pond', 'ridge', 'den'].map((id, i) => ({ id: `waystone.${id}`, at: timbers.landmarks.lamps[i] })) },
  // the landmarks in their build order: the timbers, the hero props, then each tier's crag modules before its fixed skin
  landmarks: [...['fire-lookout', 'zipline-landing', 'zip-cable', 'creek-footbridge'].map(id => ({ place: `timbers.${id}` })),
    ...timbers.landmarks.stones.map(row => row.kind).concat(['waystone', 'beaver-dam', 'canoe', 'contract-board', 'cave-arch']).map(id => ({ place: `heroes.${id}` })),
    ...(['phone', 'desktop'] as const).flatMap(tier => ['crag-cliff', 'crag-boulder', 'scree'].map((kind): { place: string; tier: string } | { object: string; tier: string } => ({ place: `crags.${tier}.${kind}`, tier }))
      .concat([{ object: `crags.${tier}`, tier }]))],
});
export const LANDMARK_VIEW_BLOB = nameBlob('world/landmark-view.json', 'json', new TextEncoder().encode(JSON.stringify(timbers.landmarks)));
export const FOREST_PAGE_BLOB = nameBlob('world/forest-page.json', 'json', new TextEncoder().encode(JSON.stringify(FOREST_PAGE)));
