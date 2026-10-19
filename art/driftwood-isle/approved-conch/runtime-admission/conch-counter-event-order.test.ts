/** Diagnostic proof against the exact grounded preview: no browser, renderer or world save authority. */
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../../../../src/engine/app/scope';
import { Events } from '../../../../src/engine/events/events';
import { CombatPipeline } from '../../../../src/engine/combat/pipeline';
import { PlayerHealth } from '../../../../src/engine/combat/health';
import { AnimalSim } from '../../../../src/engine/entities/AnimalSim';
import { Physics } from '../../../../src/engine/physics/Physics';
import { CharacterMotor } from '../../../../src/engine/physics/CharacterMotor';
import { loadRapier } from '../../../../src/engine/physics/rapier';
import { loadHeadlessProduct } from '../../../../src/sdk/headlessProduct';
import { preparePracticeDecision } from '../../../../src/game/practice/PracticeDecisions';
import { outputDescriptor } from '../../../../src/game/shardfile/outputDescriptor';
import { DRIFTWOOD_REGULAR_SPECIES } from '../../../../src/shards/driftwood-isle/generators/driftwoodRegularCombat';

const productRoot = 'tmp/conch-grounded-preview-dist-build1/practice-product';
let product: Awaited<ReturnType<typeof loadHeadlessProduct>>;
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => {
  product = await loadHeadlessProduct(productRoot);
  expect(outputDescriptor(product.shardfile)?.index.build.sourceHash).toBe('bb2f0928b20938a942a93f8b9d27b65bebc726464ffedd359c16f19a70c9e8d0');
  rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
});
async function fixture() {
  const scope = new Scope('counter-order'), worldEvents = new Events(), events = new Events();
  const world = new CombatPipeline(worldEvents, scope), bout = scope.child('bout'), combat = new CombatPipeline(events, bout);
  const physics = new Physics(rapier), position = new Vector3(0, 0, 1.5);
  const motor = new CharacterMotor(physics, { radius: .2, height: 1.7, step: .2, maxClimbDeg: 45, snap: .1, group: 'PLAYER', blockedBy: ['WORLD'] });
  const health = new PlayerHealth(events, { now: () => 1000, position: () => position, dodging: () => false, dodgeGuard: () => false });
  const fixed = new Set<() => void>();
  const prepare = await preparePracticeDecision(product, 'driftwood.conch-duelist.decision', scope);
  const authority = prepare({ scope: bout, events, physics, player: { id: health.id, health, position, yaw: 0, motor },
    groundHeightAt: () => 0, live: actor => actor.alive && !bout.disposed,
    fixed: (_id, run, owner) => { fixed.add(run); owner.onDispose(() => fixed.delete(run)); } });
  const actor = new AnimalSim({ kind: 'conch-duelist', label: 'Conch Duelist', variant: 'conch-duelist', rarity: 'uncommon', hp: 60, aggressive: true,
    dims: { bodyY: .8, bodyHalfLen: .3, bodyRadius: .3, headRadius: .2, legLen: .4, feet: [], halfWidth: .3 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } }, 7001, 1, 'practice.conch-duelist', { heightAt: () => 0, random: () => .5 });
  const species = DRIFTWOOD_REGULAR_SPECIES.find(row => row.kind === actor.kind);
  if (species?.brain?.archetype !== 'decision') throw new Error('Missing real conch declaration');
  const control = authority.bind(actor, species.brain.data, species.body), incoming: number[] = [];
  control.observe({ calm: false, reach: () => true, claim: () => true, hurt: amount => incoming.push(amount) }); control.fighting = true;
  world.routeTarget(bout, actor.combatActor(), req => combat.hit(req));
  const worldWrites: string[] = [];
  for (const name of ['damage.dealt', 'actor.died'] as const) worldEvents.on(name, () => worldWrites.push(name), scope);
  const seen: number[] = [], strikes: string[] = [];
  const frame = (dt: number, early: boolean) => {
    if (early) events.flush('update');
    for (let n = 0; n < Math.round(dt * 60); n++) for (const run of fixed) run();
    actor.step(dt); events.flush('update'); worldEvents.flush('update');
    seen.push(actor.mem['conch-st'] ?? -1); if (control.current !== null) strikes.push(control.current.id);
  };
  const hit = (amount = 12, stagger = true) => {
    const result = world.hit({ source: health, sourceTags: ['dmg.melee'], target: actor.combatActor(), amount,
      point: new Vector3(), dir: new Vector3(0, 0, -1) });
    // Same successful-hit ordering as the actual SweptMelee contact: damage first, then stagger.
    if (result?.killed === false && stagger) actor.stagger(new Vector3(), 0);
    return result;
  };
  const close = () => { scope.dispose(); motor.dispose(); physics.dispose(); };
  return { scope, bout, actor, control, events, fixed, frame, hit, seen, strikes, incoming, worldWrites, close };
}

for (const dt of [1 / 60, 1 / 30, .1]) test(`queued guard hit survives decision boundary at ${Math.round(1 / dt)} Hz`, async () => {
  for (const early of [false, true]) {
    const f = await fixture();
    try {
      // Stop at the fixed tick immediately before the next 10 Hz decision call.
      for (let n = 0; n < 35; n++) f.frame(1 / 60, early);
      expect(f.actor.mem['conch-st']).toBe(1); expect(f.actor.mem['regular-clock']).toBeCloseTo(.4);
      expect(f.hit()?.dealt).toBe(3); expect(f.actor.hp).toBe(57);
      f.frame(dt, early);
      for (let n = 0; n < 90; n++) f.frame(1 / 60, early);
      expect(f.seen.includes(4)).toBe(early);
      expect(f.strikes.includes('strike.conch-duelist.counter')).toBe(early);
      expect(f.incoming.includes(16)).toBe(early);
      expect(f.worldWrites).toEqual([]); expect(localStorage.length).toBe(0);
    } finally { f.close(); }
  }
});

test('unguarded interruption does not invent a counter', async () => {
  const f = await fixture();
  try {
    for (let n = 0; n < 49; n++) f.frame(1 / 60, true);
    expect(f.actor.mem['conch-guard']).toBe(0); expect(f.hit()?.dealt).toBe(12);
    for (let n = 0; n < 75; n++) f.frame(1 / 60, true);
    expect(f.seen.includes(4)).toBe(false); expect(f.strikes.includes('strike.conch-duelist.counter')).toBe(false);
    expect(f.worldWrites).toEqual([]); expect(localStorage.length).toBe(0);
  } finally { f.close(); }
});

test('death disposes pending controller work and a fresh Retry has no inherited hit or save', async () => {
  const old = await fixture();
  try {
    for (let n = 0; n < 35; n++) old.frame(1 / 60, true);
    expect(old.hit(400)?.killed).toBe(true); old.frame(1 / 60, true);
    expect(old.fixed.size).toBe(0); expect(old.strikes.includes('strike.conch-duelist.counter')).toBe(false);
    old.bout.dispose(); old.events.flush('update');
    const fresh = await fixture();
    try {
      expect(fresh.actor.hp).toBe(60);
      for (let n = 0; n < 40; n++) fresh.frame(1 / 60, true);
      expect(fresh.seen.includes(4)).toBe(false); expect(fresh.strikes.includes('strike.conch-duelist.counter')).toBe(false);
      expect(fresh.worldWrites).toEqual([]); expect(old.worldWrites).toEqual([]); expect(localStorage.length).toBe(0);
    } finally { fresh.close(); }
  } finally { old.close(); }
});

test('practice drains already-applied hits before borrowed fixed work and retains post-update drain', () => {
  const source = readFileSync('src/game/practice/PracticeCreature.ts', 'utf8');
  const update = source.slice(source.indexOf('  update(dt: number): void {'), source.indexOf('  land(hard: boolean)'));
  const firstDrain = update.indexOf("this.events?.flush('update')");
  expect(firstDrain).toBeGreaterThan(0);
  expect(firstDrain).toBeLessThan(update.indexOf('for (const run of this.fixed) run()'));
  expect(update.lastIndexOf("this.events?.flush('update')")).toBeGreaterThan(update.indexOf('animal.update('));
});


test('off-boundary cancellation also overtakes hit unless the bout queue drains first', async () => {
  for (const early of [false, true]) {
    const f = await fixture();
    try {
      for (let n = 0; n < 31; n++) f.frame(1 / 60, early);
      expect(f.hit()?.dealt).toBe(3); f.frame(1 / 60, early);
      const saved = v.parse(v.object({ decision: v.string() }), JSON.parse(v.parse(v.string(), f.control.snapshot())));
      const logical = v.parse(v.object({ decision: v.object({ bindings: v.array(v.object({ pending: v.array(v.array(v.number())) })) }) }), JSON.parse(saved.decision));
      const kinds = logical.decision.bindings[0]?.pending.map(event => event[0]);
      expect(kinds).toEqual(early ? [7, 11] : [11, 7]);
      for (let n = 0; n < 90; n++) f.frame(1 / 60, early);
      expect(f.strikes.includes('strike.conch-duelist.counter')).toBe(early);
    } finally { f.close(); }
  }
});
