import { ARENA_BURNT_PER_FRAME, ARENA_VIEW } from '@wildshard/format/arenaView';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import fireView from '../data/arenaFire.json' with { type: 'json' };
import { TITAN_FIRE_FIELD } from './stormTitanFight';

/**
 * Nalati zero R6: the Storm Titan's grass fire as a view program (behaviour/titanFireView.as) at the fight's fire slot.
 * Samples, in the order the module reads them: the fight's fire values (on, clear, the wind's x, z and speed), the clock,
 * the tier's smoke copies and rate, then the field's grid (origin, cell, width, depth, idle and active modes) and the
 * look's constants (arenaFire.json: burn, scatter, sink, flame size, front and heat ramps, flame width, the smoke's life,
 * rise, radius and expansion, the scorch's jitter, lift and scale). Arrays: the field's cell modes, lifetimes, the ground
 * under each cell and this frame's burnt-out cells. Batches: 420 flames and up to 200 smoke puffs (each with its aInst
 * triple) and up to 64 new scorch decals a frame.
 */
export function nalatiTitanFireView(): ViewProgramRows {
  const fire = ARENA_VIEW.fire, cells = TITAN_FIRE_FIELD.width * TITAN_FIRE_FIELD.depth, look = fireView.cells;
  const value = (field: string) => ({ kind: 'value' as const, source: fire.values, field });
  const constant = (n: number) => ({ kind: 'constant' as const, value: n });
  return { slot: fire.slot, before: [], budget: { pages: 3, ioBytes: 81920, fuel: 2_000_000, targetMs: 1 },
    pools: [],
    samples: [value('on'), value('clear'), value('windX'), value('windZ'), value('windSpeed'), { kind: 'clock' }, value('smokeCap'), value('smokeRate'),
      ...[TITAN_FIRE_FIELD.x, TITAN_FIRE_FIELD.z, TITAN_FIRE_FIELD.cell, TITAN_FIRE_FIELD.width, TITAN_FIRE_FIELD.depth,
        TITAN_FIRE_FIELD.states.idle, TITAN_FIRE_FIELD.states.active, look.burn, look.scatter, look.sink, look.size,
        ...fireView.front, ...fireView.heat, fireView.flameWidth, ...fireView.life, ...fireView.rise, ...fireView.radius, ...fireView.expansion,
        look.scorch.jitter, look.scorch.lift, ...look.scorch.scale].map(constant)],
    channels: [], transforms: [],
    arrays: [{ id: fire.arrays.modes, length: cells }, { id: fire.arrays.lifetimes, length: cells }, { id: fire.arrays.ground, length: cells },
      { id: fire.arrays.burnt, length: 1 + ARENA_BURNT_PER_FRAME }],
    batches: [{ draw: fire.draws.flames, capacity: fireView.flameCount, attribute: { name: 'aInst', itemSize: 3 } },
      { draw: fire.draws.smoke, capacity: Math.max(...fireView.smokeCount), attribute: { name: 'aInst', itemSize: 3 } },
      { draw: fire.draws.scorch, capacity: ARENA_BURNT_PER_FRAME }],
    bounds: { translation: 4000, scale: [0, 40], shear: .02 } };
}
