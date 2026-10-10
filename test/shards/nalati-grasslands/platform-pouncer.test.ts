// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping decisions.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the recorded shipping source.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { LedgePouncerBrain, readPouncerSpec, type PouncerSpec, type PouncerPorts } from '../../../src/engine/ai/ledgePouncer';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { AqbarsOracle } from '../../fixtures/nalati-aqbars-oracle/shipping';
import bodies from '../../fixtures/nalati-aqbars-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-aqbars-oracle/source.json' with { type: 'json' };

const tuning: PouncerSpec = {
  initialCooldown: 2, awareCooldown: 1.5, lookIdle: 0.4, homeRadius: 3, pathSeconds: 0.6,
  ledgeMargin: 0.3, standRate: 10, openSeconds: 1.5, openCooldown: 1.2,
  fields: { low: 'low', leap: 'leap', snarl: 'snarl' },
  pose: { stalk: 0.8, perch: 0.2, open: 0.1, leapSwing: 0.6, leapBase: 0.4 },
  speeds: { home: 5, perch: 5.5, stalk: 4.2, back: -1 },
  turns: { home: 3, idle: 1, swipeStart: 6, perch: 4, stalk: 3, tell: 6, open: 2, swipe: 5 },
  stalk: { far: 9, near: 6 },
  perch: { minHeight: 3, maxHeight: 8, minDistance: 4, maxDistance: 14, arrival: 1.4,
    retreatHeight: 2.5, retreatDistance: 25, cooldown: 3.5, waitSeconds: 4 },
  damage: { airborne: 2, openHead: 1.2, perched: 0.25 },
  swipe: { from: 2.4, seconds: 1, first: 0.45, second: 0.8, range: 2.9, damage: 14, cooldown: 1.4 },
  pounce: { minDistance: 7, maxDistance: 12, seconds: 0.6, arcHeight: 1.6, range: 1.9, damage: 35, cooldown: 2.5 },
  tell: { radius: 2.2, strength: 0.6, growth: 0.4, growSeconds: 0.3, seconds: 1 },
};
function brain(ports: ReturnType<typeof inputs>['ports']): LedgePouncerBrain<AnimalSim> {
  const authority: PouncerPorts<AnimalSim> = { ...ports, opened: () => { ports.feed('Aqbars skids — OPEN'); }, growl: at => { ports.sound('leopard_growl', at); } };
  return new LedgePouncerBrain(tuning, authority);
}

const floor = (x: number, z: number): number => Math.sin(x / 30) + Math.cos(z / 40);
function actor(): AnimalSim {
  const row = nalatiBake().actors.find(a => a.kind === 'leopard');
  if (row === undefined) throw new Error('Missing the actual baked Aqbars body');
  return new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: floor, random: () => 0.5 });
}
function inputs() {
  const player = { position: new Vector3(10, floor(10, 0), 0) }, events: unknown[][] = [];
  let phase2 = false;
  const ports = { player, lair: { x: 0, z: 0 }, awareRadius: 60,
    ledges: [{ x: 15, y: 5, z: 0, r: 2 }, { x: -15, y: 6, z: 5, r: 2 }], heightAt: floor, phase2: () => phase2,
    isHead: (a: AnimalSim, point: Vector3) => point.y > a.position.y + 1,
    ring: { setTime: (t: number) => { events.push(['time', t]); }, ring: (x: number, z: number, r: number, strength: number) => { events.push(['ring', x, z, r, strength]); }, hide: () => { events.push(['hide']); } },
    hurt: (_a: AnimalSim, n: number) => { events.push(['hurt', n]); }, knock: (x: number, z: number) => { events.push(['knock', x, z]); },
    feed: (text: string) => { events.push(['feed', text]); }, sound: (name: 'leopard_growl', at: Vector3) => { events.push(['sound', name, ...at]); }, signature: () => { events.push(['signature']); } };
  return { ports, events, player, phase: (on: boolean): void => { phase2 = on; } };
}
it('matches the frozen page pounce/swipe/perch law, native body motion, and output order through varied frames and restore', () => {
  const frozen = readFileSync('test/fixtures/nalati-aqbars-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-aqbars-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = actor(), b = actor(), i = inputs(), o = inputs(), keeper = brain(i.ports), old = new AqbarsOracle(o.ports, b);
  const states = new Set<string>(); let restored: LedgePouncerBrain<AnimalSim> | undefined, restoredBody: AnimalSim | undefined, restoredInputs: ReturnType<typeof inputs> | undefined;
  let time = 0;
  for (let tick = 0; tick < 6000; tick++) {
    const cycle = tick % 600, dt = tick % 7 === 0 ? 1 / 30 : 1 / 60; time += dt;
    const p2 = tick >= 2400;
    i.phase(p2); o.phase(p2); restoredInputs?.phase(p2);
    if (cycle === 0) {
      a.place(0, 0, 0); b.place(0, 0, 0); keeper.spawned(); old.spawned();
      restoredBody?.place(0, 0, 0); restored?.spawned();
    }
    const x = cycle < 120 ? 10 : cycle < 240 ? 2 : cycle < 420 ? -25 : 120;
    for (const input of [i, o, restoredInputs]) input?.player.position.set(x, floor(x, 0), 0);
    const c = { dt: 0.1, player: i.player.position, pathYaw: (body: AnimalSim, px: number, pz: number): number => Math.atan2(px - body.position.x, pz - body.position.z) };
    keeper.tick(a, dt, time, cycle < 420, cycle >= 500); old.tick(dt, time, cycle < 420, cycle >= 500);
    restored?.tick(restoredBody ?? null, dt, time, cycle < 420, cycle >= 500);
    if (tick % 6 === 0) { keeper.think(a, c); old.think(b, c); if (restored !== undefined && restoredBody !== undefined) restored.think(restoredBody, c); }
    keeper.act(a); old.act(b); if (restored !== undefined && restoredBody !== undefined) restored.act(restoredBody);
    a.step(dt); b.step(dt); restoredBody?.step(dt);
    states.add(keeper.snapshot().st);
    expect(i.events).toEqual(o.events); i.events.length = 0; o.events.length = 0; if (restoredInputs !== undefined) restoredInputs.events.length = 0;
    if (tick % 20 === 0) {
      expect(keeper.snapshot()).toEqual(old.snapshot()); expect(a.snapshot()).toEqual(b.snapshot());
      expect(keeper.damage(a, i.player.position)).toBe(old.damage(b, o.player.position));
      if (restored !== undefined && restoredBody !== undefined) { expect(restored.snapshot()).toEqual(keeper.snapshot()); expect(restoredBody.snapshot()).toEqual(a.snapshot()); }
    }
    if (tick === 2999) {
      restoredInputs = inputs(); restored = brain(restoredInputs.ports); restoredBody = actor();
      restored.restore(textRoundTrip(keeper.snapshot())); restoredBody.restore(a.snapshot());
    }
  }
  expect(states.has('leap')).toBe(true); expect(states.has('swipe')).toBe(true); expect(states.has('perch')).toBe(true); expect(states.has('home')).toBe(true);
});
it('refuses unknown/non-finite keeper state before mutating the current continuation', () => {
  const keeper = brain(inputs().ports), saved = keeper.snapshot();
  for (const invalid of [{ ...saved, extra: 1 }, { ...saved, cd: Number.NaN }, { ...saved, from: [Infinity, 0, 0] }, { ...saved, hitDone: 3 }]) {
    expect(() => keeper.restore(invalid)).toThrow(); expect(keeper.snapshot()).toEqual(saved);
  }
  const a = actor(); a.mem['low'] = 1; a.mem['leap'] = 1; keeper.reset(a);
  expect(a.mem['low']).toBe(0); expect(a.mem['leap']).toBe(0); expect(keeper.snapshot().st).toBe('home');
});

/** Exercise the portable wire instead of an in-memory clone. */
function textRoundTrip(value: unknown): unknown { const text = JSON.stringify(value); return JSON.parse(text); }

it('admits copied finite tuning and refuses unknown, conflicting or out-of-order rows before any outputs', () => {
  const i = inputs();
  for (const bad of [{ ...tuning, extra: 1 }, { ...tuning, initialCooldown: Infinity },
    { ...tuning, fields: { ...tuning.fields, snarl: tuning.fields.low } },
    { ...tuning, swipe: { ...tuning.swipe, first: 0.9 } }]) expect(() => readPouncerSpec(bad)).toThrow();
  expect(i.events).toEqual([]);
  const mutable = readPouncerSpec(tuning), keeper = new LedgePouncerBrain(mutable, {
    ...i.ports, opened: () => undefined, growl: () => undefined,
  });
  mutable.initialCooldown = 100;
  keeper.spawned(); expect(keeper.snapshot().cd).toBe(tuning.initialCooldown);
  expect(() => new LedgePouncerBrain(tuning, { ...i.ports, opened: () => undefined, growl: () => undefined,
    ledges: Array.from({ length: 7 }, () => ({ x: 0, y: 3, z: 0, r: 2 })),
  })).toThrow('ledge bound');
});
