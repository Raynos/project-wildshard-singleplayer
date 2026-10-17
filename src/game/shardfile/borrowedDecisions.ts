import * as v from 'valibot';
import { Vector3 } from 'three';
import { BorrowedDecisionSchema, parseDecisionScripts, type BorrowedDecision } from '@wildshard/format/decisionScripts';
import { parseWorldTargets, worldTargetSpots } from '@wildshard/format/worldTargets';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { ANIMAL_STATES, type AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { riseSteering } from '@wildshard/engine/ai/moves';
import { CreatureBodyRecipeSchema } from '@wildshard/format/creatures';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { readStrikeState } from '@wildshard/engine/ai/strikeState';
import { ShardDecisions, type DecisionRuntime } from './decisions';
import { outputDescriptor } from './outputDescriptor';
import type { ShardContext } from '../plugin/context';
import type { SimHost } from '@wildshard/engine/sim';
import { floorBelow } from '@wildshard/engine/physics/query';
import { canReach } from '@wildshard/engine/ai/reach';
import type { BorrowedSpeciesControl, SpeciesDecisionAuthority, SpeciesDecisionObservation } from '../plugin/brain';

/** Existing world services and fixed-step registration, lent by the page/native owner.
 * No body, physics world, encounter, interval or simulation is allocated here.
 */
export interface BorrowedDecisionPorts extends Pick<DecisionRuntime, 'scope' | 'events' | 'flags' | 'physics' | 'player' | 'groundHeightAt'> {
  readonly live: (actor: AnimalSim) => boolean;
  readonly fixed: (id: string, run: () => void, scope: DecisionRuntime['scope']) => void;
}
/** Existing encounter owners look up the controller bound to their actual body. */
const controls = new WeakMap<object, BorrowedSpeciesControl>();
export function borrowedDecisionControl(actor: object): BorrowedSpeciesControl {
  const control = controls.get(actor); if (control === undefined) throw new Error('Encounter body has no admitted decision owner'); return control;
}
/** Bind a verified product to its existing renderer-free host. The existing after-body phase
 * keeps spawn and restored observation order equal; physics is read live across native restore. */
export function nativeDecisionAuthority(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, host: SimHost): SpeciesDecisionAuthority {
  return borrowedDecisionAuthority(source, assets, outputDescriptor(source)?.sections ?? new Map(), { scope: host.scope,
    events: host.events, flags: host.flags, get physics(){return host.physics;}, player: host.player, groundHeightAt: (x,z)=>host.groundHeightAt(x,z),
    live: actor => host.entities.get(actor.entityId) === actor,
    fixed: (id, run, scope) => { scope.onDispose(host.onStep(id, run, undefined, 'afterBodies')); },
  });
}
/** Prepare flag-free species guests before the page builds its bodies. All physics, contacts and fixed ticks
 * come from the existing page. Flag-using guests must use the quest-bound catalogue instead of this port.
 */
export async function pageDecisionAuthority(ctx: ShardContext): Promise<SpeciesDecisionAuthority> {
  const source = ctx.product.shardfile, descriptor = outputDescriptor(source);
  if (descriptor === undefined) throw new Error('Decision species require a verified product');
  const rows = parseDecisionScripts(descriptor.sections.get('sim/scripts'));
  if (rows.some(row => Object.keys(row.flags).length > 0 || row.on.includes('flag') || row.reads.includes('flag') || row.commands.includes('flag')))
    throw new Error('Page species flags require the actual quest owner');
  const assets = new Map<string, Uint8Array>();
  await Promise.all(rows.map(async row => {
    const hash = row.module.slice('blobs/wasm/'.length, -'.wasm'.length), file = descriptor.index.files.find(entry => entry.hash === hash);
    if (file?.name === undefined) throw new Error('Decision module has no admitted logical file');
    assets.set(hash, await ctx.product.file(file.name));
  }));
  let authority: SpeciesDecisionAuthority | undefined;
  return { bind: (actor, row, body) => {
    const world = ctx.game.runtime?.world, physics = ctx.app.physics, health = ctx.app.player;
    if (world === undefined || world === null || physics === null || health === null) throw new Error('Decision body requires its actual page world');
    const noFlags = (): never => { throw new Error('Decision guest has no flag authority'); };
    authority ??= borrowedDecisionAuthority(source, assets, descriptor.sections, { scope: ctx.scope, events: ctx.app.events, physics,
      flags: { has: noFlags, set: noFlags, onChange: () => () => undefined },
      player: { id: health.id, position: world.player.position, get yaw() { return world.player.yaw; }, health, motor: world.player.motor },
      groundHeightAt: (x, z) => { const y = floorBelow(physics, x, z, world.player.position.y + 500, 1000); if (y === undefined) throw new Error('Decision ground has no floor'); return y; },
      live: value => value.alive && !ctx.scope.disposed,
      fixed: (id, run, scope) => { ctx.app.addSystem({ id, phase: 'fixed.post', when: () => !scope.disposed && ctx.app.state === 'play', run }, scope); },
    });
    return authority.bind(actor, row, body);
  } };
}
const finite = v.pipe(v.number(), v.finite());
const savedControl = v.strictObject({ version: v.literal(1), actor: v.string(), phase: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(255)),
  fighting: v.boolean(), decision: v.string(), strike: v.unknown() });
/** Bind only verified product rows to the retained species owner's existing body and contact ports. */
export function borrowedDecisionAuthority(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, sections: ReadonlyMap<string, unknown>,
  ports: BorrowedDecisionPorts): SpeciesDecisionAuthority {
  const bodies = new Map<string, DecisionRuntime['scope']>();
  ports.scope.onDispose(() => { bodies.clear(); });
  return { bind: (actor, input, bodyInput) => {
    const row: BorrowedDecision = v.parse(BorrowedDecisionSchema, input);
    const body = bodyInput === undefined ? undefined : v.parse(CreatureBodyRecipeSchema, bodyInput);
    const states = body?.actions === undefined ? undefined : v.parse(v.array(v.picklist(ANIMAL_STATES)), body.actions.states);
    if (body !== undefined && (body.motion === 'flight') !== actor.flying) throw new Error('Decision pose requires its existing declared motor');
    if (body?.actions !== undefined && body.actions.actions.length > 0)
      throw new Error('Decision pose states cannot own another contact clock');
    const publicFields = source.state.shared.filter(field => field.privacy === 'public' && field.type !== 'string');
    for (const name of [body?.actions?.stateKey, body?.offset?.field]) if (name !== undefined && !publicFields.some(field => field.name === name))
      throw new Error('Decision pose requires its admitted numeric actor field');
    // Read and validate every mark before mutating the retained body's presentation.
    const pose = (): void => {
      const actions = body?.actions, offset = body?.offset;
      const state = actions === undefined ? 0 : actor.mem[actions.stateKey] ?? 0;
      const depth = offset === undefined ? 0 : actor.mem[offset.field] ?? 0;
      if (states !== undefined && (!Number.isInteger(state) || states[state] === undefined)) throw new Error('Invalid decision body state');
      if (!Number.isFinite(depth) || depth < 0 || depth > 1) throw new Error('Invalid normalized body offset');
      if (states !== undefined) { const name = states[state]; if (name !== undefined) actor.state = name; }
      if (offset !== undefined) actor.yOffset = offset.from + (offset.to - offset.from) * depth * depth * (3 - 2 * depth);
    };
    const script = parseDecisionScripts(sections.get('sim/scripts')).find(value => value.id === row.script);
    if (script === undefined || !Object.values(script.actors).includes(row.actor) || Object.values(script.actors).some(id => id !== row.actor))
      throw new Error('Borrowed decision must own exactly its admitted actor');
    const perch = row.perch === undefined ? undefined : worldTargetSpots(parseWorldTargets(sections.get('world/targets'))).get(row.perch);
    const idle = row.idle === undefined ? undefined : parseActorMoves(sections.get('actors/moves')).find(move => move.id === row.idle?.move);
    if (row.idle !== undefined && idle?.kind !== 'rise') throw new Error('Borrowed idle requires its admitted rise move');
    if (row.perch !== undefined && perch === undefined) throw new Error('Borrowed decision requires its admitted perch');
    bodies.get(row.actor)?.dispose();
    const scope = ports.scope.child(`decision:${row.actor}`), runner = new StrikeRunner(), state = { tick: 0, phase: 0, fighting: false };
    bodies.set(row.actor, scope);
    scope.onDispose(() => { if (bodies.get(row.actor) === scope) bodies.delete(row.actor); });
    const entities = new Map([[row.actor, actor]]), strikes = new Map([[row.actor, runner]]), catalogue = new Map<string, StrikeSpec>();
    // Movement-only guests have no combat capability to lend. Strike-capable species must be observed by
    // their actual manager/keeper before the first fixed step; a missing contact owner remains a refusal.
    let observation: SpeciesDecisionObservation | undefined = script.commands.includes('strike') ? undefined : {
      calm:false,reach:value=>canReach(value,ports.player.position,ports.physics),claim:()=>false,
      hurt:()=>{throw new Error('Movement-only guest has no strike capability');},
    };
    const admission: { owner?: ShardDecisions; initial?: string } = {};
    const owner = (): ShardDecisions => { if (admission.owner === undefined) throw new Error('Decision body is not admitted'); return admission.owner; };
    const control: BorrowedSpeciesControl = {
      get phase() { return row.marks === undefined ? state.phase : actor.mem[row.marks.phase] ?? 0; },
      set phase(value) { if (row.marks === undefined) state.phase = value; else actor.mem[row.marks.phase] = value; },
      get fighting() { return row.marks === undefined ? state.fighting : (actor.mem[row.marks.fight] ?? 0) >= 1; },
      set fighting(value) { if (row.marks === undefined) state.fighting = value; else actor.mem[row.marks.fight] = Number(value); }, get current() { return runner.spec; }, get windup() { return owner().strikeObservation(row.actor).windup; },
      get aim() { return runner.yaw; },
      observe: value => { observation = value; },
      restart: () => { runner.cancel(); actor.cancelAttack(); if (admission.initial === undefined) throw new Error('Decision initial state is not admitted');
        owner().restore(admission.initial); state.tick = owner().host.snapshot().tick;
        if (perch !== undefined) { actor.place(perch.x, perch.z, 0, perch.y); actor.yaw = perch.yaw; }
        actor.speed = 0; if (row.bankField !== undefined) actor.mem[row.bankField] = 0; },
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
    controls.set(actor, control); scope.onDispose(() => { if (controls.get(actor) === control) controls.delete(actor); });
    const before: (() => void)[] = [], after: (() => void)[] = [], chest = new Vector3();
    const runtime: DecisionRuntime = { ...ports, get physics(){return ports.physics;}, scope, state, entities, strikes, slots: { ledgerDedupe: [] },
      borrowedActors: new Set([row.actor]), borrowedControls: new Map([[row.script, { get fighting() { return control.fighting && observation?.calm !== true && actor.alive; },
        get phase() { return control.phase; }, ...(row.leanField === undefined ? {} : { leanField: row.leanField }) }]]),
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
        if (effect !== undefined && (effect.speed > 0 || effect.lift > 0) && live.shove === undefined) throw new Error('Decision strike requires its actual impulse authority');
        live.hurt(spec.damage); if (effect !== undefined && (effect.speed > 0 || effect.lift > 0)) live.shove?.(runner.yaw, effect.speed, effect.lift);
      } });
      for (const run of after) run();
      pose();
      if (actor.alive && !control.fighting && idle?.kind === 'rise' && row.idle !== undefined) {
        const steering = riseSteering(idle, actor, actor.mem[row.idle.progress] ?? 0);
        actor.fly(steering.yaw, steering.speed, steering.altitude, steering.turn);
      }
    }, scope);
    // The perch is the declared idle pose; constructing/restoring does not execute the guest.
    control.restart();
    return control;
  } };
}
