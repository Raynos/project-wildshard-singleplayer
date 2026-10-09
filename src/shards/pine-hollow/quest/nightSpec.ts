import type { NightSpec } from './nightBrain';
import { OLD_GROWTH, KINGS_CLEARING, HAMLET_SITES, POND } from '../layout';

/** The page's authored old-growth and three millrace placements; tier alone selects the roamer limit. */
export function pineNightSpec(max: 3 | 4): NightSpec {
  return { max, region: OLD_GROWTH, exclude: KINGS_CLEARING, face: HAMLET_SITES.wheel,
    mill: HAMLET_SITES.mill, water: POND.level, roamKinds: ['elk', 'boar'],
    race: [{ kind: 'boar', x: -189, z: -134 }, { kind: 'elk', x: -194, z: -148 }, { kind: 'boar', x: -198, z: -160 }] };
}
