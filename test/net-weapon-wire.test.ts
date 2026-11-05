// @vitest-environment happy-dom
import { BoxGeometry, MeshBasicMaterial, Vector3 } from 'three';
import type { NetCommand } from '@wildshard/format/netCommand';
import { beforeAll, expect, test, vi } from 'vitest';
import { app } from '../src/engine/client/app/runtime';
import { SweptMelee } from '../src/engine/client/combat/view/SweptMelee';
import { NetClient } from '../src/engine/client/net/client';
import { NetPlayer } from '../src/engine/client/net/netPlayer';
import type { Player } from '../src/engine/client/player/Player';
import type { Forest } from '../src/engine/client/world/forest/Forest';
import type { SkyRig } from '../src/engine/client/world/skyRig';
import { NetRoom } from '../src/engine/server/net/room';
import { SimNetWorld } from '../src/engine/server/net/simWorld';
import { applyMeleeCombatProfile, type MeleeProfile } from '../src/engine/shared/combat/meleeProfile';
import type { OwnHit, WeaponWire } from '../src/engine/shared/combat/Weapon';
import { FIXED_STEP } from '../src/engine/shared/core/fixedStep';
import { Physics } from '../src/engine/shared/physics/Physics';
import type { Rapier } from '../src/engine/shared/physics/rapier';
import { FakeGame, legacyDouble } from '../src/engine/test/FakeGame';
import { ConditionedTransport, directLoopback } from '../src/engine/test/netLoopback';
import { SWORD_WOOD } from '../src/game/server/weapons/starterMeleeProfile';
import { FINISHER, HEAVY, SLASH } from '../src/game/shared/weapons/starterMoves';
import { HostSide, loadCourseRapier, PageSide, type MotionScenario } from './fixtures/motion-trace/parity';

// P1-E5.3-E3, E5 (J47): on a link a weapon predicts the start, and the server's word plays the rest.
let R: Rapier;
beforeAll(async () => { R = await loadCourseRapier(); });

const TICK_MS = FIXED_STEP * 1000, scenario: MotionScenario = { id: 'net-weapon', start: { x: -10, z: 0, yaw: 0 }, ticks: 0, intent: () => ({}), bodyAt: { x: -5, z: 30 } };
const HIT: OwnHit = { kind: 'crab', at: new Vector3(0, 1, -1), head: false, killed: false, amount: 12, seq: 9 };

function sword(wire: WeaponWire): { blade: SweptMelee; stops: ReturnType<typeof vi.fn>; heard: string[]; player: Player; done: () => void } {
  const physics = new Physics(R), was = app.physics, aimed = app.aimTargets, game = new FakeGame().asGame(), stops = vi.fn(), heard: string[] = [];
  app.physics = physics; app.aimTargets = legacyDouble<typeof app.aimTargets>([]);
  vi.spyOn(game, 'hitStop').mockImplementation(seconds => { stops(seconds); });
  const eye = new Vector3(0, 1.68, 0), player = legacyDouble<Player>({ position: new Vector3(), yaw: 0, pitch: 0, fovKick: 0, speedFactor: 0, bobTime: 0, sprinting: false, dashing: false, swinging: false, motor: null, dashTo: () => true,
    sampleAimCommand: () => ({ origin: { x: eye.x, y: eye.y, z: eye.z }, direction: { x: 0, y: 0, z: -1 } }) });
  const profile: MeleeProfile = applyMeleeCombatProfile(SWORD_WOOD, SWORD_WOOD), { moves } = profile;
  if (moves === undefined) throw new Error('The starter sword declares its moves');
  const blade = new SweptMelee({ game, sky: legacyDouble<SkyRig>({}), player, forest: legacyDouble<Forest>({}) }, undefined,
    { row: profile, profile, inputContext: 'weapon.melee', rig: { sword: new BoxGeometry(0.1, 0.1, 0.1), arms: new BoxGeometry(0.1, 0.1, 0.1), tipY: 0.62, baseY: 0.1, material: new MeshBasicMaterial() } },
    { moves, slash: SLASH, finisher: FINISHER, heavy: HEAVY, events: {}, debris: () => ({ surface: 'sand', count: 1, atFeet: true, sparks: false }) });
  blade.setActive(true); blade.enabled = true; blade.wire = wire;
  blade.onHit = kind => { heard.push(kind); };
  return { blade, stops, heard, player, done: () => { app.physics = was; app.aimTargets = aimed; physics.dispose(); } };
}
const wireSpy = (): WeaponWire & { presses: boolean[]; holds: boolean[] } => {
  const presses: boolean[] = [], holds: boolean[] = [];
  return { presses, holds, press: started => { presses.push(started); }, hold: held => { holds.push(held); }, fire: () => undefined, nextSeq: () => 1 };
};

test('a tap starts here at once, and tells the wire whether the server has a start to rule on', () => {
  const wire = wireSpy(), { blade, player, done } = sword(wire);
  try {
    blade.tryFire(); expect(wire.presses).toEqual([true]);
    blade.update(1 / 60, 0); expect(player.swinging).toBe(true);
    blade.tryFire(); expect(wire.presses).toEqual([true, false]); // queued on the running swing, which goes on regardless
    expect(wire.holds.at(-1)).toBe(false);
  } finally { done(); }
});

test('the server\'s hit plays the blow once, and a refusal lets the swing go at once', () => {
  const wire = wireSpy(), { blade, stops, heard, player, done } = sword(wire);
  try {
    blade.tryFire(); blade.update(1 / 60, 0);
    expect(stops).not.toHaveBeenCalled();
    blade.serverHit(HIT); blade.serverHit({ ...HIT, seq: 10 });
    expect(stops).toHaveBeenCalledTimes(1); expect(heard).toEqual(['crab', 'crab']);
    blade.attackRefused(); blade.update(1 / 60, 1 / 60);
    expect(player.swinging).toBe(false);
  } finally { done(); }
});

/** mulberry32. */
const seeded = (seed: number): (() => number) => { let a = seed; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test('over a bad link a start with no answer is refused inside RTT and two frames', () => {
  // the course's host has no weapon, so no swing can ever start there
  const page = new PageSide(R, scenario), host = new HostSide(R, scenario), link = directLoopback(), random = seeded(1), jitter = { latencyMs: 75, jitterMs: 30, lossPct: 2, reorderPct: 1, random };
  const up = new ConditionedTransport(link.client, jitter), down = new ConditionedTransport(link.server, jitter), client = new NetClient(up), { player } = page;
  const room = new NetRoom({ world: new SimNetWorld(host.host), step: inputs => {
    const commands = new Map<string, NetCommand>();
    for (const row of inputs) if (row.command !== null) commands.set(row.player, row.command);
    host.host.step(commands);
  } });
  room.join(down); client.hello();
  const pass = (): void => { up.advance(TICK_MS); down.advance(TICK_MS); link.pump(); };
  for (let at = 0; at < 30; at++) { pass(); if (at === 12) room.open(); room.tick(); }
  const net = new NetPlayer(client, player, page.physics), refusals: number[] = [];
  let tick = 0, pressedAt = 0;
  const hits: OwnHit[] = [];
  net.bindWeapons({ bindWire: () => undefined, serverHit: hit => { hits.push(hit); }, attackRefused: () => { refusals.push(tick - pressedAt); } });
  player.link = net; player.locked = true;
  for (; tick < 600; tick++) {
    pass(); net.reconcile(); page.stepWorld(); player.setBodyEnabled(true);
    if (tick % 60 === 30) { net.wire.press(true); pressedAt = tick; }
    player.stepDevice(FIXED_STEP); net.present(FIXED_STEP); room.tick();
  }
  const worst = Math.max(...refusals);
  expect(refusals.length).toBeGreaterThanOrEqual(8);
  // 150 ms RTT, ±30 ms each way and a frame cadence: RTT + 60 + two 33 ms frames, 276 ms, in ticks
  expect(worst).toBeLessThanOrEqual(Math.ceil(276 / TICK_MS));
  expect(hits).toEqual([]);
  net.dispose(); room.dispose(); page.dispose(); host.dispose();
});
