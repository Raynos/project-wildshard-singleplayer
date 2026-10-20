import * as v from 'valibot';
import { RangedPageSchema, ForestWeatherObservationSchema } from '@wildshard/format/rangedPage';
import { nameBlob } from '@wildshard/sdk/blobs';
import { PINE_OUTPUT } from './outputInputs';
import { tradeCatalogue } from './trades';
import { CRAG_CAVE_ROWS } from './cragSceneContribution';
import { PLACE_SETS } from './placeSets';
import { PINE_QUEST_RUNTIME } from './questRuntime';
import layout from '../data/layout.generated.json' with { type: 'json' };
import questScenes from '../data/timberScenes.generated.json' with { type: 'json' };

const painted = PINE_OUTPUT.custom['custom/paintedTextures'], pack = PINE_OUTPUT.custom['custom/trophyMounts'];
export const RANGED_PAGE = v.parse(RangedPageSchema, {
  id: 'pine.ranged', forest: 'pine.forest', elites: 'actors/elites.json', combat: 'combat/roaming.json', finishSource: 'held-finishes',
  menu: { title: 'Finishes', note: "Everything here trades at Mott's stall", hint: "Trade at Mott's stall", gearHint: 'Tap a weapon to hold it · a finish to wear it', noTrade: 'Mott has no use for it', lines: tradeCatalogue().lines },
  drops: { stream: 'skin-drops', rifleStream: 'cabin-rifle', labels: { rifle: 'lever-action', crossbow: 'crossbow' },
    rifle: { at: [questScenes.sites.rifle.x, questScenes.sites.rifle.y, questScenes.sites.rifle.z], label: 'Take the lever-action',
      toast: 'Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube', scale: 1.3, parameters: ['rifle', 'lever'] } },
  prewarm: [{ kind: 'antler-king', variant: 'warden' }, { kind: 'elk', variant: 'thrall' }, { kind: 'boar', variant: 'thrall' }],
  collection: { source: 'collection-mounts', pack, chalk: painted.chalk, texture: painted.textures['chalk'] },
  life: 'actors/page-life.json', directional: true, shadowBatch: true, places: PLACE_SETS,
});
export const WEATHER_OBSERVATIONS = v.parse(ForestWeatherObservationSchema, {
  page: 'pine.forest', audio: 'pine.ranged', guide: PINE_QUEST_RUNTIME.leadPage.quest,
  roofs: [{ frame: { x: layout.BEAR_CAVE.x, z: layout.BEAR_CAVE.z, yaw: layout.BEAR_CAVE.rot }, polygon: CRAG_CAVE_ROWS.meta.inside }],
});
export const RANGED_PAGE_BLOBS = [nameBlob('client/ranged-page.json', 'json', new TextEncoder().encode(JSON.stringify(RANGED_PAGE))),
  nameBlob('world/weather-observations.json', 'json', new TextEncoder().encode(JSON.stringify(WEATHER_OBSERVATIONS)))];
