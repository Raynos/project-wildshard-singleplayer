import type { LevelSpec } from './engine/level/spec';
import type { RGB } from './engine/level/data';
import manifest from './shards/driftwood-isle/manifest.json';
import { emptyLook } from './game/shardfile/emptyLook';
import { practiceHemisphere } from './practiceLighting';

function rgb(value: readonly number[]): RGB {
  const [r, g, b] = value;
  if (r === undefined || g === undefined || b === undefined || value.length !== 3) throw new Error('Invalid arena color');
  return [r, g, b];
}
/** Authored presentation scalars only; no world, terrain, catalogue or asset boot. */
export function practiceLevel(lighting?: Parameters<typeof practiceHemisphere>[0]): LevelSpec {
  const { sky, atmosphere, grade } = manifest;
  const fill = practiceHemisphere(lighting);
  return { id: 'practice-demo', label: 'Developer practice demo', kitLook: 'toon', hands: 'toon', creatureStyle: 'toon',
    creatures: manifest.creatures, ground: { structures: true }, spawn: { x: 0, y: 900, z: 0, yaw: 0 },
    sky: { sunColor: rgb(sky.sunColor), sunIntensity: sky.sunIntensity, envIntensity: sky.envIntensity, bgIntensity: sky.bgIntensity,
      fogSunColor: rgb(sky.fogSunColor), cloudSunColor: rgb(sky.cloudSunColor), hemiSky: fill?.sky ?? sky.hemiSky,
      hemiGround: fill?.ground ?? sky.hemiGround, hemiIntensity: fill?.intensity ?? sky.hemiIntensity },
    atmosphere: { ...atmosphere, volumetricSunColor: rgb(atmosphere.volumetricSunColor) },
    grade: { ...grade, shadowTint: rgb(grade.shadowTint), highTint: rgb(grade.highTint), lift: rgb(grade.lift), gain: rgb(grade.gain) },
    look: () => Promise.resolve(emptyLook(0.5)), budgets: {}, mechanisms: ['practice'], fight: {}, boot: { files: [] },
    audio: { ambience: 'none', score: 'none' }, loadout: { weapons: ['sword'], tools: [], start: ['sword'] },
    species: [], spawns: [], minimap: {}, boundary: { visible: false, walls: false },
  };
}
