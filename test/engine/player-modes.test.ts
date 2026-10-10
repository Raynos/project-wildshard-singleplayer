import { afterAll, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { PlayerHealth, type PlayerMode } from '../../src/engine/combat/health';
import { Events } from '../../src/engine/events/events';
import type { PlayerCommand } from '../../src/engine/input/commands';
import type { InputContextDef } from '../../src/engine/level/context';
import { Physics } from '../../src/engine/physics/Physics';
import { groups } from '../../src/engine/physics/groups';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Player } from '../../src/engine/player/Player';
import { playerModes, type ModePlayer, type PlayerModeDriver } from '../../src/engine/player/modes';
import { WorldRegistry, type Piece } from '../../src/engine/world/registry';
import { basinBody } from '../../src/engine/world/water/body';
import { currentHeadlessMode, currentPlayerMode, enterHeadlessMode, enterPlayerMode, exitHeadlessMode, exitPlayerMode, registerHeadlessMode, registerPlayerMode } from '../../src/sdk/playerModes';
import { createSimHost, SIM_API_VERSION, type SimCommand, type SimLevel } from '../../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { DRIFTWOOD_SEA } from '../../src/shards/driftwood-isle/world/sea';
import { RIVER, TERRAIN } from '../../src/shards/nalati-grasslands/world/terrain';
import { legacyDouble } from '../fake/FakeGame';
import { installPortableMath } from '../fake/portableMath';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

/** The water law's tape fingerprint at Driftwood's level, recorded on a1df49498 (Player.ts untouched by SF34). */
const SWIM_PRINT = 'fc9acbc:8400';
const restoreMath = installPortableMath();
afterAll(() => { restoreMath(); });

const driver = (): PlayerModeDriver => ({ drive: () => undefined, step: () => undefined, pose: () => undefined, dismount: () => undefined });
const fakePlayer = (): ModePlayer => ({ ride: null, hover: false, swimming: false, wading: false });

describe('SF34 player modes', () => {
  it('reads the motor mode and hands the frame to an entered driver through the Player\'s ride slot', () => {
    const player = fakePlayer(), modes = playerModes(player), scope = new Scope('modes');
    expect(modes.current()).toBe('foot');
    Object.assign(player, { wading: true }); expect(modes.current()).toBe('wade');
    Object.assign(player, { swimming: true }); expect(modes.current()).toBe('swim');
    Object.assign(player, { hover: true }); expect(currentPlayerMode(player)).toBe('board');
    Object.assign(player, { hover: false, swimming: false, wading: false });
    const calls: string[] = [];
    const ride = registerPlayerMode({ player }, { id: 'ride', hud: 'ride', enter: () => { calls.push('enter'); }, exit: () => { calls.push('exit'); } }, scope);
    const saddle = driver();
    enterPlayerMode(player, 'ride', saddle);
    expect(player.ride).toBe(saddle); expect(ride.active).toBe(true); expect(currentPlayerMode(player)).toBe('ride');
    expect(() => { enterPlayerMode(player, 'grapple', driver()); }).toThrow('holds the frame');
    exitPlayerMode(player, 'grapple'); expect(player.ride).toBe(saddle); // not the holder: a no-op
    exitPlayerMode(player, 'ride');
    expect(player.ride).toBeNull(); expect(currentPlayerMode(player)).toBe('foot'); expect(calls).toEqual(['enter', 'exit']);
    ride.enter(saddle); scope.dispose();
    expect(player.ride).toBeNull(); expect(calls).toEqual(['enter', 'exit', 'enter', 'exit']); // the scope's end hands the frame back
  });

  it('answers the traversal ask as a grapple mode, passing an earlier answer through, and pushes its context', () => {
    const player = fakePlayer(), events = new Events(), scope = new Scope('grapple');
    const stack: string[] = [], registered: string[] = [];
    const input = { register: (def: InputContextDef) => { registered.push(def.id); }, push: (id: string) => { stack.push(id); }, pop: (id: string) => { stack.splice(stack.indexOf(id), 1); } };
    let flying = false;
    const grapple = registerPlayerMode({ player, events, input }, { id: 'grapple', hud: 'lock', context: { id: 'grapple', actions: ['lock', 'jump'] }, traverse: () => flying }, scope);
    expect(registered).toEqual(['grapple']);
    expect(events.ask('player.traversal', 1 / 60)).toBe(false); expect(grapple.active).toBe(false);
    flying = true;
    expect(events.ask('player.traversal', 1 / 60)).toBe(true); expect(currentPlayerMode(player)).toBe('grapple');
    expect(events.ask('player.traversal', true)).toBe(true); // an earlier answer stands
    flying = false; events.ask('player.traversal', 1 / 60); expect(currentPlayerMode(player)).toBe('foot');
    grapple.context(true); grapple.context(true); expect(stack).toEqual(['grapple']);
    grapple.context(false); expect(stack).toEqual([]);
    scope.dispose(); expect(events.ask('player.traversal', 1 / 60)).toBe(1 / 60); // no answer once the mode's scope ends
  });

  it('collides a mode piece only in its player mode (Sky Reach\'s hover decks: mode board)', () => {
    const scope = new Scope('piece-mode'), previous = app.levelScope;
    app.levelScope = scope;
    let mode: PlayerMode = 'foot';
    app.registerPlayer(new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false, mode: () => mode }), scope);
    try {
      const registry = new WorldRegistry(), deck: Piece = registry.add({ id: 'deck', name: 'deck', category: 'buildings', file: 'test', mode: 'board' });
      const active = deck.active ?? (() => { throw new Error('mode piece without active'); });
      expect(active()).toBe(false); mode = 'board'; expect(active()).toBe(true); mode = 'swim'; expect(active()).toBe(false);
      expect(() => registry.add({ id: 'both', name: 'both', category: 'buildings', file: 'test', mode: 'board', active: () => true })).toThrow('both mode and active');
    } finally { scope.dispose(); app.levelScope = previous; }
  });
});

/** FNV-1a over every recorded float's bytes. */
function fingerprint(values: readonly number[]): string {
  const bytes = new Uint8Array(new Float64Array(values).buffer);
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16)}:${values.length}`;
}

/** A shard's water at one site: its rest level there, from the shard's own registered water body. */
function siteLevel(body: { restAt: (x: number, z: number) => number | null }, sites: readonly (readonly [number, number])[]): number {
  for (const [x, z] of sites) { const level = body.restAt(x, z); if (level !== null) return level; }
  throw new Error('No water at any probed site');
}

/**
 * The client Player's water law on recorded input, over one shard's water level: a shelf 1 m under the surface (wading)
 * that drops off at z = -10 into 3 m (swimming), walked off north, swum on and back (DIVE held, then SURFACE), and climbed
 * out onto the shelf again. Every step's pose relative to the water, velocity and mode go into the trace.
 */
async function swimTape(level: number): Promise<{ values: number[]; modes: string[]; steps: number[] }> {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  const shelf = level - 1, deep = level - 3;
  physics.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, deep - 0.5, 0).setCollisionGroups(groups('WORLD')));
  physics.world.createCollider(R.ColliderDesc.cuboid(20, (shelf - deep) / 2, 15).setTranslation(0, (shelf + deep) / 2, 5).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.bindFrame(physics, player.motor, { heightAt: (_x, z) => (z > -10 ? shelf : deep), waterSurfaceAt: () => level, platforms: [] });
  const scope = new Scope('player-swim-tape'), previous = app.levelScope;
  app.levelScope = scope;
  app.registerPlayer(new PlayerHealth(app.events, { now: () => 0, position: () => player.position, dodging: () => false, dodgeGuard: () => false }), scope);
  const values: number[] = [], modes: string[] = [], steps: number[] = [];
  try {
    player.spawn(0, -2, 0, shelf);
    for (let i = 0; i < 1200; i++) {
      const moveY = i < 30 ? 0 : i < 460 ? 1 : i < 640 ? 0 : i < 1190 ? -1 : 0; // north off the shelf, then back south
      const command: PlayerCommand = { moveX: i >= 600 && i < 640 ? 0.6 : 0, moveY, yaw: 0, pitch: 0, crouch: false, sprint: i < 200, jump: i === 60,
        dodge: false, dive: i >= 470 && i < 530, surface: i >= 540 && i < 600, aim: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 } } };
      physics.step();
      player.step(1 / 60, command);
      const mode = currentPlayerMode(player);
      if (modes.at(-1) !== mode) { modes.push(mode); steps.push(i); }
      values.push(player.position.x, player.position.y - level, player.position.z, player.velocity.x, player.velocity.y, player.velocity.z, player.onGround ? 1 : 0);
    }
  } finally { scope.dispose(); app.levelScope = previous; player.motor.dispose(); physics.dispose(); }
  return { values, modes, steps };
}

describe('SF34 swim and wade parity (Driftwood, Nalati)', () => {
  // the two shards' registered water bodies: Driftwood's lowered open sea, Nalati's Kunes basin (the river)
  const driftwood = siteLevel(DRIFTWOOD_SEA, [[0, 400], [400, 0], [-400, 0], [0, -400]]);
  const nalati = siteLevel(basinBody('river', TERRAIN), Array.from({ length: 41 }, (_, i) => [i * 25 - 500, RIVER.z(i * 25 - 500)] as const));

  it('runs one water law: the same walk into the water wades, swims, dives and wades out alike on both shards', async () => {
    const a = await swimTape(driftwood), b = await swimTape(nalati);
    expect(driftwood).not.toBe(nalati);
    // the jump at step 60 leaves the water a moment; standing up out of the swim is one tick on foot before the wade
    expect(a.modes).toEqual(['wade', 'foot', 'wade', 'swim', 'foot', 'wade']);
    expect(b.modes).toEqual(a.modes);
    expect(b.steps).toEqual(a.steps); // every switch on the same tick
    expect(b.values.length).toBe(a.values.length);
    // the same trace relative to each shard's surface: the levels differ by 10 m, so Rapier's f32 contacts round apart and
    // the walk drifts a few centimetres over 20 s (measured 0.0395 m); the law itself is one
    const worst = a.values.reduce((max, value, i) => Math.max(max, Math.abs(value - (b.values[i] ?? Number.NaN))), 0);
    expect(worst).toBeLessThan(0.05);
  });

  it('keeps the recorded water law (fingerprint over the Driftwood-level tape, recorded on a1df49498)', async () => {
    expect(fingerprint((await swimTape(driftwood)).values)).toBe(SWIM_PRINT);
  });
});


/** A bare headless level: no creatures, the player standing at (0, -2) on the shelf. */
function swimLevel(shelf: number): SimLevel {
  return { version: SIM_API_VERSION, id: 'swim-tape', seed: 1, ground: { size: 200, height: shelf }, player: { at: { x: 0, y: shelf, z: -2 }, yaw: 0, speed: 4.3 },
    entities: [], quests: [], weapon: { id: 'probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
}
/** The browser tape's command at step i, as the headless host's world-space command (north = -z). */
function swimCommand(i: number): SimCommand {
  const moveY = i < 30 ? 0 : i < 460 ? 1 : i < 640 ? 0 : i < 1190 ? -1 : 0;
  return { moveX: i >= 600 && i < 640 ? 0.6 : 0, moveZ: -moveY, yaw: 0, ...(i === 60 ? { jump: true } : {}),
    dive: i >= 470 && i < 530, surface: i >= 540 && i < 600 };
}
/**
 * The same walk into the water on the headless host (SimHost.useWater: the shared water law, player/swim.ts), over one
 * shard's water level and the browser tape's shelf and drop-off; `restoreAt` snapshots and restores the host mid-swim.
 */
async function headlessSwimTape(level: number, restoreAt = -1): Promise<{ values: number[]; modes: string[]; steps: number[] }> {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
  const shelf = level - 1, deep = level - 3, sim = swimLevel(shelf);
  const install = (host: ReturnType<typeof createSimHost>, fresh: boolean): void => {
    if (fresh) {
      host.physics.world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, deep - 0.5, 0).setCollisionGroups(groups('WORLD')));
      host.physics.world.createCollider(R.ColliderDesc.cuboid(20, (shelf - deep) / 2, 15).setTranslation(0, (shelf + deep) / 2, 5).setCollisionGroups(groups('WORLD')));
    }
    host.useWater({ surfaceAt: () => level });
  };
  const ports = { rapier: R, ground: false, heightAt: (_x: number, z: number) => (z > -10 ? shelf : deep) } as const;
  let host = createSimHost(sim, ports);
  install(host, true);
  const values: number[] = [], modes: string[] = [], steps: number[] = [];
  try {
    for (let i = 0; i < 1200; i++) {
      if (i === restoreAt) {
        const saved = snapshotSimHost(host);
        host.dispose();
        host = restoreSimHost(sim, ports, saved, (fresh) => { install(fresh, false); });
      }
      host.step(swimCommand(i));
      const mode = currentHeadlessMode(host);
      if (modes.at(-1) !== mode) { modes.push(mode); steps.push(i); }
      const p = host.player.position, v = host.playerSwim.on ? host.swimVelocity : { x: 0, y: host.playerFall.vy, z: 0 };
      values.push(p.x, p.y - level, p.z, v.x, v.y, v.z, host.playerFall.grounded ? 1 : 0);
    }
  } finally { host.dispose(); }
  return { values, modes, steps };
}

describe('SF34 headless modes and swim (SimHost.modes, SimHost.useWater)', () => {
  const driftwood = siteLevel(DRIFTWOOD_SEA, [[0, 400], [400, 0], [-400, 0], [0, -400]]);
  const nalati = siteLevel(basinBody('river', TERRAIN), Array.from({ length: 41 }, (_, i) => [i * 25 - 500, RIVER.z(i * 25 - 500)] as const));

  it('runs the water law headless: the browser tape wades, swims, dives and wades out alike on both shards', async () => {
    const a = await headlessSwimTape(driftwood), b = await headlessSwimTape(nalati), page = await swimTape(driftwood);
    // the browser's modes in the same order (the headless walk has no acceleration, so the hand-overs land a few ticks apart)
    expect(a.modes).toEqual(page.modes);
    expect(b.modes).toEqual(a.modes);
    expect(b.steps).toEqual(a.steps);
    const worst = a.values.reduce((max, value, i) => Math.max(max, Math.abs(value - (b.values[i] ?? Number.NaN))), 0);
    expect(worst).toBeLessThan(0.05);
    // swimming, both hosts float at the same height under the surface (the law's float depth), settled before the dive
    const at = (tape: { values: number[] }, step: number): number => tape.values[step * 7 + 1] ?? Number.NaN;
    expect(Math.abs(at(a, 465) - at(page, 465))).toBeLessThan(0.05);
  });

  it('restores a swimming host exactly (the swim is snapshot state)', async () => {
    const straight = await headlessSwimTape(driftwood), resumed = await headlessSwimTape(driftwood, 500);
    expect(resumed.values).toEqual(straight.values);
    expect(resumed.modes).toEqual(straight.modes);
  });

  it('enters a driven mode headless: its driver owns the motion ahead of usePlayerDriver, and board colliders follow the mode', async () => {
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    const host = createSimHost(swimLevel(0), { rapier: R }), scope = new Scope('headless-ride');
    try {
      const deck = host.physics.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(0, 3, -8).setCollisionGroups(groups('WORLD')));
      host.boardColliders([deck]);
      expect(deck.isEnabled()).toBe(false);
      host.step({ moveX: 0, moveZ: 0, yaw: 0, hover: true });
      expect(currentHeadlessMode(host)).toBe('board'); expect(deck.isEnabled()).toBe(true);
      host.step({ moveX: 0, moveZ: 0, yaw: 0, hover: true });
      const calls: string[] = [];
      registerHeadlessMode(host, { id: 'ride', hud: 'ride', enter: () => { calls.push('enter'); }, exit: () => { calls.push('exit'); } }, scope);
      let walked = 0;
      host.usePlayerDriver({ input: () => false, step: () => undefined });
      enterHeadlessMode(host, 'ride', { input: () => true, step: () => { walked++; } });
      const before = host.player.position.clone();
      host.step({ moveX: 1, moveZ: 0, yaw: 0 });
      expect(walked).toBe(1); expect(host.player.position.distanceTo(before)).toBe(0); // the saddle owns the frame
      expect(currentHeadlessMode(host)).toBe('ride');
      exitHeadlessMode(host, 'ride');
      host.step({ moveX: 1, moveZ: 0, yaw: 0 });
      expect(walked).toBe(1); expect(host.player.position.x).toBeGreaterThan(before.x); // back on the ordinary walk
      expect(calls).toEqual(['enter', 'exit']);
    } finally { scope.dispose(); host.dispose(); }
  });

  it('keeps a host whose water is everywhere dry on the exact bytes of a host with no water', async () => {
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    const run = (water: boolean): string => {
      const host = createSimHost(swimLevel(0), { rapier: R });
      if (water) host.useWater({ surfaceAt: () => null });
      try {
        for (let i = 0; i < 240; i++) host.step({ moveX: Math.sin(i / 20), moveZ: -1, yaw: 0, ...(i === 30 ? { jump: true } : {}), ...(i === 90 ? { dodge: true } : {}) });
        return JSON.stringify({ ...snapshotSimHost(host), events: null });
      } finally { host.dispose(); }
    };
    expect(run(true)).toBe(run(false));
  });
});
