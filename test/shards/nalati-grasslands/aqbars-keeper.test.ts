// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping decisions.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the recorded shipping source.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { AqbarsKeeper, type AqbarsPorts } from '../../../src/shards/nalati-grasslands/runtime/aqbarsKeeper';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { AqbarsOracle } from '../../fixtures/nalati-aqbars-oracle/shipping';
import bodies from '../../fixtures/nalati-aqbars-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-aqbars-oracle/source.json' with { type: 'json' };

const floor = (x: number, z: number): number => Math.sin(x / 30) + Math.cos(z / 40);
function actor(): AnimalSim {
  const row = nalatiBake().actors.find(a => a.kind === 'leopard');
  if (row === undefined) throw new Error('Missing the actual baked Aqbars body');
  return new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: floor, random: () => 0.5 });
}
function inputs() {
  const player = { position: new Vector3(10, floor(10, 0), 0) }, events: unknown[][] = [];
  let phase2 = false;
  const ports: AqbarsPorts<AnimalSim> = { player, lair: { x: 0, z: 0 }, awareRadius: 60,
    ledges: [{ x: 15, y: 5, z: 0, r: 2 }, { x: -15, y: 6, z: 5, r: 2 }], heightAt: floor, phase2: () => phase2,
    isHead: (a, point) => point.y > a.position.y + 1,
    ring: { setTime: t => { events.push(['time', t]); }, ring: (x, z, r, strength) => { events.push(['ring', x, z, r, strength]); }, hide: () => { events.push(['hide']); } },
    hurt: (_a, n) => { events.push(['hurt', n]); }, knock: (x, z) => { events.push(['knock', x, z]); },
    feed: text => { events.push(['feed', text]); }, sound: (name, at) => { events.push(['sound', name, ...at]); }, signature: () => { events.push(['signature']); } };
  return { ports, events, player, phase: (on: boolean): void => { phase2 = on; } };
}
it('matches the frozen page pounce/swipe/perch law, native body motion, and output order through varied frames and restore', () => {
  const frozen = readFileSync('test/fixtures/nalati-aqbars-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-aqbars-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = actor(), b = actor(), i = inputs(), o = inputs(), keeper = new AqbarsKeeper(i.ports), old = new AqbarsOracle(o.ports, b);
  const states = new Set<string>(); let restored: AqbarsKeeper<AnimalSim> | undefined, restoredBody: AnimalSim | undefined, restoredInputs: ReturnType<typeof inputs> | undefined;
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
      restoredInputs = inputs(); restored = new AqbarsKeeper(restoredInputs.ports); restoredBody = actor();
      restored.restore(textRoundTrip(keeper.snapshot())); restoredBody.restore(a.snapshot());
    }
  }
  expect(states.has('leap')).toBe(true); expect(states.has('swipe')).toBe(true); expect(states.has('perch')).toBe(true); expect(states.has('home')).toBe(true);
});
it('refuses unknown/non-finite keeper state before mutating the current continuation', () => {
  const keeper = new AqbarsKeeper(inputs().ports), saved = keeper.snapshot();
  for (const invalid of [{ ...saved, extra: 1 }, { ...saved, cd: Number.NaN }, { ...saved, from: [Infinity, 0, 0] }, { ...saved, hitDone: 3 }]) {
    expect(() => keeper.restore(invalid)).toThrow(); expect(keeper.snapshot()).toEqual(saved);
  }
  const a = actor(); a.mem['low'] = 1; a.mem['leap'] = 1; keeper.reset(a);
  expect(a.mem['low']).toBe(0); expect(a.mem['leap']).toBe(0); expect(keeper.snapshot().st).toBe('home');
});

/** Exercise the portable wire instead of an in-memory clone. */
function textRoundTrip(value: unknown): unknown { const text = JSON.stringify(value); return JSON.parse(text); }
