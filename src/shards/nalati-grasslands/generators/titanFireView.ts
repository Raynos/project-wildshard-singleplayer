import { ARENA_BURNT_PER_FRAME, ARENA_VIEW } from '@wildshard/format/arenaView';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';
import fireView from '../data/arenaFire.json' with { type: 'json' };
import { TITAN_FIRE_FIELD } from './stormTitanFight';

/**
 * Nalati zero R6: the Storm Titan's grass fire as a view program (behaviour/titanFireView.as) at the fight's fire slot.
 * Samples, in the order the module reads them: the fight's fire values (on, clear, the wind's x, z and speed), the clock,
 * the tier's smoke copies and rate, then the field's grid (origin, cell, width, depth, idle and active modes) and the
 * look's constants (arenaFire.json: burn, scatter, sink, flame size, front and heat ramps, flame width, the smoke's life,
 * rise, radius and expansion, the scorch's jitter, lift and scale), the flame and smoke capacities and the scorch draw's
 * copies (a fire value). Arrays: the field's cell modes, lifetimes, the ground
 * under each cell and this frame's burnt-out cells. Batches: 420 flames and up to 200 smoke puffs (each with its aInst
 * triple) and up to 64 new scorch decals a frame.
 */
export function nalatiTitanFireView(): ViewProgramRows { return fireViewRows(TITAN_FIRE_FIELD, fireView); }

/** A grass fire's view rows for any cell field and fire look (the Titan's above; a test's made-up field too). */
export function fireViewRows(field: { readonly x: number; readonly z: number; readonly cell: number; readonly width: number; readonly depth: number; readonly states: { readonly idle: number; readonly active: number } },
  view: { readonly flameCount: number; readonly smokeCount: readonly number[]; readonly front: readonly number[]; readonly heat: readonly number[]; readonly flameWidth: number;
    readonly life: readonly number[]; readonly rise: readonly number[]; readonly radius: readonly number[]; readonly expansion: readonly number[];
    readonly cells?: { readonly burn: number; readonly scatter: number; readonly sink: number; readonly size: number; readonly scorch: { readonly jitter: number; readonly lift: number; readonly scale: readonly number[] } } }): ViewProgramRows {
  const fire = ARENA_VIEW.fire, cells = field.width * field.depth, look = view.cells;
  if (look === undefined) throw new Error('Arena fire has no cell rows');
  const value = (name: string) => ({ kind: 'value' as const, source: fire.values, field: name });
  const constant = (n: number) => ({ kind: 'constant' as const, value: n });
  const smokeCapacity = Math.max(...view.smokeCount);
  return { slot: fire.slot, before: [], budget: { pages: 3, ioBytes: 81920, fuel: 2_000_000, targetMs: 1 },
    pools: [],
    samples: [value('on'), value('clear'), value('windX'), value('windZ'), value('windSpeed'), { kind: 'clock' }, value('smokeCap'), value('smokeRate'),
      ...[field.x, field.z, field.cell, field.width, field.depth, field.states.idle, field.states.active, look.burn, look.scatter, look.sink, look.size,
        ...view.front, ...view.heat, view.flameWidth, ...view.life, ...view.rise, ...view.radius, ...view.expansion,
        look.scorch.jitter, look.scorch.lift, ...look.scorch.scale, view.flameCount, smokeCapacity].map(constant), value('scorchCap')],
    channels: [], transforms: [],
    arrays: [{ id: fire.arrays.modes, length: cells }, { id: fire.arrays.lifetimes, length: cells }, { id: fire.arrays.ground, length: cells },
      { id: fire.arrays.burnt, length: 1 + ARENA_BURNT_PER_FRAME }],
    batches: [{ draw: fire.draws.flames, capacity: view.flameCount, attribute: { name: 'aInst', itemSize: 3 } },
      { draw: fire.draws.smoke, capacity: smokeCapacity, attribute: { name: 'aInst', itemSize: 3 } },
      { draw: fire.draws.scorch, capacity: ARENA_BURNT_PER_FRAME }],
    bounds: { translation: 4000, scale: [0, 40], shear: .02 } };
}
