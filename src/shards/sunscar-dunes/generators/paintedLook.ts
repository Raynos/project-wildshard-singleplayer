import { Vector3 } from 'three';
import { SIGNAL_DUSK_LOOK } from './rows/lastLight';
import { LAST_LIGHT, LAST_LIGHT_SUN } from './rows/lightLook';

/** Original dusk field, unnormalised rim direction and material opt-out. */
export function signalPaintedPresentation(): unknown {
  const row = SIGNAL_DUSK_LOOK, dir = new Vector3(...row.key.dir).normalize();
  return { look: { fog: row.fog, clock: row.clock, hold: true, light: LAST_LIGHT, lightScope: 'material',
    sun: { dir: { x: dir.x, y: dir.y, z: dir.z }, colour: row.key.color, intensity: row.key.intensity },
    state: { deep: row.key.deep, curves: row.curves }, sky: { kind: 'strips', row: row.sky } },
    state: 'dusk', terrain: 'declared', materialSun: LAST_LIGHT_SUN, materialOptOut: 'sunscarNoRim' };
}
