import * as v from 'valibot';
import { Vector3 } from 'three';
import { actorDecisionRows, parseDecisionScripts, type BorrowedDecision } from '@wildshard/format/decisionScripts';
import type { CreatureBodyRecipe } from '@wildshard/format/creatures';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import { ShardDecisions, type DecisionRuntime } from './decisions';
import type { BorrowedDecisionPorts } from './borrowedDecisions';
import type { BorrowedSpeciesControl, SpeciesDecisionObservation } from '../plugin/brain';

const saved = v.strictObject({ actor: v.string(), decision: v.string(), strike: v.unknown() });
interface Member {
  actor: AnimalSim; runner: StrikeRunner; observation?: SpeciesDecisionObservation;
  effects: BorrowedDecision['strikeEffects']; control: BorrowedSpeciesControl;
}
/** Retained spawn groups share one admitted decision owner and module image. Only logical state,
 * contacts and RNG streams are actor-scoped; the existing keeper still owns bodies and saves.
 */
export function spawnGroupDecisionAuthority(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, sections: ReadonlyMap<string, unknown>, ports: BorrowedDecisionPorts): {
  bind: (actor: AnimalSim, row: BorrowedDecision, body?: CreatureBodyRecipe) => BorrowedSpeciesControl;
} {
  const groups = new Map<string, ReturnType<typeof create>>();
  function create(scriptId: string, groupId: string) {
    const script = parseDecisionScripts(sections.get('sim/scripts')).find(row => row.id === scriptId);
    if (script === undefined || !('spawnGroup' in script.binding) || script.binding.spawnGroup !== groupId)
      throw new Error('Missing admitted spawn-group decision');
    const rows = actorDecisionRows(script), members = new Map<string, Member>();
    const scope = ports.scope.child(`decision:${groupId}`), state = { tick: 0 }, slots = { ledgerDedupe: [] };
    const entities = new Map<string, AnimalSim>(), strikes = new Map<string, StrikeRunner>(), catalogue = new Map<string, StrikeSpec>();
    const before: (() => void)[] = [], after: (() => void)[] = [], chest = new Vector3();
    let decisions: ShardDecisions | undefined;
    const owner = (): ShardDecisions => {
      if (decisions !== undefined) return decisions;
      if (Object.values(script.actors).some(id => !members.has(id))) throw new Error('Spawn-group bodies must be bound before stepping or saving');
      const controls = new Map(rows.map(row => {
        const id = Object.values(row.actors)[0]; if (id === undefined) throw new Error('Empty spawn group');
        return [row.id, { get fighting() { const member = members.get(id); return member !== undefined && member.actor.alive && ports.live(member.actor); },
          get calm() { return members.get(id)?.observation?.calm ?? true; }, phase: 0 }] as const;
      }));
      const runtime: DecisionRuntime = { ...ports, get physics() { return ports.physics; }, scope, state, slots, entities, strikes,
        borrowedActors: new Set(Object.values(script.actors)), borrowedControls: controls,
        registerStrikeCatalogue: (_id, specs) => { for (const spec of specs) catalogue.set(spec.id, { ...spec, weight: () => 1 }); },
        startDeclaredStrike: (id, target, strike) => {
          const member = members.get(id), spec = catalogue.get(strike), observation = member?.observation;
          if (member === undefined || observation === undefined || spec === undefined || target !== ports.player.id || member.runner.busy
            || !observation.reach(member.actor) || !observation.claim(member.actor)) return false;
          chest.copy(ports.player.position); chest.y += member.effects.find(effect => effect.strike === strike)?.aimHeight ?? 0;
          member.runner.start(spec, member.actor, chest); return true;
        },
        onStep: (_id, run, _adapter, phase) => { const callbacks = phase === 'afterBodies' ? after : before; callbacks.push(run);
          return () => { const index = callbacks.indexOf(run); if (index !== -1) callbacks.splice(index, 1); }; },
      };
      const admitted = new Map(sections); admitted.set('sim/scripts', [script]);
      decisions = new ShardDecisions(runtime, source, assets, admitted, new Map(), undefined, undefined, undefined, true);
      return decisions;
    };
    ports.fixed(`decision:${groupId}`, () => {
      owner(); state.tick++; for (const run of before) run();
      for (const member of members.values()) {
        const observation = member.observation, actor = member.actor;
        if (observation === undefined || !ports.live(actor)) continue;
        const effect = member.effects.find(value => value.strike === member.runner.spec?.id);
        chest.copy(ports.player.position); chest.y += effect?.aimHeight ?? 0;
        member.runner.update(1 / 60, { actor, target: chest, canReach: () => observation.reach(actor), hit: spec => {
          if (effect !== undefined && (effect.speed > 0 || effect.lift > 0) && observation.shove === undefined)
            throw new Error('Decision strike requires its actual impulse authority');
          observation.hurt(spec.damage);
          if (effect !== undefined && (effect.speed > 0 || effect.lift > 0)) observation.shove?.(member.runner.yaw, effect.speed, effect.lift);
        } });
      }
      for (const run of after) run();
    }, scope);
    scope.onDispose(() => { members.clear(); entities.clear(); strikes.clear(); });
    return { bind: (actor: AnimalSim, row: BorrowedDecision, body?: CreatureBodyRecipe): BorrowedSpeciesControl => {
      if (!Object.values(script.actors).includes(actor.entityId) || actor.flying || body?.motion !== 'ground' || body.actions !== undefined || body.offset !== undefined
        || row.perch !== undefined || row.idle !== undefined || row.marks !== undefined || row.leanField !== undefined || row.bankField !== undefined)
        throw new Error('Spawn-group binding requires its declared ground body');
      const previous = members.get(actor.entityId);
      if (previous?.actor === actor) return previous.control;
      const runner = new StrikeRunner();
      const control: BorrowedSpeciesControl = {
        phase: 0, fighting: true, get current() { return runner.spec; }, get windup() { return owner().strikeObservation(actor.entityId).windup; }, get aim() { return runner.yaw; },
        observe: observation => { const member = members.get(actor.entityId); if (member?.actor === actor) member.observation = observation; },
        restart: () => { runner.cancel(); actor.cancelAttack(); owner().restartActor(actor.entityId); },
        snapshot: () => JSON.stringify({ actor: actor.entityId, decision: owner().snapshot(), strike: runner.snapshot() }),
        restore: input => {
          if (typeof input !== 'string') throw new Error('Invalid group continuation');
          const value = v.parse(saved, JSON.parse(input));
          if (value.actor !== actor.entityId) throw new Error('Group continuation belongs to another actor');
          const controller = owner(), strike = readStrikeState(value.strike, [...catalogue.values()]);
          controller.restore(value.decision); runner.restore(strike, [...catalogue.values()]); state.tick = controller.host.snapshot().tick;
        },
      };
      members.set(actor.entityId, { actor, runner, effects: row.strikeEffects, control }); entities.set(actor.entityId, actor); strikes.set(actor.entityId, runner);
      for (const field of source.state.shared.filter(candidate => candidate.privacy === 'public' && candidate.type !== 'string')) actor.mem[field.name] = Number(field.default);
      if (decisions !== undefined) decisions.restartActor(actor.entityId);
      return control;
    } };
  }
  return { bind: (actor, row, body) => {
    if (row.group === undefined) throw new Error('Missing spawn-group identity');
    const key = `${row.script}:${row.group}`;
    let group = groups.get(key); if (group === undefined) { group = create(row.script, row.group); groups.set(key, group); }
    return group.bind(actor, row, body);
  } };
}
