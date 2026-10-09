// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM and read the client Player's source in Node.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { PerspectiveCamera } from 'three';
import { createSimHost, type SimCommand, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import { Physics } from '../../src/engine/physics/Physics';
import { DOUBLE_JUMP, JUMP_SPEED, jump, jumpClock, type JumpState } from '../../src/engine/player/jump';
import { DODGE_COOLDOWN, DODGE_DIST, DODGE_TIME } from '../../src/engine/player/dash';
import { sweptLunge } from '../../src/engine/combat/sweptMeleeCore';
import { Player } from '../../src/engine/player/Player';
import type { PlayerCommand } from '../../src/engine/input/commands';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { TickCommandSchema, tickCommands } from '../../src/sdk/tickProtocol';
import { legacyDouble } from '../fake/FakeGame';
import { expectSameSimSnapshot } from '../fake/simSnapshot';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const restoreTerrain = overrideTerrain({ heightAt: () => -1000 });
afterAll(restoreTerrain);

/** A 60 m slab (top y = 0), a 1.5 m deck to walk off (the coyote jump) and a wall east; no creature. */
const FLAT: SimLevel = { ...SIM_LEVEL, id: 'sim-moves', entities: [], quests: [], player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 4 } };
const PORTS = { ground: false, heightAt: () => -1000 } as const;
const DT = 1 / 60;
const still: SimCommand = { moveX: 0, moveZ: 0, yaw: 0 };
function build(physics: Physics): void {
  const R = rapier, world = physics.world;
  world.createCollider(R.ColliderDesc.cuboid(30, 1, 30).setTranslation(0, -1, 0).setCollisionGroups(groups('WORLD')));
  world.createCollider(R.ColliderDesc.cuboid(3, 0.75, 3).setTranslation(0, 0.75, -20).setCollisionGroups(groups('WORLD')));
  world.createCollider(R.ColliderDesc.cuboid(0.2, 3, 6).setTranslation(8, 3, 0).setCollisionGroups(groups('WORLD')));
}
function flat(at?: { x: number; y: number; z: number }): SimHost {
  const host = createSimHost(FLAT, { ...PORTS, rapier });
  build(host.physics); host.setFloorQuery(() => undefined);
  host.player.position.set(at?.x ?? 0, at?.y ?? 0, at?.z ?? 0); host.player.motor.resetAt(host.player.position);
  for (let tick = 0; tick < 5; tick++) host.step(still);
  return host;
}
function client(): { player: Player; physics: Physics; dispose: () => void } {
  const physics = new Physics(rapier); build(physics);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.spawn(0, 0, 0, 0);
  return { player, physics, dispose: () => { player.motor.dispose(); physics.dispose(); } };
}
function command(moveX: number, moveY: number, jumpPress: boolean, dodge: boolean): PlayerCommand {
  return { moveX, moveY, yaw: 0, pitch: 0, crouch: false, sprint: false, jump: jumpPress, dodge, dive: false, surface: false,
    aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
}

it('is the client Player\'s jump and dash law: Player.ts and SimHost route through player/jump.ts and player/dash.ts', () => {
  const player = readFileSync('src/engine/player/Player.ts', 'utf8'), sim = readFileSync('src/engine/sim.ts', 'utf8');
  for (const call of ['jumpClock(this.jumpState', 'jumpLaw(this.jumpState', 'stepDash(this.dashState', 'stepDodge(this.dodgeState', 'dodgeHeading(', 'dashToward(this.dashState'])
    expect(player).toContain(call);
  expect(player).not.toMatch(/const DOUBLE_JUMP|const DODGE_DIST|this\.dashT\b|jumpsLeft/u);
  for (const call of ['jumpClock(this.playerJump', 'jumpLaw(this.playerJump', 'stepDash(dash', 'stepDodge(dodge', 'dodgeHeading(command.moveX', 'dashToward(this.playerDash'])
    expect(sim).toContain(call);
  expect(readFileSync('src/engine/combat/view/SweptMelee.ts', 'utf8')).toContain('sweptLunge(this.profile.lunge, heavy');
});

it('the jump law: a ground or coyote jump, one double jump, then nothing until the feet land', () => {
  const state: JumpState = { ago: Infinity, left: 0 };
  jumpClock(state, true, DT);
  expect(jump(state, true, 0, 100, false, JUMP_SPEED)).toBe(JUMP_SPEED);
  expect(state.ago).toBe(Infinity);
  jumpClock(state, false, DT);
  expect(jump(state, false, 4, 100, false, JUMP_SPEED)).toBeCloseTo(4 * 0.3 + DOUBLE_JUMP, 12);
  jumpClock(state, false, DT);
  expect(jump(state, false, 2, 100, false, JUMP_SPEED)).toBeNull();
  // walked off a ledge: 6 steps of grace at 60 Hz (the client's float clock), crouching refuses the ground jump
  const off: JumpState = { ago: 0, left: 1 };
  for (let tick = 0; tick < 5; tick++) jumpClock(off, false, DT);
  expect(jump({ ...off }, false, -1, 100, false, JUMP_SPEED)).toBe(JUMP_SPEED);
  expect(jump({ ...off }, false, -1, 100, true, JUMP_SPEED)).toBe(DOUBLE_JUMP);
  jumpClock(off, false, DT);
  expect(jump(off, false, -1, 100, false, JUMP_SPEED)).toBe(DOUBLE_JUMP);
});

it('jumps and double jumps on the client Player\'s vertical law, standing still', () => {
  const host = flat(), { player, physics, dispose } = client();
  let jumps = 0;
  host.events.on('player.jump', () => { jumps++; }, host.scope);
  try {
    for (let tick = 0; tick < 5; tick++) { physics.step(); player.step(DT, command(0, 0, false, false)); }
    // the two capsules creep differently at rest (radius, snap): the arcs are compared from the takeoff, the vertical
    // speed exactly while in the air
    let airborne = 0, hostBase = 0, clientBase = 0;
    for (let tick = 0; tick < 120; tick++) {
      const press = tick === 10 || tick === 30 || tick === 40;
      if (tick === 10) { hostBase = host.player.position.y; clientBase = player.position.y; }
      physics.step(); player.step(DT, command(0, 0, press, false));
      host.step({ ...still, ...(press ? { jump: true } : {}) });
      expect(host.playerFall.grounded).toBe(player.onGround);
      if (tick >= 10 && !player.onGround) {
        expect(host.playerFall.vy).toBe(player.velocity.y);
        expect(host.player.position.y - hostBase).toBeCloseTo(player.position.y - clientBase, 9);
        airborne++;
      }
    }
    expect(airborne).toBeGreaterThan(60);
    expect(jumps).toBe(2); // the third press (tick 40, in the air) is refused
    expect(host.playerFall).toEqual({ vy: 0, grounded: true });
  } finally { dispose(); host.dispose(); }
});

it('takes the coyote jump off a ledge and refuses the press after the window', () => {
  const run = (pressAfter: number): number => {
    const host = flat({ x: 0, y: 1.5, z: -20 });
    try {
      // the jump clocks start at the host's first JUMP press (a hop on the deck): a first press already in the air has no
      // coyote window, every later one is the client's
      host.step({ ...still, jump: true });
      for (let tick = 0; tick < 60; tick++) host.step(still);
      expect(host.playerFall.grounded).toBe(true);
      let left = -1, tick = 0, vy = 0;
      for (; tick < 300; tick++) {
        const press = left >= 0 && tick === left + pressAfter;
        host.step({ moveX: 0, moveZ: 1, yaw: 0, ...(press ? { jump: true } : {}) });
        if (left < 0 && !host.playerFall.grounded) left = tick;
        if (press) { vy = host.playerFall.vy; break; }
      }
      return vy;
    } finally { host.dispose(); }
  };
  expect(run(2)).toBeCloseTo(JUMP_SPEED - 22 * DT, 9); // 3 steps after the edge: the ground jump
  expect(run(8)).toBeGreaterThan(DOUBLE_JUMP - 22 * DT - 1e-9); // past the window: the double jump instead
});

it('dodges as the client Player does: 3 m in 0.25 s toward the stick, a backstep with none, on its cooldown, i-frames', () => {
  const host = flat(), { player, physics, dispose } = client();
  let dodges = 0;
  host.events.on('player.dodge', () => { dodges++; }, host.scope);
  try {
    for (let tick = 0; tick < 5; tick++) { physics.step(); player.step(DT, command(0, 0, false, false)); }
    // the stick: right; the client's dodge reads the live stick (touchMove), the host its world command
    player.touchMove = { x: 1, y: 0 };
    let iframes = 0;
    for (let tick = 0; tick < 20; tick++) {
      const press = tick === 0 || tick === 5; // the second press is on the cooldown
      physics.step(); player.step(DT, command(0, 0, false, press));
      host.step({ moveX: press ? 1 : 0, moveZ: 0, yaw: 0, ...(press ? { dodge: true } : {}) });
      if (tick < 15) { expect(host.player.position.x).toBeCloseTo(player.position.x, 6); expect(host.player.position.z).toBeCloseTo(player.position.z, 6); }
      expect(host.playerDodge.t > 0).toBe(player.dodging);
      if (host.player.health.state.includes('state.dodging')) iframes++;
    }
    expect(dodges).toBe(1);
    expect(iframes).toBe(Math.round(DODGE_TIME / DT)); // the press step's 0.25 s run down from that step: 15 steps
    expect(host.player.position.x).toBeCloseTo(DODGE_DIST + 0.05, 1); // 15 full steps (0.25 s less 15 steps leaves a hair) + the braking quarter
    expect(Math.abs(host.player.position.z)).toBeLessThan(1e-6);
    // the cooldown runs on idle ticks too; ready again after DODGE_COOLDOWN, a backstep (no stick) goes +z (yaw 0)
    for (let tick = 0; tick < Math.ceil(DODGE_COOLDOWN / DT); tick++) host.step();
    expect(host.playerDodge).toEqual({ cd: 0, t: 0 });
    const z = host.player.position.z;
    host.step({ ...still, dodge: true });
    for (let tick = 0; tick < 20; tick++) host.step(still);
    expect(host.player.position.z - z).toBeCloseTo(DODGE_DIST + 0.05, 1);
    expect(dodges).toBe(2);
  } finally { dispose(); host.dispose(); }
});

it('ends a dash at a wall, on the board, and under a knockback', () => {
  const host = flat({ x: 6, y: 0, z: 0 });
  try {
    host.step({ moveX: 1, moveZ: 0, yaw: 0, dodge: true });
    let ticks = 1;
    for (; ticks < 20 && host.playerDash.t > 0; ticks++) host.step(still);
    expect(ticks).toBeLessThan(10); // the wall, not the clock (15 steps), ended it
    expect(host.playerDash.t).toBe(0);
    expect(host.player.position.x).toBeLessThan(8 - 0.2 - 0.3);
    for (let tick = 0; tick < 60; tick++) host.step(still);
    host.step({ moveX: -1, moveZ: 0, yaw: 0, dodge: true });
    host.shovePlayer(10, 0, 6);
    expect(host.playerDash.t).toBe(0);
    for (let tick = 0; tick < 60; tick++) host.step(still);
    host.step({ ...still, hover: true });
    host.step({ moveX: 1, moveZ: 0, yaw: 0, dodge: true });
    expect(host.playerDash.t).toBe(0); expect(host.playerDodge.cd).toBe(0); // no dodge on the board
    expect(host.dashTo(host.player.position.x - 5, 0, 1, 0.1)).toBe(false);
  } finally { host.dispose(); }
});

it('lunges with sweptLunge onto a target, stopping short of it; out of range there is no lunge', () => {
  const lunge = SWORD_WOOD.lunge;
  expect(sweptLunge(lunge, false, 0, -10, 0.5)).toBeNull();
  expect(sweptLunge(lunge, true, 0, -(lunge.heavyRange + 0.4), 0.5)).not.toBeNull();
  const dash = sweptLunge(lunge, false, 0, -4, 0.5);
  expect(dash).toEqual({ stopAt: 0.5 + lunge.stop, time: Math.max(lunge.minTime, Math.min(lunge.maxTime, (4 - 0.5 - lunge.stop) / lunge.speed)) });
  const host = flat();
  try {
    if (dash === null) throw new Error('in range');
    expect(host.dashTo(0, -4, dash.stopAt, dash.time)).toBe(true);
    for (let tick = 0; tick < 30; tick++) host.step(still);
    expect(Math.hypot(host.player.position.x, host.player.position.z + 4)).toBeCloseTo(dash.stopAt, 0);
    expect(host.dashTo(0, -4, dash.stopAt, dash.time)).toBe(false); // already that close
  } finally { host.dispose(); }
});

it('keeps jump, dash and dodge in the strict snapshot and continues exactly; a host that never uses them keeps its bytes', () => {
  const host = flat(), plain = flat();
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 40; tick++) plain.step({ moveX: 0.5, moveZ: -1, yaw: 0 });
    const bare = snapshotSimHost(plain);
    for (const key of ['jump', 'dash', 'dodge']) expect(Object.keys(bare.player)).not.toContain(key);
    host.step({ moveX: 1, moveZ: 0, yaw: 0, jump: true });
    host.step({ moveX: 1, moveZ: 0, yaw: 0, dodge: true });
    host.step({ moveX: 1, moveZ: 0, yaw: 0 });
    const saved = serializeSimSnapshot(snapshotSimHost(host)), decoded = decodeSimSnapshot(saved);
    expect(decoded.player.jump).toEqual({ ago: null, left: 1 });
    expect(decoded.player.dash?.t).toBeGreaterThan(0); expect(decoded.player.dodge?.cd).toBeGreaterThan(0);
    restored = restoreSimHost(FLAT, { rapier }, decoded, (fresh) => { fresh.setHeightQuery(PORTS.heightAt); fresh.setFloorQuery(() => undefined); });
    for (let tick = 0; tick < 120; tick++) {
      const c: SimCommand = { moveX: tick < 60 ? -1 : 0, moveZ: 0.3, yaw: 0, ...(tick === 5 ? { jump: true } : {}), ...(tick === 70 ? { dodge: true } : {}) };
      host.step(c); restored.step(c);
    }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    // refused: a dash that is over, an idle dodge clock, a jump with two air jumps
    for (const mutate of [
      (s: ReturnType<typeof snapshotSimHost>) => { s.player.dash = { t: 0, vx: 1, vz: 0 }; },
      (s: ReturnType<typeof snapshotSimHost>) => { s.player.dodge = { cd: 0, t: 0 }; },
    ]) { const bad = snapshotSimHost(host); mutate(bad); expect(() => restoreSimHost(FLAT, { rapier }, bad).dispose()).toThrow(/registrations/u); }
    const wire = JSON.parse(saved) as { snapshot: { player: Record<string, unknown> } };
    wire.snapshot.player['jump'] = { ago: 0, left: 2 };
    expect(() => decodeSimSnapshot(JSON.stringify(wire))).toThrow();
  } finally { host.dispose(); plain.dispose(); restored?.dispose(); }
});

it('carries jump, dodge and the heavy hold on the tick protocol, strictly; advance refuses the presses', () => {
  const ok = { kind: 'player', moveX: 0, moveZ: 0, yaw: 0 } as const;
  expect(tickCommands([{ source: 'tape', commands: [{ ...ok, jump: true, dodge: true, heavy: { targetId: 'boar:1' } }] }], 1)).toHaveLength(1);
  expect(v.safeParse(TickCommandSchema, { ...ok, heavy: {} }).success).toBe(true);
  for (const bad of [{ ...ok, jump: false }, { ...ok, dodge: 1 }, { ...ok, heavy: true }, { ...ok, heavy: { targetId: '' } }, { ...ok, heavy: { charge: 1 } }])
    expect(v.safeParse(TickCommandSchema, bad).success).toBe(false);
  const host = flat();
  try {
    expect(() => host.advance(DT, { ...still, jump: true })).toThrow(/press/u);
    expect(() => host.advance(DT, { ...still, dodge: true })).toThrow(/press/u);
    expect(() => host.dashTo(Number.NaN, 0, 1, 0.1)).toThrow(RangeError);
  } finally { host.dispose(); }
});
