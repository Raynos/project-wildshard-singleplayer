// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM and read the client Player's source in Node.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { PerspectiveCamera, Vector3 } from 'three';
import { createSimHost, type SimCommand, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { groups } from '../../src/engine/physics/groups';
import { Physics } from '../../src/engine/physics/Physics';
import { HOVER_HEIGHT } from '../../src/engine/player/board';
import { HARD_FALL_DAMAGE } from '../../src/engine/player/fall';
import { Player } from '../../src/engine/player/Player';
import type { PlayerCommand } from '../../src/engine/input/commands';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { TickCommandSchema } from '../../src/sdk/tickProtocol';
import { legacyDouble } from '../fake/FakeGame';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const restoreTerrain = overrideTerrain({ heightAt: () => -1000 });
afterAll(restoreTerrain);

/** A structures-only sky (Sky Reach's shape): no ground collider, the analytic floor 1000 m down, no creature. */
const SKY: SimLevel = { ...SIM_LEVEL, id: 'sim-board-sky', entities: [], quests: [], player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 4 } };
const PORTS = { ground: false, heightAt: () => -1000 } as const;
const north = (moveZ = -1): SimCommand => ({ moveX: 0, moveZ, yaw: 0 });
const hover: SimCommand = { moveX: 0, moveZ: 0, yaw: 0, hover: true };

/** Sunrest (8 × 8 m) and a long far island, tops at y = 0, 10 m apart along -z, and a board-only deck (a hover bridge) across the gap. */
function sky(): { host: SimHost; bridge: number } {
  const host = createSimHost(SKY, { ...PORTS, rapier }), R = rapier, world = host.physics.world;
  world.createCollider(R.ColliderDesc.cuboid(4, 1, 4).setTranslation(0, -1, 0).setCollisionGroups(groups('WORLD')));
  world.createCollider(R.ColliderDesc.cuboid(4, 1, 30).setTranslation(0, -1, -44).setCollisionGroups(groups('WORLD')));
  const deck = world.createCollider(R.ColliderDesc.cuboid(1.5, 0.1, 5).setTranslation(0, -0.1, -9).setCollisionGroups(groups('WORLD')));
  host.boardColliders([deck]);
  host.setFloorQuery(() => undefined);
  host.player.position.set(0, 0, 2); host.player.motor.resetAt(host.player.position);
  return { host, bridge: deck.handle };
}

it('is the client Player\'s board law: Player.ts routes its board step through player/board.ts', () => {
  const player = readFileSync('src/engine/player/Player.ts', 'utf8');
  expect(player).toContain('stepBoard(this.position, this.velocity, impulse, want, this,');
  expect(player).toContain('boardShoved(this, worldVelocityMps.y)');
  expect(player).not.toMatch(/HOVER_SPRING_K \* err|const HOVER_ACCEL|const HOVER_JUMP_GRAVITY/u);
  expect(readFileSync('src/engine/sim.ts', 'utf8')).toContain('stepBoard(this.player.position, this.boardVelocity, this.playerImpulse');
});

it('crosses a board-only bridge on the board, and falls through the gap on foot', () => {
  const foot = sky(), board = sky();
  try {
    expect(foot.host.physics.world.getCollider(foot.bridge).isEnabled()).toBe(false);
    board.host.step(hover);
    expect(board.host.playerBoard.on).toBe(true);
    expect(board.host.physics.world.getCollider(board.bridge).isEnabled()).toBe(true);
    for (let tick = 0; tick < 240; tick++) { foot.host.step(north()); if (tick < 130) board.host.step(north()); }
    expect(foot.host.player.position.y).toBeLessThan(-20); // walked off Sunrest's rim into the void
    const p = board.host.player.position;
    expect(p.z).toBeLessThan(-16); // over the far island
    expect(Math.abs(p.y - HOVER_HEIGHT)).toBeLessThan(0.1); // riding at the ride height the whole way
    expect(board.host.boardVelocity.length()).toBeGreaterThan(10);
    // released, the board coasts to rest at the ride height (the client's glide)
    for (let tick = 0; tick < 600; tick++) board.host.step(north(0));
    expect(board.host.boardVelocity.length()).toBeLessThan(1e-3);
    expect(p.z).toBeGreaterThan(-74); expect(Math.abs(p.y - HOVER_HEIGHT)).toBeLessThan(0.1);
    // stepping off: the board's colliders stop colliding, the feet drop from the ride height and stand on the island
    board.host.step(hover);
    expect(board.host.physics.world.getCollider(board.bridge).isEnabled()).toBe(false);
    for (let tick = 0; tick < 60; tick++) board.host.step(north(0));
    expect(board.host.player.position.y).toBeCloseTo(0, 1);
    expect(board.host.playerFall).toEqual({ vy: 0, grounded: true });
    expect(board.host.player.health.attributes.health).toBe(100);
  } finally { foot.host.dispose(); board.host.dispose(); }
});

it('lifts off on an upward shove (the updraft), flies ballistic, lands hard past 9 m/s, and ignores a creature knockback', () => {
  const { host } = sky();
  try {
    host.step(hover);
    for (let tick = 0; tick < 60; tick++) host.step(north(0));
    host.shovePlayer(0, 5, 9);
    expect(host.playerShove.t).toBe(0); // the client Player ignores knockback on the board
    host.impulsePlayer(new Vector3(0, 30, 0));
    expect(host.playerBoard.hoverAir).toBe(true); expect(host.playerBoard.onGround).toBe(false);
    let peak = 0, ticks = 0;
    while (host.playerBoard.hoverAir && ticks < 600) { host.step(north(0)); peak = Math.max(peak, host.player.position.y); ticks++; }
    expect(peak).toBeGreaterThan(5);
    expect(host.player.position.y).toBeLessThan(HOVER_HEIGHT + 0.06);
    expect(host.player.health.attributes.health).toBe(100 - HARD_FALL_DAMAGE);
    expect(host.boardVelocity.y).toBeLessThan(-9); // a real flight's landing keeps its speed: the spring takes it, with its dip
  } finally { host.dispose(); }
});

it('rides a steady updraft lift without running away: a same-tick touchdown spends its fall, no hard landing (SF72)', () => {
  // Sky Reach's far.updraft feeds UPDRAFT_LIFT * dt of upward impulse every tick in its column: every tick shoves the
  // board airborne and it touches down the same tick; the downward speed used to carry over and grow 0.25 m/s a tick
  // until every touchdown past 9 m/s was a hard landing (dead in ~1.6 s in the browser, hurt headless)
  const { host } = sky();
  try {
    host.step(hover);
    for (let tick = 0; tick < 60; tick++) host.step(north(0));
    let low = 0;
    for (let tick = 0; tick < 600; tick++) { host.impulsePlayer(new Vector3(0, 12 / 60, 0)); host.step(north(0)); low = Math.min(low, host.boardVelocity.y); }
    expect(low).toBeGreaterThan(-1);
    expect(host.player.health.attributes.health).toBe(100);
    expect(Math.abs(host.player.position.y - HOVER_HEIGHT)).toBeLessThan(0.5);
  } finally { host.dispose(); }
});

it('rides bit-identically to the client Player on the same world and stick', () => {
  // the same world in both: a flat 40 m slab and a low deck the spring rides onto (under the board, never against the
  // capsule's side: the two motors' capsules differ, so a contact would differ)
  const build = (physics: Physics): void => {
    physics.world.createCollider(rapier.ColliderDesc.cuboid(40, 1, 40).setTranslation(0, -1001, 0).setCollisionGroups(groups('WORLD')));
    physics.world.createCollider(rapier.ColliderDesc.cuboid(4, 0.06, 4).setTranslation(0, -999.94, -16).setCollisionGroups(groups('WORLD')));
  };
  const host = createSimHost({ ...SKY, player: { ...SKY.player, at: { x: 0, y: -1000 + HOVER_HEIGHT, z: 0 } } }, { ...PORTS, rapier });
  build(host.physics);
  const physics = new Physics(rapier); build(physics);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  try {
    player.spawn(0, 0, 0, -1000 + HOVER_HEIGHT); player.setHover(true); // at the ride height: no capsule contact at the start
    let same = 0;
    for (let tick = 0; tick < 400; tick++) {
      const fwd = tick < 150 ? 1 : tick < 200 ? 0 : 1, str = tick >= 220 && tick < 300 ? 0.6 : 0, yaw = tick >= 250 ? Math.sin(tick * 0.02) * 0.5 : 0;
      // the client's stick → world move (Player.stepCommand), handed to SimHost as its resolved world command
      const sin = Math.sin(yaw), cos = Math.cos(yaw), mx = -sin * fwd + cos * str, mz = -cos * fwd - sin * str;
      const command: PlayerCommand = { moveX: str, moveY: fwd, yaw, pitch: 0, crouch: false, sprint: false, jump: false, dodge: false, dive: false, surface: false,
        aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
      if (tick === 120) { player.impulse(new Vector3(0, 6, 0)); host.impulsePlayer(new Vector3(0, 6, 0)); }
      physics.step(); player.step(1 / 60, command);
      host.step({ moveX: mx, moveZ: mz, yaw, ...(tick === 0 ? { hover: true } : {}) });
      expect(host.player.position.toArray()).toEqual(player.position.toArray());
      expect(host.boardVelocity.toArray()).toEqual(player.velocity.toArray());
      expect([host.playerBoard.hoverAir, host.playerBoard.hoverBob, host.playerBoard.onGround]).toEqual([player.hoverAir, player.hoverBob, player.onGround]);
      same++;
    }
    expect(same).toBe(400);
    expect(player.position.z).toBeLessThan(-20); // crossed the deck
    expect(player.position.y).toBeLessThan(-999);
  } finally { player.motor.dispose(); physics.dispose(); host.dispose(); }
});

it('keeps the ride in the strict snapshot and continues it exactly; a host that never boards keeps its bytes', () => {
  const { host } = sky(), plain = createSimHost(SKY, { ...PORTS, rapier });
  let restored: SimHost | undefined;
  try {
    const bare = snapshotSimHost(plain);
    expect(bare.player.board).toBeUndefined(); expect(bare.boardColliders).toBeUndefined();
    expect(Object.keys(bare)).not.toContain('boardColliders'); expect(Object.keys(bare.player)).not.toContain('board');
    host.step(hover);
    for (let tick = 0; tick < 70; tick++) host.step(north());
    host.impulsePlayer(new Vector3(0, 12, 0)); host.step(north());
    expect(host.playerBoard.hoverAir).toBe(true);
    const saved = serializeSimSnapshot(snapshotSimHost(host)), decoded = decodeSimSnapshot(saved);
    expect(decoded.player.board?.air).toBe(true); expect(decoded.boardColliders).toEqual(host.boardColliderHandles());
    // the fresh host reinstalls the level's ports, as the headless runtime's install does (heightAt, the floor query)
    restored = restoreSimHost(SKY, { rapier }, decoded, (fresh) => { fresh.setHeightQuery(PORTS.heightAt); fresh.setFloorQuery(() => undefined); });
    for (let tick = 0; tick < 200; tick++) { const c = tick === 150 ? hover : north(tick < 100 ? -1 : 0); host.step(c); restored.step(c); }
    expect(host.playerBoard.on).toBe(false);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    // refused: a ride with a live fall beside it, an empty handle list, a missing handle, a held (false) press
    const bad = snapshotSimHost(host); bad.player.board = { velocity: [0, 0, 0], air: false, bob: 0, ground: true }; bad.player.fall = { vy: -1, grounded: false };
    expect(() => restoreSimHost(SKY, { rapier }, bad)).toThrow('Snapshot instance registrations do not match');
    const empty = snapshotSimHost(host); empty.boardColliders = [];
    expect(() => restoreSimHost(SKY, { rapier }, empty)).toThrow('Snapshot instance registrations do not match');
    const missing = snapshotSimHost(host); missing.boardColliders = [new Float64Array(new Uint32Array([500, 0]).buffer)[0] ?? 0]; // collider index 500: none
    expect(() => restoreSimHost(SKY, { rapier }, missing)).toThrow('Snapshot board collider does not exist');
  } finally { restored?.dispose(); host.dispose(); plain.dispose(); }
});

it('takes the HOVER press as one tick\'s input in the host and the tick protocol', () => {
  const { host } = sky();
  try {
    expect(() => { host.advance(1 / 60, hover); }).toThrow('advance repeats its command');
    expect(v.parse(TickCommandSchema, { kind: 'player', moveX: 0, moveZ: 0, yaw: 0, hover: true })).toEqual({ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, hover: true });
    expect(() => v.parse(TickCommandSchema, { kind: 'player', moveX: 0, moveZ: 0, yaw: 0, hover: false })).toThrow();
    expect(() => { host.boardColliders([{ handle: host.boardColliderHandles()[0] ?? -1 }]); }).toThrow('Invalid board-only collider');
  } finally { host.dispose(); }
});
