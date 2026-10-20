import * as v from 'valibot';
import { SpeciesGroupSchema } from '@wildshard/format/speciesLooks';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { renderedHerdOf, renderedPackOf, observeHerdDamage } from './pageGroups';

/** Client-only binding of native pack/herd authority to species brain slots.
 * Rows choose cadence, held memory, confinement and an optional damage field;
 * all decisions and body steering stay with the existing group owners. */
export function groupSpecies(input: unknown): Pick<SpeciesDef, 'think' | 'act' | 'damageMul'> {
  const row = v.parse(SpeciesGroupSchema, input);
  return {
    act: (actor, context) => {
      const group = row.kind === 'herd' ? renderedHerdOf(actor) : renderedPackOf(actor);
      if (group === null || !actor.alive) return;
      group.drive(actor, context, true); if (row.confine) context.confine(actor);
    },
    think: (actor, context) => {
      const group = row.kind === 'herd' ? renderedHerdOf(actor) : renderedPackOf(actor);
      if (row.kind === 'pack' && (group === null || !actor.alive)) { actor.setMotion(actor.yaw, 0, 1); return; }
      const previous = actor.mem[row.clock];
      if (previous !== undefined && context.t - previous < row.every - 1e-9) return;
      actor.mem[row.clock] = context.t;
      if (row.observeDamage) observeHerdDamage(actor);
      if (row.held.some(key => actor.mem[key] === 1)) return;
      if (group === null || !actor.alive) { actor.setMotion(actor.yaw, 0, 1); return; }
      const step = { ...context, dt: previous === undefined ? context.dt : context.t - previous };
      group.tick(step); group.drive(actor, step); if (row.confine) context.confine(actor);
    },
    ...(row.damage === undefined ? {} : { damageMul: actor => actor.mem[row.damage ?? ''] ?? 1 }),
  };
}
