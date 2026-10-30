// CI12 Nalati ghost riders (sp-x8's native tape): the directed species' binding split out of the page (DirectedLaw, renderer-
// free) decides as the page's DirectedSpecies does, and the patrol law and the elite readiness continue exactly from their
// checkpoints (snapshot / restore), with the patrol's random stream checkpointed beside it.
import { afterEach, expect, test } from 'vitest';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { app } from '../src/engine/app/runtime';
import { RngService } from '../src/engine/core/rng';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { EliteReadiness, type EliteProjection } from '../src/engine/ai/eliteScript';
import { EncounterPatrolSchema } from '@wildshard/format/encounterRows';
import { bindFlatTerrain } from '@wildshard/engine/test/terrain';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { DirectedSpecies } from '../src/game/population/directedSpecies';
import { DirectedLaw } from '../src/game/population/directedLaw';
import { PatrolLaw } from '../src/game/boss/patrolLaw';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { lendNalatiAdmission, admission } from './fixtures/nalati-return-modules';
import { NALATI_NIGHT as nightInput } from './fixtures/nalati-night';
import { withWeatherWitness } from './fixtures/weatherInlineWitness';
import { installWorldFixture } from './fixtures/worldSetup';

await installWorldFixture();
const scopes: Scope[] = [];
let unbind = (): void => undefined;
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); unbind(); });

test('the directed law decides as the page binding does: state, look, motion and damage', () => {
  const row = { signal: 'steer', clock: 'courier.clock', every: .1, target: ['guide.x', 'guide.z'], motion: ['guide.speed', 'guide.turn'],
    speed: 3, turn: 1.8, threshold: 5, stopDistance: 1.2, look: .4, states: ['wander', 'flee'],
    damage: { signal: 'riderDamage', player: ['eye.x', 'eye.z'], radius: 2, scale: 1.4, elite: false } };
  const scope = new Scope('directed.law'); scopes.push(scope); lendNalatiAdmission(scope); scope.expose(app, 'levelScope', scope);
  const page = new DirectedSpecies(row, admission).binding, native = new DirectedLaw(row, () => ReturnProgram.page(admission, scope)).binding;
  const rider = (log: number[][]) => legacyDouble<Animal>({ position: new Vector3(4, 0, 8), yaw: .3, state: 'idle',
    mem: { 'guide.x': 7, 'guide.z': 12, 'guide.speed': 6, 'eye.x': 0, 'eye.z': 0 }, lookTarget: new Vector3(), lookWeight: 0,
    setMotion: (yaw: number, speed: number, turn?: number) => { log.push([yaw, speed, turn ?? 1]); } });
  const a: number[][] = [], b: number[][] = [], ra = rider(a), rb = rider(b);
  const frame = legacyDouble<ThinkCtx>({ dt: 1 / 30, t: 0, player: new Vector3(1, 2, 3) });
  for (let f = 0; f < 300; f++) {
    frame.t = f / 30; frame.player.set(Math.sin(f / 20) * 6, 2, Math.cos(f / 20) * 6);
    for (const r of [ra, rb]) {
      r.position.set(4 + Math.sin(f / 30) * 5, 0, 8 + f * .05); r.yaw = f * .01;
      r.mem['guide.x'] = 7 + Math.cos(f / 25) * 9; r.mem['guide.z'] = 12 - f * .03;
      if (f % 90 === 45) delete r.mem['guide.x'];
    }
    page.think?.(ra, frame); native.think?.(rb, frame);
    expect([rb.state, rb.lookWeight, rb.mem['courier.clock']]).toEqual([ra.state, ra.lookWeight, ra.mem['courier.clock']]);
    const hit = new Vector3(Math.sin(f) * 3, 0, Math.cos(f) * 3);
    expect(native.damageMul?.(rb, hit, new Vector3())).toBe(page.damageMul?.(ra, hit, new Vector3()));
  }
  expect(b).toEqual(a); expect(a.length).toBeGreaterThan(50);
});

const night = withWeatherWitness(nightInput);
const patrol = { ...v.parse(EncounterPatrolSchema, night.patrol), actors: { kind: 'orchard-watch', variant: 'scout', leader: 'warden', count: 2, herd: -2,
  player: { x: 'px', z: 'pz' }, target: { x: 'tx', z: 'tz' }, steering: { tx: 'tx', tz: 'tz', v: 'v', turn: 'turn' } } };
interface Body { entityId: string; position: Vector3; yaw: number; variant: string; herd: number; alive: boolean; hidden: boolean; mem: Record<string, number> }
const clone = (b: Body): Body => ({ ...b, position: b.position.clone(), mem: { ...b.mem } });

test('a patrol continues from its checkpoint exactly as the patrol it was taken from', () => {
  unbind = bindFlatTerrain({ heightAt: () => 2 });
  const rngA = new RngService(), rngB = new RngService(); rngA.seed(4242); rngB.seed(4242);
  const player = { position: new Vector3(0, 2, 30) }, bodiesA: Body[] = [], bodiesB: Body[] = [];
  const roster = (bodies: Body[]) => ({ factory: { model: () => undefined }, retire: (a: Body) => { a.hidden = true; },
    spawn: (_k: string, x: number, z: number, yaw: number, variant: string) => { const b: Body = { entityId: String(bodies.length), position: new Vector3(x, 0, z), yaw, variant, herd: 0, alive: true, hidden: false, mem: {} }; bodies.push(b); return b; } });
  const law = (rng: RngService) => new PatrolLaw<Body, null>(patrol, night.motion, ReturnProgram.page(night.program), { player, random: rng.stream('ai'), aimRandom: () => rng.stream('ai'), present: () => null });
  const a = law(rngA); a.attachActors(roster(bodiesA));
  const step = (l: PatrolLaw<Body, null>, dt: number, frame: Readonly<Record<string, number>>): void => {
    const effects = l.step(dt, frame);
    for (let i = l.riders.length - 1; i >= 0; i--) { const r = l.riders[i]; if (r !== undefined && effects.get(r)?.['retire'] === 1) l.retire(i); }
  };
  for (let i = 0; i < 40; i++) step(a, .1, { hold: 0, night: 1 });
  const victim = a.riders[0]; if (victim === undefined) throw new Error('Missing rider'); victim.a.alive = false;
  for (let i = 0; i < 13; i++) step(a, .07, { hold: 1, night: 1 });
  // the checkpoint: the law, its random stream and the bodies as they stand
  const saved = a.snapshot(), stream = rngA.stream('ai').snapshot();
  for (const body of bodiesA) bodiesB.push(clone(body));
  const b = law(rngB); b.attachActors(roster(bodiesB)); rngB.stream('ai').restore(stream);
  b.restore(saved, id => { const body = bodiesB.find(x => x.entityId === id); if (body === undefined) throw new Error(`Missing body ${id}`); return body; });
  const same = (): void => {
    expect(b.killsTonight).toBe(a.killsTonight);
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(bodiesB.map(x => ({ id: x.entityId, hidden: x.hidden, mem: x.mem }))).toEqual(bodiesA.map(x => ({ id: x.entityId, hidden: x.hidden, mem: x.mem })));
  };
  same();
  for (let i = 0; i < 260; i++) {
    const dt = i % 11 === 0 ? .13 : .05, frame = i < 120 ? { hold: 1, night: 1 } : { hold: 0, night: 0 };
    if (i === 60) player.position.set(2, 2, 4);
    step(a, dt, frame); step(b, dt, frame); same();
  }
  expect(bodiesA.length).toBeGreaterThan(1);
});

test('the elite readiness continues from its checkpoint exactly', () => {
  const decisions: EliteProjection = { project: (_signal, o) => ({ accept: Number((o['kills'] ?? 0) >= 5) }) };
  const row = { mode: 'script' as const, ready: 'ready', step: 'step', damage: 'damage', cues: {} };
  const a = new EliteReadiness(); let b: EliteReadiness | null = null;
  for (let f = 0; f < 400; f++) {
    const dt = f % 13 === 0 ? .09 : 1 / 30, kills = Math.floor(f / 40);
    a.observe(row, decisions, dt, kills);
    if (f === 177) { b = new EliteReadiness(); b.restore(a.snapshot()); continue; }
    b?.observe(row, decisions, dt, kills);
    if (b !== null) expect(b.snapshot()).toEqual(a.snapshot());
  }
  expect(a.eligible).toBe(true);
});
