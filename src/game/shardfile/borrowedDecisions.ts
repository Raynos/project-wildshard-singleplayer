import * as v from 'valibot';
import { Vector3 } from 'three';
import { BorrowedDecisionSchema, parseDecisionScripts, type BorrowedDecision } from '@wildshard/format/decisionScripts';
import { parseWorldTargets, worldTargetSpots } from '@wildshard/format/worldTargets';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import { ShardDecisions, type DecisionRuntime } from './decisions';
import type { BorrowedSpeciesControl, SpeciesDecisionAuthority, SpeciesDecisionObservation } from '../plugin/brain';

/** Existing world services and fixed-step registration, lent by the page/native owner.
 * No body, physics world, encounter, interval or simulation is allocated here.
 */
export interface BorrowedDecisionPorts extends Pick<DecisionRuntime, 'scope' | 'events' | 'flags' | 'physics' | 'player' | 'groundHeightAt'> {
  readonly live: (actor: AnimalSim) => boolean;
  readonly fixed: (id: string, run: () => void, scope: DecisionRuntime['scope']) => void;
}
const finite = v.pipe(v.number(), v.finite());
const savedControl = v.strictObject({ version: v.literal(1), actor: v.string(), phase: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(255)),
  fighting: v.boolean(), decision: v.string(), strike: v.unknown() });
/** Bind only verified product rows to the retained species owner's existing body and contact ports. */
export function borrowedDecisionAuthority(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, sections: ReadonlyMap<string, unknown>,
  ports: BorrowedDecisionPorts): SpeciesDecisionAuthority {
  const bodies = new Map<string, DecisionRuntime['scope']>();
  ports.scope.onDispose(() => { bodies.clear(); });
  return { bind: (actor, input) => {
    const row: BorrowedDecision = v.parse(BorrowedDecisionSchema, input);
    const script = parseDecisionScripts(sections.get('sim/scripts')).find(value => value.id === row.script);
    if (script === undefined || !Object.values(script.actors).includes(row.actor) || Object.values(script.actors).some(id => id !== row.actor))
      throw new Error('Borrowed decision must own exactly its admitted actor');
    const points = worldTargetSpots(parseWorldTargets(sections.get('world/targets'))), perch = points.get(row.perch);
    if (perch === undefined) throw new Error('Borrowed decision requires its admitted perch');
    bodies.get(row.actor)?.dispose();
    const scope = ports.scope.child(`decision:${row.actor}`), runner = new StrikeRunner(), state = { tick: 0 };
    bodies.set(row.actor, scope);
    scope.onDispose(() => { if (bodies.get(row.actor) === scope) bodies.delete(row.actor); });
    const entities = new Map([[row.actor, actor]]), strikes = new Map([[row.actor, runner]]), catalogue = new Map<string, StrikeSpec>();
    let observation: SpeciesDecisionObservation | undefined;
    const admission: { owner?: ShardDecisions; initial?: string } = {};
    const owner = (): ShardDecisions => { if (admission.owner === undefined) throw new Error('Decision body is not admitted'); return admission.owner; };
    const control: BorrowedSpeciesControl = {
      phase: 0, fighting: false, get current() { return runner.spec; }, get windup() { return owner().strikeObservation(row.actor).windup; },
      get aim() { return runner.yaw; },
      observe: value => { observation = value; },
      restart: () => { runner.cancel(); actor.cancelAttack(); if (admission.initial === undefined) throw new Error('Decision initial state is not admitted');
        owner().restore(admission.initial); state.tick = owner().host.snapshot().tick;
        actor.place(perch.x, perch.z, 0, perch.y); actor.yaw = perch.yaw; actor.speed = 0; actor.mem[row.bankField] = 0; },
      snapshot: () => JSON.stringify({ version: 1, actor: actor.entityId, phase: control.phase, fighting: control.fighting,
        decision: owner().snapshot(), strike: runner.snapshot() }),
      restore: value => {
        if (typeof value !== 'string') throw new Error('Invalid borrowed decision continuation');
        const saved = v.parse(savedControl, JSON.parse(value));
        if (saved.actor !== actor.entityId) throw new Error('Borrowed decision belongs to another body');
        const strike = readStrikeState(saved.strike, [...catalogue.values()]);
        owner().restore(saved.decision); runner.restore(strike, [...catalogue.values()]);
        state.tick = owner().host.snapshot().tick; control.phase = saved.phase; control.fighting = saved.fighting;
      },
    };
    const before: (() => void)[] = [], after: (() => void)[] = [], chest = new Vector3();
    const runtime: DecisionRuntime = { ...ports, scope, state, entities, strikes, slots: { ledgerDedupe: [] },
      borrowedActors: new Set([row.actor]), borrowedControls: new Map([[row.script, { get fighting() { return control.fighting && observation?.calm !== true && actor.alive; },
        get phase() { return control.phase; }, leanField: row.leanField }]]),
      registerStrikeCatalogue: (id, specs) => {
        if (id !== row.actor || catalogue.size > 0) throw new Error('Borrowed strike catalogue already owned');
        for (const spec of specs) catalogue.set(spec.id, { ...spec, weight: () => 1 });
        for (const effect of row.strikeEffects) if (!catalogue.has(effect.strike)) throw new Error('Borrowed strike effect is undeclared');
      },
      startDeclaredStrike: (id, target, strike) => {
        const spec = catalogue.get(strike), live = observation;
        if (id !== row.actor || target !== ports.player.id || spec === undefined || live === undefined || runner.busy || !live.reach(actor) || !live.claim(actor)) return false;
        chest.copy(ports.player.position); chest.y += row.strikeEffects.find(effect => effect.strike === strike)?.aimHeight ?? 0;
        runner.start(spec, actor, chest); return true;
      },
      onStep: (_id, run, _adapter, phase) => { const callbacks = phase === 'afterBodies' ? after : before; callbacks.push(run);
        return () => { const index = callbacks.indexOf(run); if (index !== -1) callbacks.splice(index, 1); }; },
    };
    const admitted = new Map(sections); admitted.set('sim/scripts', [script]);
    const decisions = new ShardDecisions(runtime, source, assets, admitted, new Map(), undefined, undefined, undefined, true);
    admission.owner = decisions; admission.initial = decisions.snapshot();
    // The existing world calls this once per fixed step; the integer is the guest's logical continuation index.
    ports.fixed(`decision:${row.actor}`, () => {
      if (!ports.live(actor)) { scope.dispose(); return; }
      const live = observation; if (live === undefined || scope.disposed) return;
      state.tick++; for (const run of before) run();
      const effect = row.strikeEffects.find(value => value.strike === runner.spec?.id);
      chest.copy(ports.player.position); chest.y += effect?.aimHeight ?? 0;
      runner.update(1 / 60, { actor, target: chest, canReach: () => live.reach(actor), hit: spec => {
        live.hurt(spec.damage); if (effect !== undefined && (effect.speed > 0 || effect.lift > 0)) live.shove(runner.yaw, effect.speed, effect.lift);
      } });
      for (const run of after) run();
    }, scope);
    // The perch is the declared idle pose; constructing/restoring does not execute the guest.
    control.restart();
    return control;
  } };
}
