// oxlint-disable-next-line import/no-nodejs-modules -- Node fixture reads admitted modules and records the measured pose witness.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Same-engine Rapier continuations and immutable module bytes are hashed here.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { ScriptHost } from '../src/engine/script/host';
import { ScriptWorld } from '../src/engine/script/effects';
import { Scope } from '../src/engine/app/scope';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { RopeChain } from '../src/engine/physics/ropeChain';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { KinematicMover } from '../src/engine/physics/mover';
import { waveHeight } from '../src/engine/world/waves';
import { MOVER_FIELD_RANGES, moverScriptEntities, parseMovers, type MoverData } from '../src/game/shardfile/movers';
import { MoverRuntime, moverQueries, createMoverHost } from '../src/sdk/runtime/movers';
import { MOVERS as DRIFT } from '../src/shards/driftwood-isle/data/movers';
import { MOVERS as SKY } from '../src/shards/far-reach/data/movers';
import { SPANS } from '../src/shards/far-reach/data/layout';
import { ropeSag } from '../src/shards/far-reach/layout';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

function scripts(data: MoverData, slug: string): ScriptHost {
  const host = new ScriptHost({ world: new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(data)), query: moverQueries(data, () => []) });
  for (const hash of new Set(data.map((m) => m.module))) { const bytes = readFileSync(new URL(`../src/shards/${slug}/assets/${hash}`, import.meta.url)); expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash); host.install(hash, Uint8Array.from(bytes)); }
  return host;
}
async function rig(data: MoverData, slug: string) {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  const scope = new Scope('mover-proof'), host = scripts(data, slug), runtime = new MoverRuntime(data, { physics, scope, host });
  return { physics, scope, host, runtime, step(tick: number, permissions?: ReadonlyMap<string, number>) { host.beginTick(tick); runtime.step(tick, permissions); physics.step(); runtime.capture(); }, dispose() { scope.dispose(); physics.dispose(); } };
}
function boatReference(row: MoverData[number], tick: number) {
  const h = row.input[3] ?? 0, damp = row.input[4] ?? 1, t = tick / 60, { x, y, z } = row.at;
  const fx = -Math.sin(h), fz = -Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);
  return { position: new Vector3(x, y + waveHeight(x, z, t, damp), z), q: new Quaternion().setFromEuler(new Euler(Math.atan2(waveHeight(x + fx * 2, z + fz * 2, t, damp) - waveHeight(x - fx * 2, z - fz * 2, t, damp), 4), h, Math.atan2(waveHeight(x + sx * 2, z + sz * 2, t, damp) - waveHeight(x - sx * 2, z - sz * 2, t, damp), 4), 'YXZ')) };
}

describe('SF30 declared fixed-step movers', () => {
  it('rejects malformed primitives, duplicate handles, nonfinite data and excessive joint bodies before allocation', () => {
    expect(parseMovers(DRIFT)).toEqual(DRIFT); expect(parseMovers(SKY)).toEqual(SKY);
    const row = DRIFT[0]; if (row === undefined) throw new Error('Missing boat');
    for (const bad of [[row, row], [{ ...row, at: { ...row.at, x: Infinity } }], [{ ...row, boxes: [] }], [{ ...row, euler: { ...row.euler, x: 4 } }], [{ ...row, input: Array.from({ length: 65 }, () => 0) }]]) expect(() => parseMovers(bad)).toThrow();
  });
  it('binds constants to trusted self and delegates all four physics query opcodes', () => {
    const calls: number[] = [], query = moverQueries(SKY, (kind) => { calls.push(kind); return [kind]; }), zero = Array.from({ length: 8 }, () => 0);
    for (const kind of [1, 2, 3, 4]) expect(query(kind, zero, 8010)).toEqual([kind]); expect(calls).toEqual([1, 2, 3, 4]);
    expect(query(410, zero, 8010)).toEqual([1, 0.55]); expect(query(410, zero, 8001)).toEqual([0]);
    expect(() => query(410, [8001, ...zero.slice(1)], 8010)).toThrow('no author-selected'); expect(() => query(410, zero, 9000)).toThrow('Unknown');
  });
  it('admits module hashes before allocating physics and releases every owned body and joint', async () => {
    const row = DRIFT[0]; if (row === undefined) throw new Error('Missing boat');
    await expect(createMoverHost([row], new Map([[row.module, Uint8Array.from([0])]]), () => [])).rejects.toThrow('hash mismatch');
    const r = await rig(DRIFT, 'driftwood-isle');
    expect(r.physics.world.bodies.len()).toBeGreaterThan(20); expect(r.physics.world.impulseJoints.len()).toBeGreaterThan(20);
    r.scope.dispose(); expect(r.physics.world.bodies.len()).toBe(0); expect(r.physics.world.colliders.len()).toBe(0); expect(r.physics.world.impulseJoints.len()).toBe(0); expect(r.scope.census.disposers).toBe(0); r.physics.dispose();
  });
  it('matches today’s boat poses below 1 mm over 10,000 fixed ticks without exceeding script fuel', () => {
    const row = DRIFT.find((m) => m.id === 'driftwood.boat'); if (row === undefined) throw new Error('Missing boat');
    const host = scripts([row], 'driftwood-isle'); let maximum = 0, fuel = 0;
    for (let tick = 1; tick <= 10000; tick++) {
      host.beginTick(tick); const call = host.call(row.module, row.entity, [tick, 1 / 60, 0, row.entity, 0, row.input.length, 0, 0, 0, 1, 0, 0]);
      expect(call.reason).toBeUndefined(); expect(call.ok).toBe(true); fuel = Math.max(fuel, call.fuel);
      const e = host.world.entity(row.entity); if (e === undefined) throw new Error('Missing pose');
      const q = new Quaternion().setFromEuler(new Euler(e.fields[1] ?? 0, e.fields[2] ?? 0, e.fields[3] ?? 0, 'YXZ')), reference = boatReference(row, tick);
      for (const local of [new Vector3(), new Vector3(0, 0.7, -2.9), new Vector3(0, 0.7, 2.9), new Vector3(1.1, 0.32, 3.2)]) maximum = Math.max(maximum, local.clone().applyQuaternion(q).add(new Vector3(...e.position)).distanceTo(local.clone().applyQuaternion(reference.q).add(reference.position)));
    }
    expect(maximum).toBeLessThan(0.001); expect(fuel).toBeLessThan(host.limits.fuelPerCall);
    mkdirSync('progress/shard-platform/sf30', { recursive: true }); writeFileSync('progress/shard-platform/sf30/boat.json', `${JSON.stringify({ ticks: 10000, maximumPoseErrorM: maximum, maximumFuel: fuel, module: row.module }, null, 2)}\n`);
  }, 60000);
  it('keeps winch locks, the 0.55 rad/s raise, saved raised state and inactive collision until completion', async () => {
    const row = SKY.find((m) => m.id === 'far.winch.bridge'); if (row === undefined) throw new Error('Missing winch');
    const r = await rig([row], 'far-reach');
    try {
      r.runtime.command(row.id, 1); r.step(1); expect(r.runtime.pose(row.id).euler.x).toBe(-1.25); expect(r.runtime.pose(row.id).enabled).toBe(false);
      r.runtime.command(row.id, 1); let reference = -1.25;
      for (let tick = 2; tick <= 138; tick++) { reference = Math.min(0, reference + 0.55 / 60); r.step(tick, new Map([[row.id, 3]])); expect(r.runtime.pose(row.id).euler.x).toBeCloseTo(reference, 12); expect(r.runtime.pose(row.id).enabled).toBe(reference === 0); }
      expect(r.host.world.entity(row.entity)?.fields).toMatchObject({ 5: 1, 6: 0 });
      const checkpoint = r.runtime.snapshot(); expect(() => r.runtime.restore([[row.id, 7]])).toThrow(); expect(r.runtime.snapshot()).toEqual(checkpoint);
    } finally { r.dispose(); }
    const saved = await rig([row], 'far-reach'); try { saved.runtime.command(row.id, 3); saved.step(1); expect(saved.runtime.pose(row.id)).toMatchObject({ euler: { x: 0 }, enabled: true }); } finally { saved.dispose(); }
  });
  it('carries a standing player on the real boat boxes and matches the old wave-driven motor path', async () => {
    const row = DRIFT.find((m) => m.id === 'driftwood.boat'); if (row === undefined) throw new Error('Missing boat');
    const r = await rig([row], 'driftwood-isle'), reference = new Physics(r.physics.R), original = new KinematicMover(reference, row.boxes, { position: row.at, euler: row.euler, enabled: true });
    const makeMotor = (p: Physics) => new CharacterMotor(p, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
    const motor = makeMotor(r.physics), otherMotor = makeMotor(reference), feet = { x: row.at.x, y: row.at.y + 0.55, z: row.at.z }, other = { ...feet };
    let vy = 0, otherVy = 0, rides = 0, maximum = 0;
    try {
      for (let tick = 1; tick <= 1200; tick++) {
        r.step(tick); const pose = boatReference(row, tick), angles = new Euler().setFromQuaternion(pose.q, 'YXZ'); original.setPose({ position: pose.position, euler: { x: angles.x, y: angles.y, z: angles.z }, enabled: true }); reference.step();
        const carry = motor.carry(feet), otherCarry = otherMotor.carry(other); vy -= 22 / 60; otherVy -= 22 / 60;
        const moved = motor.move(feet, { x: 0, y: carry && vy <= 0 ? 0 : vy / 60, z: 0 }), otherMoved = otherMotor.move(other, { x: 0, y: otherCarry && otherVy <= 0 ? 0 : otherVy / 60, z: 0 });
        if (moved.grounded && vy < 0) vy = 0; if (otherMoved.grounded && otherVy < 0) otherVy = 0; if (carry) rides++;
        maximum = Math.max(maximum, new Vector3(feet.x, feet.y, feet.z).distanceTo(new Vector3(other.x, other.y, other.z))); expect(feet.y - pose.position.y).toBeGreaterThan(0.3);
      }
      expect(rides).toBeGreaterThan(1100); expect(maximum).toBeLessThan(0.001);
      writeFileSync('progress/shard-platform/sf30/boat-walker.json', `${JSON.stringify({ ticks: 1200, carriedTicks: rides, maximumFeetErrorM: maximum }, null, 2)}\n`);
    } finally { motor.dispose(); otherMotor.dispose(); original.dispose(); reference.dispose(); r.dispose(); }
  });
  it('walks all three ordinary Sky Reach rope spans on unchanged sagged deck colliders', async () => {
    for (const span of SPANS.filter((s) => s.kind === 'rope')) {
      const row = SKY.find((m) => m.id === span.id); if (row === undefined) throw new Error('Missing declared rope span');
      const r = await rig([row], 'far-reach'), motor = new CharacterMotor(r.physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
      const run = Math.hypot(span.x1 - span.x0, span.z1 - span.z0), len = Math.hypot(run, span.y1 - span.y), dx = (span.x1 - span.x0) / run, dz = (span.z1 - span.z0) / run;
      const feet = { x: span.x0 + dx * 0.5, y: span.y + 0.4, z: span.z0 + dz * 0.5 }; let vy = 0, progress = 0;
      try {
        for (let tick = 1; tick <= Math.ceil(run / 4.3 * 60) + 90 && progress < run - 0.5; tick++) {
          r.step(tick); motor.carry(feet); vy -= 22 / 60; const moved = motor.move(feet, { x: dx * 4.3 / 60, y: vy / 60, z: dz * 4.3 / 60 }); if (moved.grounded && vy < 0) vy = 0;
          progress = (feet.x - span.x0) * dx + (feet.z - span.z0) * dz;
          expect(feet.y).toBeGreaterThan(span.y + (span.y1 - span.y) * progress / run - ropeSag(len, progress / run * len) - 0.1);
        }
        expect(progress).toBeGreaterThan(run - 0.6);
      } finally { motor.dispose(); r.dispose(); }
    }
  });
  it('retains the real jointed bridge’s same-engine continuation while a walker crosses', async () => {
    const row = DRIFT.find((m) => m.kind === 'chain'); if (row?.chain === undefined) throw new Error('Missing bridge');
    const r = await rig([row], 'driftwood-isle'), reference = new Physics(r.physics.R), expected = new RopeChain(reference, row.chain);
    const motor = (p: Physics) => new CharacterMotor(p, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], weight: 80 });
    const actualMotor = motor(r.physics), expectedMotor = motor(reference), start = row.chain.segments[0], end = row.chain.segments.at(-1);
    if (start === undefined || end === undefined) throw new Error('Missing ends');
    const feet = { x: start.x, y: start.y + 0.4, z: start.z }, other = { ...feet }, direction = new Vector3(end.x - start.x, 0, end.z - start.z).normalize(); let vy = 0, ridden = 0;
    try {
      for (let tick = 1; tick <= 360; tick++) {
        r.host.beginTick(tick); r.runtime.step(tick); const riding = actualMotor.carry(feet); expectedMotor.carry(other); vy -= 22 / 60;
        const delta = { x: direction.x * 4.3 / 60, y: riding && vy <= 0 ? 0 : vy / 60, z: direction.z * 4.3 / 60 };
        const moved = actualMotor.move(feet, delta); expectedMotor.move(other, delta); if (moved.grounded && vy < 0) vy = 0; if (riding) ridden++;
        r.physics.step(); reference.step(); r.runtime.capture(); expected.capture(); expect(feet).toEqual(other);
      }
      expect(ridden).toBeGreaterThan(200); expect(new Vector3(feet.x - start.x, 0, feet.z - start.z).length()).toBeGreaterThan(20);
      expect(createHash('sha256').update(r.physics.snapshot()).digest('hex')).toBe(createHash('sha256').update(reference.snapshot()).digest('hex'));
    } finally { actualMotor.dispose(); expectedMotor.dispose(); expected.dispose(); reference.dispose(); r.dispose(); }
  });
});
