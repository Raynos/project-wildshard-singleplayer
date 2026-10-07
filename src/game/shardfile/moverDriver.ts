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
  private readonly resetIds: ReadonlySet<string>;
  /** Lift-only modules reset on load; sharing their memory with persistent movers is refused. */
  readonly transientModules: readonly string[];
  constructor(input: MoverData, physicsQueries: ScriptQuery, resetIds: readonly string[] = []) {
    this.data = parseMovers(input); this.query = moverQueries(this.data, physicsQueries);
    this.resetIds = new Set(resetIds);
    if (this.resetIds.size !== resetIds.length || resetIds.some(id => !this.data.some(row => row.id === id))) throw new Error('Invalid transient mover identity');
    this.transientModules = [...new Set(this.data.filter(row => this.resetIds.has(row.id)).map(row => row.module))].sort();
    if (this.data.some(row => !this.resetIds.has(row.id) && this.transientModules.includes(row.module))) throw new Error('Lift module cannot own persistent movers');
    this.contract = JSON.stringify(resetIds.length === 0 ? this.data : { data: this.data, resetIds: [...resetIds].sort() });
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
  snapshot(): string {
    const initial = new Map(moverScriptEntities(this.data).map(row => [row.id, row]));
    return JSON.stringify({ contract: this.contract, entities: this.world.state().map(row => this.resetIds.has(row.name) ? initial.get(row.id) : row) });
  }
  /** Restore matching entity identities atomically without commands, body movement or script execution. */
  restore(text: string): void {
    const saved = v.parse(v.strictObject({ contract: v.string(), entities: v.pipe(v.array(entity), v.maxLength(32)) }), JSON.parse(text));
    if (saved.contract !== this.contract || saved.entities.length !== this.data.length
      || saved.entities.some(row => !this.data.some(mover => mover.entity === row.id && mover.id === row.name))) throw new Error('Incompatible mover role continuation');
    const initial = new Map(moverScriptEntities(this.data).map(row => [row.id, row]));
    if (saved.entities.some(row => this.resetIds.has(row.name) && JSON.stringify(row) !== JSON.stringify(initial.get(row.id)))) throw new Error('Lift continuation must reset at the road stop');
    this.world.restore(saved.entities);
  }
}
