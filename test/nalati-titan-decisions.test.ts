import { expect, test } from 'vitest';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import program from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };

function originalSpear(s: Record<string, number>, random: Rng): Record<string, number> {
  const n = (key: string): number => { const value = s[key]; if (value === undefined) throw new Error('Missing frozen input'); return value; };
  const dt = n('dt'), phase = n('phase'); let mode = n('mode'), t = n('t') + dt, cd = n('cd'), x = n('x'), z = n('z'), strike = 0, stuck = 0;
  if (mode === 0) { cd -= dt; if (cd <= 0 && n('chain') === 0) { mode = 1; t = 0; x = n('px'); z = n('pz'); } }
  else if (mode === 1) {
    if (t < n('aim') - n('lock')) { const k = Math.min(1, dt * 5); x += (n('px') - x) * k; z += (n('pz') - z) * k; }
    if (t >= n('aim')) { mode = 2; t = 0; strike = 1; }
  } else if (mode === 2) { if (t > .45) { mode = 3; t = 0; stuck = phase === 0 ? 1 : 0; } }
  else if (t >= n('stuck')) { mode = 0; t = 0; cd = phase === 2 ? 6 + random.next() * 2 : 2 + random.next() * 1.5; }
  return { mode, t, cd, x, z, strike, stuck };
}

test('v1 Titan spear retains the frozen 10 Hz trace, lock point, strike window and borrowed RNG', () => {
  const author = ReturnProgram.page(program), random = new Rng(496), oracle = new Rng(496);
  expect(program.script.abi).toBe('1.0'); expect(program.script.tick).toBeNull();
  for (const phase of [0, 2]) {
    const state: Record<string, number> = { dt: .1, phase, mode: 0, t: 0, cd: 2.5, x: 0, z: 0, chain: 0, aim: 1.5, lock: .5, stuck: 3, px: 0, pz: 0 };
    let strikes = 0;
    for (let tick = 0; tick < 600; tick++) {
      state['px'] = Math.sin(tick * .07) * 40; state['pz'] = Math.cos(tick * .09) * 20;
      state['chain'] = tick >= 100 && tick < 160 ? 1 : 0;
      const expected = originalSpear(state, oracle), actual = author.project('spear', state, random);
      expect(actual).toEqual(expected); expect(random.snapshot()).toEqual(oracle.snapshot());
      strikes += actual['strike'] ?? 0;
      Object.assign(state, actual, { stuck: 3 });
    }
    expect(strikes).toBeGreaterThan(3);
  }
});

test('storm riders complete circle, committed charge and open flank without a second state owner', () => {
  const author = ReturnProgram.page(program);
  const base = { dt: .1, px: 0, pz: 0, ax: -10, az: 0, mode: 0, t: 0, theta: 0, hit: 0,
    x0: -10, z0: 0, x1: 22, z1: 0, lane: 1.2, flank: 2 };
  const circle = author.project('rider', base); expect(circle['mode']).toBe(0); expect(circle['speed']).toBe(12);
  const aim = author.project('rider', { ...base, mode: 1, t: 1.2 }); expect(aim['mode']).toBe(2); expect(aim['t']).toBe(0);
  const hit = author.project('rider', { ...base, mode: 2, ax: 0 }); expect(hit['hurt']).toBe(1); expect(hit['hit']).toBe(1);
  const once = author.project('rider', { ...base, mode: 2, ax: 0, hit: 1 }); expect(once['hurt']).toBe(0);
  const pass = author.project('rider', { ...base, mode: 2, ax: 22 }); expect(pass['mode']).toBe(3); expect(pass['show']).toBe(0);
  const flank = author.project('rider', { ...base, mode: 3, t: 2 }); expect(flank['mode']).toBe(0); expect(flank['speed']).toBe(7);
});

test('chain storms schedule seven tells and land only inside their contact radius', () => {
  const author = ReturnProgram.page(program), random = new Rng(503);
  let cd = 0, left = 0, t = 0, strikes = 0;
  for (let tick = 0; tick < 40; tick++) {
    const result = author.project('chain', { dt: .1, cd, chain: left, t, mode: 1 }, random);
    cd = result['cd'] ?? cd; left = result['left'] ?? left; t = result['t'] ?? t;
    strikes += result['strike'] ?? 0;
  }
  expect(strikes).toBe(7); expect(left).toBe(0); expect(cd).toBeGreaterThan(0);
  const tell = { dt: .1, t: .3, land: .6, radius: 4, x: 0, z: 0, px: 0, pz: 0 };
  expect(author.project('chainLand', tell)).toMatchObject({ strike: 0, hurt: 0 });
  expect(author.project('chainLand', { ...tell, t: .6 })).toMatchObject({ strike: 1, hurt: 1 });
  expect(author.project('chainLand', { ...tell, t: .6, px: 8 })).toMatchObject({ strike: 1, hurt: 0 });
});
