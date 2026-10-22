import page from '../data/questPageComposition.json' with { type: 'json' };

import type { ViewProgramRows } from '@wildshard/format/viewProgram';

/** The rope deck's camera sway as a view program: the deck's floor under the player, the player's y and horizontal speed,
 *  then the original law's nine parameters in the module's order; its bank (roll, dip) added to the camera. */
export function driftwoodBridgeSway(): ViewProgramRows {
  const row = page.sway, constant = (value: number) => ({ kind: 'constant' as const, value });
  return { system: page.systems.sway, before: [...page.systems.before], budget: { pages: 1, ioBytes: 4096, fuel: 100_000, targetMs: .5 }, pools: [],
    samples: [{ kind: 'floor', piece: row.piece, field: 'present' }, { kind: 'player', field: 'y' }, { kind: 'floor', piece: row.piece, field: 'height' },
      { kind: 'player', field: 'speed' }, ...[row.height, row.ease, row.threshold, row.rate, row.speed, row.rollHz, row.roll, row.dipHz, row.dip].map(constant)],
    channels: [{ kind: 'camera', field: 'roll' }, { kind: 'camera', field: 'y' }], transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } };
}
