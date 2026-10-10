// SHARD-PLATFORM M3 (audio rows): Driftwood Isle's ambience mix as data (runtime/audio/ambience.ts runs it through
// @wildshard/sdk/audio/ambienceMix): the surf's shoreline emitter and the waterfall's, the zone weights, every bed's level,
// the occlusion of the hold and the cave, the reverb rooms, the diag, the dominant zone and the one-shots (the swells on the
// surf, the jungle birds, the cave drips). Names: the profile's zones (`jungle.x`, `cave.inner` …), levels (`level.surf`)
// and wet sends (`wet.hold`); the ports `ground`, `sea`, `night`, `underwater`, `t`, `windTime`, `windStrength`, the
// bounds `holdBox` / `caveBox`, the points `fall` and `cave`, the palms' nearness `palms.sum` / `.dx` / `.dz`.
import type { AmbienceMixRows } from '@wildshard/sdk/audio/ambienceMix';
import { ISLAND_BEDS } from './islandBeds';

/** The island's dominant zones. */
export type IslandZone = 'sea' | 'beach' | 'palms' | 'jungle' | 'cove' | 'lookout' | 'hold' | 'cave' | 'shrine';

/** Driftwood's mix: the beds of ./islandBeds, the zone weights (the hold and the cave muffle the outdoor beds and feed
 *  their reverbs, the shrine court its own), the levels and the one-shots. */
export const ISLAND_MIX: AmbienceMixRows<IslandZone> = {
  warm: ['noise-pink', 'noise-white', 'bubble-bed'],
  prewarm: ['bubble-bed', 'ir-shrine', 'ir-cave', 'ir-hold'],
  underwater: [500, 0.15],
  nodes: [
    { id: 'occl', out: 'ambient', filter: ['lowpass', 20000, 0.5] },
    { id: 'surfPan', out: 'occl', panner: [12, 1, 400], follow: { zone: 'shore', rays: 256, step: 2, refine: 3, diag: 'shoreDist' } },
    { id: 'fallPan', out: 'ambient', panner: [6, 1.1, 250], at: 'fall' },
  ],
  beds: ISLAND_BEDS,
  bounds: [{ id: 'holdBox', from: 'wreck', key: 'holdBounds' }, { id: 'caveBox', from: 'cove', key: 'caveBounds' }],
  near: [{ id: 'palms', radius: 22 }],
  values: [
    ['above', ['-', ['-', 'y', 1.68], ['max', 'ground', 'sea']]],
    ['uw', 'underwater'],
    ['dry', ['-', 1, 'uw']],
    ['night', ['clamp', 'night', 0, 1]],
    ['hold', ['if', 'holdBox', ['*', ['ss', ['+', 'holdBox.r', 1.5], ['-', 'holdBox.r', 1], ['dist', 'holdBox']], ['in', 'y', 'holdBox.yMin', ['+', 'holdBox.yMax', 1.68]]], 0]],
    ['cave', ['if', 'caveBox', ['ss', ['+', 'caveBox.r', 1.5], ['-', 'caveBox.r', 1], ['dist', 'caveBox']], ['zone', 'cave']]],
    ['shrine', ['zone', 'shrine']],
    ['occl', ['max', 'hold', ['*', 'cave', 0.85]]],
    ['jungle', ['zone', 'jungle']],
    ['coveW', ['zone', 'cove']],
    ['lookout', ['+', ['*', ['ss', 12, 24, ['-', 'y', 'sea']], ['zone', 'lookout']], ['*', ['ss', 18, 30, ['-', 'y', 'sea']], ['zone', 'headland'], 'headland.gain']]],
    ['palms', ['min', 1, ['/', 'palms.sum', 2.5]]],
    ['wt', ['if', 'windTime', 'windTime', 't']],
    ['gust', ['+', 0.65, ['*', 0.35, ['abs', ['+', ['*', ['sin', ['*', 'wt', 0.13]], 0.7], ['*', ['sin', ['+', ['*', 'wt', 0.29], 1.3]], 0.3]]]]]],
    ['wind', ['*', 'windStrength', 'gust']],
    ['lap', ['if', ['lt', 'ground', ['+', 'sea', 0.1]], ['-', 1, ['ss', 6, 14, ['-', 'y', 'sea']]], 0]],
    ['surf', ['*', ['-', 'level.surf', ['*', 'level.surf-night', 'night']], ['-', 1, ['*', 0.6, 'occl']]]],
    ['breeze', ['*', ['+', 'level.breeze', ['*', 'level.breeze-height', ['ss', 4, 25, ['-', ['+', 'above', 'ground'], 'sea']]]], 'wind', ['-', 1, ['*', 0.8, 'occl']]]],
  ],
  levels: [
    ['surf', ['*', 'surf', 'dry']],
    ['lap', ['*', 'level.lap', 'lap', 'dry']],
    ['breeze', ['*', 'breeze', 'dry']],
    ['palms', ['*', 'level.palms', 'palms', 'wind', ['-', 1, ['*', 0.5, 'night']], 'dry']],
    ['lookout', ['*', 'level.lookout', ['min', 1, 'lookout'], 'wind', 'dry']],
    ['jungle', ['*', 'level.jungle', 'jungle', 'dry']],
    ['jungleDay', ['-', 1, 'night']],
    ['jungleNight', ['+', 0.25, ['*', 0.75, 'night']]],
    ['waterfall', ['*', 'level.waterfall', 'dry']],
    ['cove', ['*', 'level.cove', 'coveW', 'dry']],
    ['underwater', ['*', 'level.underwater', 'uw']],
  ],
  steer: [{ pan: 'flutter', toward: 'palms', width: 0.7, tau: 0.2 }],
  cutoffs: [['occl', ['+', ['*', 20000, ['-', 1, 'occl']], ['*', 700, 'occl']]]],
  rooms: { from: 'sfx', to: 'world', list: [
    { id: 'hold', ir: 'ir-hold', weight: 'hold', level: ['*', 'wet.hold', 'hold', 'dry'] },
    { id: 'cave', ir: 'ir-cave', weight: 'cave', level: ['*', 'wet.cave', 'cave', 'dry'], feeds: ['fallPan'] },
    { id: 'shrine', ir: 'ir-shrine', weight: 'shrine', level: ['*', 'wet.shrine', 'shrine', 'dry'] },
  ] },
  diag: [
    ['surf', ['*', 'surf', 'dry']], ['shoreDist', 'shoreDist'], ['lap', 'lap'], ['breeze', 'breeze'], ['palms', 'palms'], ['wind', 'wind'],
    ['jungle', 'jungle'], ['night', 'night'], ['cove', 'coveW'], ['waterfall', ['dist', 'fall']], ['lookout', ['min', 1, 'lookout']],
    ['occlusion', 'occl'], ['hold', 'hold'], ['cave', 'cave'], ['shrine', 'shrine'], ['underwater', 'uw'],
  ],
  zones: [
    ['sea', 'uw'], ['hold', ['gt', 'hold', 0.5]], ['cave', ['gt', 'cave', 0.5]], ['shrine', ['gt', 'shrine', 0.5]], ['lookout', ['gt', 'lookout', 0.5]],
    ['jungle', ['gt', 'jungle', 0.5]], ['cove', ['gt', 'coveW', 0.5]], ['sea', ['lt', 'ground', 'sea']], ['palms', ['gt', 'palms', 0.5]], ['beach', 1],
  ],
  oneShots: [
    { mark: 'swell', tick: 'island.swell', every: [4, 5, 0.4],
      swell: { beds: [['surfBody', 0.35, 1.0], ['surfHiss', 0.12, 0.75]], size: [0.7, 0.5], nightDrop: 0.35, build: [1.4, 0.9], wash: [2.4, 1.6], crest: 0.45, early: 0.8, hold: 0.3, decay: 3 } },
    { mark: 'birds', tick: 'island.bird', every: [2.5, 6, 0], when: ['and', ['gt', 'bed.jungle', 0.05], ['lt', 'night', 0.6], ['not', 'underwater']],
      voice: { to: 'jungle', tap: 'island.bird', pan: [1.6, 0.8], gain: [0.35, 0.5, 0.5], phrases: [
        { chance: 0.45, pitch: [380, 120], count: [2, 3], gap: 0.22, step: 1, note: { wave: 'sawtooth', drop: 0.8, glide: 0.14, attack: 0.02, peak: 0.5, end: 0.14, stop: [0.14, 0.05], lowpass: 1400 } },
        { pitch: [2200, 900], count: [3, 3], gap: 0.16, step: 0.9, note: { wave: 'sine', drop: 0.86, glide: 0.12, attack: 0.02, peak: 0.6, end: 0.12, stop: [0.12, 0.05], lowpass: 8000 } },
      ] } },
    { mark: 'drips', tick: 'island.drip', every: [0.7, 2.2, 0], when: ['and', ['gt', 'cave', 0.05], ['not', 'underwater']],
      voice: { to: 'sfx', tap: 'island.drip', scale: 'cave', phrases: [
        { pitch: [1300, 1400], count: [1, 0], gap: 0, step: 1, note: { drop: 0.7, glide: 0.05, attack: 0.003, peak: 0.12, end: 0.09, stop: [0.12] } },
      ] } },
  ],
};
