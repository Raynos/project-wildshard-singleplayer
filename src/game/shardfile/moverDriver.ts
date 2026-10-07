import * as v from 'valibot';
import { ScriptWorld } from '@wildshard/engine/script/effects';
import type { ScriptQuery } from '@wildshard/engine/script/host';
import type { ScriptRole, ScriptSchedule } from '@wildshard/engine/script/composition';
import { parseMovers, moverScriptEntities, MOVER_FIELD_RANGES, type MoverData } from './movers';
import { moverQueries, type MoverRuntime } from './moverRuntime';

const finite = v.pipe(v.number(), v.finite());
const entity = v.strictObject({ id: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), name: v.pipe(v.string(), v.maxLength(128)),
  position: v.tuple([finite, finite, finite]), fields: v.record(v.string(), finite), frozen: v.boolean(), interactive: v.boolean() });
/** The mover's field/query role shares its level's host, module union, fuel, events and effect allowances. */
export class MoverScriptDriver {
  readonly data: MoverData;
  readonly world: ScriptWorld;
  private readonly contract: string;
  private readonly query: ScriptQuery;
  constructor(input: MoverData, physicsQueries: ScriptQuery) {
    this.data = parseMovers(input); this.contract = JSON.stringify(this.data); this.query = moverQueries(this.data, physicsQueries);
    this.world = new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(this.data));
  }
  /** No events cross into mover entity fields from the numeric/brain role. */
  role(): ScriptRole { return { id: 'mover', world: this.world, query: this.query, events: 'consume', snapshot: () => this.snapshot(), restore: text => { this.restore(text); } }; }
  /** Every due call runs under the existing one beginTick; the runtime only publishes admitted collision poses. */
  schedule(runtime: () => MoverRuntime): ScriptSchedule {
    const rows = new Map(this.data.map(row => [row.entity, row]));
    return { id: 'mover', role: 'mover', bindings: this.data.map(row => ({ module: row.module, entity: row.entity, divisor: 1 })),
      input: (binding, tick) => {
        const row = rows.get(binding.entity); if (row === undefined) throw new Error('Missing mover binding');
        return runtime().scriptInput(row.id, tick);
      }, committed: (binding, call) => {
        const row = rows.get(binding.entity); if (row === undefined) throw new Error('Missing mover binding');
        runtime().publish(row.id, call.ok);
      },
    };
  }
  /** Typed role state; the owning composition captures module memories and host quotas once. */
  snapshot(): string { return JSON.stringify({ contract: this.contract, entities: this.world.state() }); }
  /** Restore matching entity identities atomically without commands, body movement or script execution. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ contract: v.string(), entities: v.pipe(v.array(entity), v.maxLength(32)) }), JSON.parse(text));
    if (saved.contract !== this.contract || saved.entities.length !== this.data.length
      || saved.entities.some(row => !this.data.some(mover => mover.entity === row.id && mover.id === row.name))) throw new Error('Incompatible mover role continuation');
    this.world.restore(saved.entities);
  }
}
