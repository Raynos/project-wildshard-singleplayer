// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping decision body.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the recorded shipping source.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { ArgymaqKeeper, type ArgymaqHerd, type ArgymaqPorts } from '../../../src/shards/nalati-grasslands/runtime/argymaqKeeper';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { ArgymaqOracle } from '../../fixtures/nalati-argymaq-oracle/shipping';
import source from '../../fixtures/nalati-argymaq-oracle/source.json' with { type: 'json' };

function actor(id = 'creature:34'): AnimalSim {
  const row = nalatiBake().actors.find(a => a.kind === 'argymaq');
  if (row === undefined) throw new Error('Missing the real browser-baked Argymaq');
  return new AnimalSim(row.spec, row.seed, row.scale, id, { heightAt: () => 0, random: () => 0.5 });
}
function inputs() {
  const player = { position: new Vector3() }, calls: unknown[][] = [];
  let p2 = false, taming: { phase: string; tulpar: AnimalSim | null } | null = null;
  const ports: ArgymaqPorts<AnimalSim> = { player, phase2: () => p2, taming: () => taming,
    lane: { setTime: t => { calls.push(['time', t]); }, lane: (...args) => { calls.push(['lane', ...args]); }, hide: () => { calls.push(['hide']); } },
    signature: () => { calls.push(['signature']); }, adopted: mount => { calls.push(['adopted', mount.entityId]); } };
  const herd = { stallionState: 'watch', stallion: actor(), leadAway: (x: number, z: number): void => { calls.push(['leadAway', x, z]); } };
  return { ports, calls, herd, phase: (on: boolean): void => { p2 = on; }, taming: (value: typeof taming): void => { taming = value; } };
}
it('preserves the shipping trample lane, signature order and phase-two herd lead-away clocks through a text restore', () => {
  const body = readFileSync('test/fixtures/nalati-argymaq-oracle/shipping.txt', 'utf8');
  const frozen = readFileSync('test/fixtures/nalati-argymaq-oracle/shipping.ts', 'utf8').split('// BEGIN SHIPPING CLOCKS\n')[1]?.split('// END SHIPPING CLOCKS')[0];
  expect(frozen).toBe(body); expect(createHash('sha256').update(body).digest('hex')).toBe(source.sha256);
  const a = actor(), i = inputs(), o = inputs(), keeper = new ArgymaqKeeper(i.ports), old = new ArgymaqOracle(o.ports, a, o.herd);
  const states = ['watch', 'warn', 'display', 'charge', 'wheel', 'lead', 'beaten', 'ridden'];
  let restored: ArgymaqKeeper<AnimalSim> | undefined, r: ReturnType<typeof inputs> | undefined, time = 0, leadCount = 0;
  for (let tick = 0; tick < 3000; tick++) {
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60; time += dt;
    const st = states[Math.floor(tick / 80) % states.length]; if (st === undefined) throw new Error('Missing herd state');
    a.position.set(Math.sin(tick / 80) * 15, 0, Math.cos(tick / 80) * 15);
    for (const input of [i, o, r]) if (input !== undefined) { input.herd.stallionState = st; input.phase(tick > 500); input.ports.player.position.set(15, 0, tick % 100); }
    const engaged = tick % 900 < 700;
    keeper.tick(a, i.herd, dt, time, engaged); old.tick(dt, time, engaged); restored?.tick(a, r?.herd ?? null, dt, time, engaged);
    leadCount += i.calls.filter(c => c[0] === 'leadAway').length;
    expect(i.calls).toEqual(o.calls); if (r !== undefined) expect(r.calls).toEqual(i.calls);
    expect(keeper.snapshot()).toEqual(old.snapshot()); if (restored !== undefined) expect(restored.snapshot()).toEqual(keeper.snapshot());
    i.calls.length = 0; o.calls.length = 0; if (r !== undefined) r.calls.length = 0;
    if (tick === 1499) { r = inputs(); restored = new ArgymaqKeeper(r.ports); restored.restore(textRoundTrip(keeper.snapshot())); }
  }
  expect(leadCount).toBeGreaterThan(1);
});
it('adopts only a bonded different mount and refuses malformed clocks before mutation', () => {
  const i = inputs(), a = actor(), keeper = new ArgymaqKeeper(i.ports), mount = actor('mount');
  const run = (herd: ArgymaqHerd<AnimalSim> | null): void => { keeper.tick(a, herd, 1 / 60, 0, true); };
  i.herd.stallion = a; i.taming({ phase: 'bonded', tulpar: mount }); run(i.herd);
  expect(i.calls.some(c => c[0] === 'adopted')).toBe(false);
  i.herd.stallion = mount; i.taming({ phase: 'bucking', tulpar: mount }); run(i.herd);
  expect(i.calls.some(c => c[0] === 'adopted')).toBe(false);
  i.taming({ phase: 'bonded', tulpar: mount }); run(i.herd);
  expect(i.calls.filter(c => c[0] === 'adopted')).toEqual([['adopted', 'mount']]);
  run(null); expect(i.calls.filter(c => c[0] === 'adopted')).toHaveLength(1);
  const saved = keeper.snapshot();
  for (const bad of [{ ...saved, extra: 1 }, { ...saved, runT: Infinity }, { ...saved, laneFrom: [0, Number.NaN, 0] }]) {
    expect(() => keeper.restore(bad)).toThrow(); expect(keeper.snapshot()).toEqual(saved);
  }
});
function textRoundTrip(value: unknown): unknown { const text = JSON.stringify(value); return JSON.parse(text); }
