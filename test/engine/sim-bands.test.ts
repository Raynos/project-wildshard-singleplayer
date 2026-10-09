// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TickScheduler, type TickBand, type TickRate } from '../../src/engine/app/scheduler';
import { AI_TICK_RATE, BodyBandClocks, CREATURE_BODY_FAR, CREATURE_BODY_NEAR, creatureBodyShape, keepsCreatureBody } from '../../src/engine/sim/bands';
import { createSimHost, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { Rng, fnv1a32 } from '../../src/engine/core/rng';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL } from '../fixtures/sim-level/level';

// ── The oracle: the page's band arithmetic exactly as it shipped before SF72 extracted it (app/scheduler.ts `due` and
// `band`, physics/creatures.ts's LOD rule and motor recipe at 58d6abc9e), frozen here and driven against today's page
// scheduler and the shared module on one recorded input tape. Any divergence fails bit-for-bit (Object.is).
interface OracleClock { elapsed: number; credit: number; frame: number; dt: number; last: number; due: boolean; tickFrame: number }
interface OracleRow { id: string; brain: OracleClock; body: OracleClock; interrupt: number }
const oracleClock = (): OracleClock => ({ elapsed: 0, credit: 0, frame: -1, dt: 0, last: 0, due: false, tickFrame: -1 });
class OracleScheduler {
  time = 0; frame = 0; frameDt = 0; player = { x: 0, y: 0, z: 0 };
  readonly rows = new Map<object, OracleRow>(); readonly interrupts = new Map<object, number>();
  constructor(private readonly rates: ReadonlyMap<string, TickRate>) {}
  beginFrame(dt: number, player: { x: number; y: number; z: number }): void { this.time += dt; this.frameDt = dt; this.frame++; this.player = player; }
  interrupt(actor: object): void { this.interrupts.set(actor, (this.interrupts.get(actor) ?? 0) + 1); }
  private band(id: string, actor: { position: { x: number; y: number; z: number } }): TickBand {
    const rate = this.rates.get(id); if (!rate) throw new Error(id);
    const distance = Math.hypot(actor.position.x - this.player.x, actor.position.y - this.player.y, actor.position.z - this.player.z);
    const band = rate.bands.find((entry) => distance < entry.upTo); if (!band) throw new Error(id);
    return band;
  }
  private subject(id: string, actor: object): OracleRow {
    let row = this.rows.get(actor);
    if (row?.id !== id) {
      row = { id, brain: oracleClock(), body: oracleClock(), interrupt: 0 };
      row.brain.last = this.time - this.frameDt; row.body.last = this.time - this.frameDt;
      this.rows.set(actor, row);
    }
    return row;
  }
  due(id: string, actor: { position: { x: number; y: number; z: number } }, body: boolean): number {
    const row = this.subject(id, actor), state = body ? row.body : row.brain, band = this.band(id, actor);
    const interrupt = this.interrupts.get(actor) ?? 0;
    const urgent = !body && interrupt !== row.interrupt;
    if (state.frame === this.frame && !urgent) return state.dt;
    const step = this.time - state.last;
    state.last = this.time;
    const paused = body ? band.body === 'paused' : band.brainHz === 'paused';
    if (paused) { state.elapsed = 0; state.credit = 0; state.tickFrame = -1; }
    else { state.elapsed += step; state.credit += step; }
    state.frame = this.frame; state.dt = 0; state.due = false;
    if (!body) row.interrupt = interrupt;
    if (urgent || (!paused && (body ? band.body === 'frame' || state.tickFrame < 0 || this.frame - state.tickFrame >= 2 : band.brainHz !== 'paused' && state.credit + 1e-9 >= 1 / band.brainHz))) {
      state.due = urgent || state.elapsed > 0; state.dt = state.elapsed; state.elapsed = 0;
      if (state.due) state.tickFrame = this.frame;
      state.credit = urgent || body || band.brainHz === 'paused' || band.brainHz === Infinity ? 0
        : Math.max(0, state.credit - Math.floor((state.credit + 1e-9) * band.brainHz) / band.brainHz);
    }
    return state.dt;
  }
  takeBrainDt(id: string, actor: { position: { x: number; y: number; z: number } }): number {
    const dt = this.due(id, actor, false), state = this.subject(id, actor).brain; state.dt = 0; state.due = false; return dt;
  }
}
const oracleKeep = (has: boolean, live: boolean, driven: boolean, dist: number): boolean => {
  let motor = has;
  if (!motor && live && dist < 45 && !driven) motor = true;
  else if (motor && (!live || dist > 55 || driven)) motor = false;
  return motor;
};
const oracleShape = (d: { bodyRadius: number; bodyHalfLen: number; bodyY: number }, s: number): [number, number, number, number, number] => {
  const radius = Math.max(0.12, Math.min(0.9, Math.min(d.bodyRadius, d.bodyHalfLen) * s)); // THREE.MathUtils.clamp
  return [radius, Math.max(radius * 2 + 0.05, (d.bodyY + d.bodyRadius) * s), 0.3 * Math.max(1, s), 45, 0.3];
};

/** The recorded tape: phone-like frame times (60 / 30 / 120 fps, Low Power Mode, hitches, a zero-dt hit-stop frame), a
 *  player walking and teleporting (a portal), subjects drifting across every band edge, wakes and cadence switches. */
function tape(frames: number, seed: number): { dt: number; player: { x: number; y: number; z: number }; moves: { x: number; y: number; z: number }[]; wakes: number[]; switches: number[] }[] {
  const rng = new Rng(seed), out = [];
  const player = { x: 0, y: 0, z: 0 };
  const subjects = Array.from({ length: 24 }, (_, i) => ({ x: (i - 12) * 13.7, y: (i % 5) * 3.1, z: (i % 7) * 29.3 - 90 }));
  for (let f = 0; f < frames; f++) {
    const r = rng.next();
    const dt = r < 0.55 ? 1 / 60 : r < 0.75 ? 1 / 30 : r < 0.9 ? 1 / 120 : r < 0.97 ? 0.016 + rng.next() * 0.05 : r < 0.99 ? 0 : 0.25;
    if (rng.next() < 0.003) { player.x += (rng.next() - 0.5) * 600; player.z += (rng.next() - 0.5) * 600; }
    else { player.x += (rng.next() - 0.4) * 0.3; player.z += (rng.next() - 0.5) * 0.3; }
    for (const s of subjects) { s.x += (rng.next() - 0.5) * 1.6; s.z += (rng.next() - 0.5) * 1.6; }
    const wakes = subjects.flatMap((_, i) => rng.next() < 0.01 ? [i] : []);
    const switches = subjects.flatMap((_, i) => rng.next() < 0.004 ? [i] : []);
    out.push({ dt, player: { ...player }, moves: subjects.map((s) => ({ x: s.x, y: s.y, z: s.z })), wakes, switches });
  }
  return out;
}

describe('the oracle: the page bands are bit-identical after the extraction', () => {
  it.each([435, 72, 9001])('the page scheduler answers the frozen pre-SF72 scheduler on recorded tape %i', (seed) => {
    const rates = new Map<string, TickRate>([['ai', AI_TICK_RATE], ['always', { bands: [{ upTo: Infinity, brainHz: Infinity, body: 'frame' }] }],
      ['legacy', { bands: [{ upTo: Infinity, brainHz: 10, body: 'frame' }] }]]);
    const page = new TickScheduler(), oracle = new OracleScheduler(rates);
    page.rate('legacy', { bands: [{ upTo: Infinity, brainHz: 10, body: 'frame' }] });
    const actors = Array.from({ length: 24 }, () => ({ position: { x: 0, y: 0, z: 0 } }));
    const cadence: string[] = actors.map((_, i) => (i % 3 === 0 ? 'legacy' : 'ai'));
    let compared = 0, due = 0;
    for (const frame of tape(6000, seed)) {
      page.beginFrame(frame.dt, frame.player); oracle.beginFrame(frame.dt, frame.player);
      for (const i of frame.switches) cadence[i] = cadence[i] === 'always' ? 'ai' : 'always';
      for (const i of frame.wakes) { const a = actors[i]; if (a !== undefined) { page.interrupt(a, 'hit'); oracle.interrupt(a); } }
      actors.forEach((a, i) => {
        Object.assign(a.position, frame.moves[i]);
        const id = cadence[i] ?? 'ai';
        const brain = page.takeBrainDt(id, a), brainOracle = oracle.takeBrainDt(id, a);
        const body = page.bodyDt(id, a), bodyOracle = oracle.due(id, a, true);
        expect(Object.is(brain, brainOracle) && Object.is(body, bodyOracle)).toBe(true);
        compared += 2; if (brain > 0) due++; if (body > 0) due++;
      });
    }
    expect(compared).toBe(6000 * 24 * 2);
    expect(due).toBeGreaterThan(50_000);
  });

  it('the creature physics body LOD and capsule are the frozen pre-SF72 rule, NaN included', () => {
    const rng = new Rng(55);
    for (let i = 0; i < 20_000; i++) {
      const has = rng.next() < 0.5, live = rng.next() < 0.9, driven = rng.next() < 0.1;
      const dist = rng.next() < 0.002 ? Number.NaN : rng.next() < 0.05 ? [45, 55, 44.999, 55.001][i % 4] ?? 0 : rng.next() * 120;
      expect(keepsCreatureBody(has, live, driven, dist)).toBe(oracleKeep(has, live, driven, dist));
      const dims = { bodyRadius: rng.next() * 1.4, bodyHalfLen: rng.next() * 2, bodyY: rng.next() * 2 }, scale = 0.3 + rng.next() * 3;
      const shape = creatureBodyShape(dims, scale);
      expect([shape.radius, shape.height, shape.step, shape.maxClimbDeg, shape.snap]).toEqual(oracleShape(dims, scale));
    }
    expect([CREATURE_BODY_NEAR, CREATURE_BODY_FAR]).toEqual([45, 55]);
  });
});

describe('body band clocks', () => {
  const run = (distance: number, ticks: number, rate = 'ai'): number[] => {
    const clocks = new BodyBandClocks(), steps: number[] = [];
    for (let t = 0; t < ticks; t++) { clocks.beginTick(1 / 60); steps.push(clocks.bodyDt('a', rate, distance)); }
    return steps;
  };
  it('updates every tick within 60 m, every other tick with both ticks\' time to 160 m, and not at all beyond', () => {
    run(59.9, 4).forEach((dt) => { expect(dt).toBeCloseTo(1 / 60, 12); });
    const half = run(100, 6);
    expect(half.map((dt) => dt > 0)).toEqual([true, false, true, false, true, false]);
    expect(half[0]).toBe(1 / 60); expect(half[2]).toBeCloseTo(2 / 60, 12); expect(half[4]).toBeCloseTo(2 / 60, 12);
    expect(run(160, 5)).toEqual([0, 0, 0, 0, 0]);
    for (const rate of ['always', 'legacy']) run(500, 3, rate).forEach((dt) => { expect(dt).toBeCloseTo(1 / 60, 12); });
  });
  it('discards paused time: a body back from beyond 160 m steps one tick, never a catch-up', () => {
    const clocks = new BodyBandClocks();
    const tick = (d: number): number => { clocks.beginTick(1 / 60); return clocks.bodyDt('a', 'ai', d); };
    tick(10); for (let t = 0; t < 120; t++) expect(tick(400)).toBe(0);
    expect(tick(10)).toBeCloseTo(1 / 60, 12);
  });
  it('decides at 20 Hz near, 10 Hz far, wakes at once on an interrupt, and a cadence switch starts a fresh clock', () => {
    const clocks = new BodyBandClocks();
    const count = (d: number, ticks: number): number => { let n = 0; for (let t = 0; t < ticks; t++) { clocks.beginTick(1 / 60); if (clocks.takeBrainDt('a', 'ai', d, false) > 0) n++; } return n; };
    expect(count(30, 60)).toBe(20); expect(count(100, 60)).toBe(10); expect(count(300, 60)).toBe(0);
    clocks.beginTick(1 / 60); expect(clocks.takeBrainDt('a', 'ai', 100, false)).toBe(0); // back from the pause: credit restarts
    expect(clocks.takeBrainDt('a', 'ai', 100, true)).toBeCloseTo(1 / 60, 12); // a wake decides now, on the time since its last decision
    expect(clocks.takeBrainDt('a', 'ai', 100, true)).toBe(0); // woken again in the same tick: nothing has elapsed since
    clocks.beginTick(1 / 60); expect(clocks.takeBrainDt('a', 'ai', 100, false)).toBe(0); // its credit restarted at the wake
    clocks.beginTick(1 / 60); expect(clocks.takeBrainDt('a', 'always', 100, false)).toBeCloseTo(1 / 60, 12); // fresh clock, one tick
  });
  it('restores exactly and refuses a different rate table or an unknown body', () => {
    const a = new BodyBandClocks();
    for (let t = 0; t < 7; t++) { a.beginTick(1 / 60); a.bodyDt('x', 'ai', 100); a.takeBrainDt('x', 'ai', 100, false); }
    const b = new BodyBandClocks(); b.restore(a.snapshot(), new Set(['x']));
    for (let t = 0; t < 30; t++) { a.beginTick(1 / 60); b.beginTick(1 / 60); expect(b.bodyDt('x', 'ai', 100 + t)).toBe(a.bodyDt('x', 'ai', 100 + t)); }
    expect(() => { new BodyBandClocks().restore(a.snapshot(), new Set()); }).toThrow(/Incompatible/u);
    expect(() => { new BodyBandClocks({ ai: { bands: [{ upTo: Infinity, brainHz: 5, body: 'frame' }] } }).restore(a.snapshot(), new Set(['x'])); }).toThrow(/Incompatible/u);
  });
});

describe('SimHost on body bands', () => {
  let rapier: Rapier;
  beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
  const spawn = SIM_LEVEL.entities[0];
  if (spawn === undefined) throw new Error('Missing fixture creature');
  /** Five walkers at 20, 50, 100, 150 and 300 m east of the player on a 1 km floor. */
  const level: SimLevel = { ...SIM_LEVEL, id: 'sim-bands', ground: { size: 1000, height: 0 }, quests: [],
    entities: [20, 50, 100, 150, 300].map((x) => ({ id: `walker:${String(x)}`, spec: spawn.spec, seed: spawn.seed, scale: spawn.scale, at: { x, y: 0, z: 0 }, yaw: 0 })) };
  const walk = (host: SimHost): void => {
    for (const entity of host.entities.values()) { entity.desiredSpeed = 1; entity.desiredYaw = 0; entity.speed = 1; }
  };
  const install = (host: SimHost): void => { host.useBodyBands(); };

  it('a host without bands steps and collides every body every tick, and its snapshot has no band field', () => {
    const host = createSimHost(level, { rapier }); walk(host);
    for (let t = 0; t < 4; t++) host.step();
    for (const entity of host.entities.values()) { expect(entity.motor).not.toBeNull(); expect(entity.position.z).toBeCloseTo(4 / 60, 6); }
    expect('bands' in snapshotSimHost(host)).toBe(false);
    expect(host.bodyDt('walker:300')).toBe(1 / 60);
    host.dispose();
  });

  it('moves each body on its band and gives physics bodies only within 45 m, released past 55 m', () => {
    const host = createSimHost(level, { rapier }); install(host); walk(host);
    expect([...host.entities.values()].every((e) => e.motor === null)).toBe(true); // bodiless until the first sync, as on the page
    const z = (id: string): number => host.entities.get(id)?.position.z ?? Number.NaN;
    const trace: number[][] = [];
    for (let t = 0; t < 4; t++) { host.step(); trace.push([z('walker:20'), z('walker:100'), z('walker:300')]); }
    trace.forEach((row, t) => { expect(row[0]).toBeCloseTo((t + 1) / 60, 6); }); // every tick within 60 m
    expect(trace[1]?.[1]).toBe(trace[0]?.[1]); expect(trace[2]?.[1]).toBeCloseTo(3 / 60, 9); expect(trace[3]?.[1]).toBe(trace[2]?.[1]);
    expect(trace.every((row) => row[2] === 0)).toBe(true); // paused beyond 160 m
    expect([...host.entities].filter(([, e]) => e.motor !== null).map(([id]) => id)).toEqual(['walker:20']);
    // walk the player east: walker:50 gains a body inside 45 m, walker:20 keeps its body to 55 m and drops it beyond
    host.player.position.x = 10; host.step();
    expect(host.entities.get('walker:50')?.motor).not.toBeNull();
    host.player.position.x = -34; host.step(); expect(host.entities.get('walker:20')?.motor).not.toBeNull();
    host.player.position.x = -36; host.step(); expect(host.entities.get('walker:20')?.motor).toBeNull();
    host.dispose();
  });

  it('runs the body step hooks around each stepping body in the host\'s order, never for a paused one, from one installer', () => {
    const host = createSimHost(level, { rapier }); install(host); walk(host);
    const log: string[] = [];
    host.useBodyStep({ before: (id, body, dt) => { log.push(`b:${id}:${String(Math.round(dt * 60))}:${String(body.position.z > 0)}`); }, after: (id, body) => { log.push(`a:${id}:${String(body.position.z > 0)}`); } });
    expect(() => { host.useBodyStep({}); }).toThrow(/one installer/u);
    host.step(); host.step(); host.step();
    // walker:20 and walker:50 step every tick; walker:100 / 150 ('half') on ticks 1 and 3, the third with both ticks' time;
    // walker:300 (paused) never
    const pair = (id: string, dt: number, moved: boolean): string[] => [`b:${id}:${String(dt)}:${String(moved)}`, `a:${id}:true`];
    expect(log).toEqual([...pair('walker:20', 1, false), ...pair('walker:50', 1, false), ...pair('walker:100', 1, false), ...pair('walker:150', 1, false),
      ...pair('walker:20', 1, true), ...pair('walker:50', 1, true),
      ...pair('walker:20', 1, true), ...pair('walker:50', 1, true), ...pair('walker:100', 2, true), ...pair('walker:150', 2, true)]);
    host.dispose();
  });

  it.each([3, 8, 31])('snapshots at tick %i and restores the exact banded continuation', (checkpoint) => {
    const original = createSimHost(level, { rapier }); install(original); walk(original);
    const command = (t: number) => ({ moveX: 1, moveZ: Math.sin(t / 20), yaw: 0 });
    for (let t = 0; t < checkpoint; t++) original.step(command(t));
    const saved = snapshotSimHost(original);
    expect(saved.bands?.rows.length).toBe(5);
    const restored = restoreSimHost(level, { rapier }, decodeSimSnapshot(serializeSimSnapshot(saved)), install);
    const hash = (host: SimHost): number => fnv1a32(JSON.stringify(snapshotSimHost(host)));
    expect(hash(restored)).toBe(hash(original));
    for (let t = checkpoint; t < 400; t++) { original.step(command(t)); restored.step(command(t)); }
    expect(hash(restored)).toBe(hash(original));
    // the player walked ~20 m east: bodies changed bands and physics bodies on the way
    expect([...original.entities].filter(([, e]) => e.motor !== null).map(([id]) => id)).toEqual(['walker:20', 'walker:50']);
    expect(() => restoreSimHost(level, { rapier }, saved)).toThrow(/body bands/u);
    original.dispose(); restored.dispose();
  });
});
