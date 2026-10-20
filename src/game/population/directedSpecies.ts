import * as v from 'valibot';
import { DirectedSpeciesSchema } from '@wildshard/format/speciesLooks';
import { ANIMAL_STATES } from '@wildshard/engine/entities/AnimalSim';
import { app } from '@wildshard/engine/app/runtime';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { coupledActorDamage } from '../boss/encounterPatrol';
import { eliteDamageMul } from '../quest/elitePage';
import { ReturnProgram } from './returnProgram';

/** Client-only projection of admitted guest motion over a native actor. The
 * director owns targets; ten-Hz guest decisions publish only state and motion.
 * Damage is a synchronous event projection over the existing hit owner. */
export class DirectedSpecies {
  private readonly row;
  readonly binding: Pick<SpeciesDef, 'think' | 'damageMul'>;
  private get program(): ReturnProgram { return ReturnProgram.page(this.input, app.levelScope ?? undefined); }
  constructor(recipe: unknown, private readonly input: unknown) {
    this.row = v.parse(DirectedSpeciesSchema, recipe);
    if (this.row.states.some(state => !ANIMAL_STATES.some(value => value === state))) throw new Error('Invalid directed species states');
    this.binding = {
      think: (actor, context) => {
        const row = this.row, memory = actor.mem, previous = memory[row.clock];
        if (previous !== undefined && context.t - previous < row.every - 1e-9) return;
        const tx = memory[row.target[0]], tz = memory[row.target[1]];
        const answer = this.program.project(row.signal, { x: actor.position.x, z: actor.position.z, tx: tx ?? 0, tz: tz ?? 0,
          ready: Number(tx !== undefined && tz !== undefined), speed: memory[row.motion[0]] ?? row.speed,
          turn: memory[row.motion[1]] ?? row.turn, threshold: row.threshold, radius: row.stopDistance, yaw: actor.yaw, look: row.look });
        const out = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing directed species output'); return value; };
        memory[row.clock] = context.t; actor.lookTarget.copy(context.player); actor.lookWeight = out('look');
        const state = out('state');
        if (state >= 0) { const value = ANIMAL_STATES.find(candidate => candidate === row.states[state]); if (value === undefined) throw new Error('Invalid directed species state'); actor.state = value; }
        actor.setMotion(out('yaw'), out('speed'), out('turn'));
      },
      ...(this.row.damage === undefined ? {} : { damageMul: (actor, point, direction) => {
        const row = this.row.damage; if (row === undefined) return 1;
        const x = actor.mem[row.player[0]], z = actor.mem[row.player[1]];
        const result = this.program.project(row.signal, { ready: Number(x !== undefined && z !== undefined),
          distance: Math.hypot(point.x - (x ?? 0), point.z - (z ?? 0)), radius: row.radius, scale: row.scale });
        const scale = result['scale']; if (scale === undefined) throw new Error('Missing directed damage output');
        return scale * (row.coupled ? coupledActorDamage(actor, point) : 1) * (row.elite ? eliteDamageMul(actor, point, direction) : 1);
      } }),
    };
  }
}
