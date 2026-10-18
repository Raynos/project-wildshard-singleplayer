import { Vector3 } from 'three';
import { SIGNAL_DUSK_LOOK } from './rows/lastLight';
import { LAST_LIGHT, LAST_LIGHT_SUN } from './rows/lightLook';
import { SAND_FILES } from './rows/sand';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from './rows/flags';
import * as questFlags from './rows/signalQuest';
import { FIRE_GRAPH_IDS } from './rows/fire';

/** Resolve static look and flag rows; the browser owns dusk and resource lifetimes. */
export function paintedLookRows(): ReadonlyMap<string, Uint8Array> {
  const row = SIGNAL_DUSK_LOOK, dir = new Vector3(...row.key.dir).normalize();
  const look = { fog: row.fog, clock: row.clock, hold: true, light: LAST_LIGHT, lightScope: 'material',
    sun: { dir: { x: dir.x, y: dir.y, z: dir.z }, colour: row.key.color, intensity: row.key.intensity },
    state: { deep: row.key.deep, curves: row.curves }, sky: { kind: 'strips', row: row.sky } };
  return new Map(Object.entries({ paintedLook: { look, painterSun: LAST_LIGHT_SUN, sand: SAND_FILES },
    flags: { FLAG, SCOUT_AT, SCOUT_FLAG, ...questFlags }, firePrograms: FIRE_GRAPH_IDS,
  }).map(([name, value]) => [`data/${name}.generated.json`, new TextEncoder().encode(`${JSON.stringify(value)}\n`)]));
}

/** Original dusk field, unnormalised rim direction and material opt-out. */
export function signalPaintedPresentation(): unknown {
  const row = SIGNAL_DUSK_LOOK, dir = new Vector3(...row.key.dir).normalize();
  return { look: { fog: row.fog, clock: row.clock, hold: true, light: LAST_LIGHT, lightScope: 'material',
    sun: { dir: { x: dir.x, y: dir.y, z: dir.z }, colour: row.key.color, intensity: row.key.intensity },
    state: { deep: row.key.deep, curves: row.curves }, sky: { kind: 'strips', row: row.sky } },
    state: 'dusk', terrain: 'declared', materialSun: LAST_LIGHT_SUN, materialOptOut: 'sunscarNoRim' };
}
