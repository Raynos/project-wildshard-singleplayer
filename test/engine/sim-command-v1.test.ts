// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real distributed native physics in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { PerspectiveCamera } from 'three';
import { createSimHost } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { Player } from '../../src/engine/player/Player';
import { InputService } from '../../src/engine/input/InputService';
import { TickCommandSchema, simPlayerCommand } from '../../src/sdk/tickProtocol';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { legacyDouble } from '../fake/FakeGame';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const legacy = { kind: 'player', moveX: 0.4, moveZ: -0.2, yaw: 0.3 } as const;
const steer = { keyX: -1, keyY: 1, stickX: 0.25, stickY: 0.4 };

it('keeps old wire/forward bytes and admits only explicitly versioned finite local controls', () => {
  expect(JSON.stringify(v.parse(TickCommandSchema, legacy))).toBe(JSON.stringify(legacy));
  expect(JSON.stringify(simPlayerCommand(legacy))).toBe('{"moveX":0.4,"moveZ":-0.2,"yaw":0.3}');
  const rich = { ...legacy, commandVersion: 1, steer, sprint: false, crouch: true } as const;
  expect(v.parse(TickCommandSchema, rich)).toEqual(rich);
  for (const bad of [
    { ...legacy, steer }, { ...legacy, sprint: false }, { ...legacy, crouch: false },
    { ...rich, commandVersion: 0 }, { ...rich, commandVersion: 2 }, { ...rich, steer: null },
    { ...rich, steer: { ...steer, keyX: Infinity } }, { ...rich, steer: { ...steer, stickY: Number.NaN } },
    { ...rich, steer: { ...steer, stickX: 1.01 } }, { ...rich, steer: { ...steer, extra: 1 } },
    { ...rich, sprint: 1 }, { ...rich, crouch: 'yes' }, { ...legacy, commandVersion: undefined },
  ]) expect(v.safeParse(TickCommandSchema, bad).success).toBe(false);
});

it('forwards detached versioned controls to the real native driver and refuses missing versions before mutation', () => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    expect(() => host.step({ moveX: 0, moveZ: 0, yaw: 0, steer })).toThrow('commandVersion 1');
    expect(() => host.advance(1, { moveX: 0, moveZ: 0, yaw: 0, sprint: false })).toThrow('commandVersion 1');
    expect(() => host.step({ moveX: 0, moveZ: 0, yaw: 0, commandVersion: 1, steer: { ...steer, stickY: Number.NaN } })).toThrow('axes');
    expect(host.clock.now).toBe(0); expect(host.state.tick).toBe(0); expect(host.state.accumulator).toBe(0);
    const wire = { ...legacy, commandVersion: 1 as const, steer: { ...steer }, sprint: false, crouch: true };
    const command = simPlayerCommand(wire);
    wire.steer.stickX = -0.75;
    let read = false;
    host.usePlayerDriver({ input: input => {
      expect(input).toEqual({ moveX: legacy.moveX, moveZ: legacy.moveZ, yaw: legacy.yaw, commandVersion: 1, steer, sprint: false, crouch: true });
      read = true; return true;
    }, step: () => undefined });
    host.step(command); expect(read).toBe(true); expect(host.state.tick).toBe(1);
  } finally { host.dispose(); }
});

it('samples the page keyboard and analog controls separately, with explicit recording opt-in and legacy shape unchanged', () => {
  const physics = new Physics(rapier);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  try {
    player.keys.add('KeyW'); player.keys.add('KeyA'); player.keys.add('ShiftLeft');
    player.touchMove.x = 0.25; player.touchMove.y = 0.4;
    const old = player.sampleCommand(), rich = player.sampleCommand(1);
    expect(old).not.toHaveProperty('steer'); expect(old).not.toHaveProperty('commandVersion');
    expect(rich.steer).toEqual(steer); expect(rich.sprint).toBe(true);
    const { commandVersion, steer: recorded, ...rest } = rich;
    expect(commandVersion).toBe(1); expect(rest).toEqual(old);
    player.touchMove.x = 0.8; expect(recorded?.stickX).toBe(0.25);
    const input = new InputService(() => 0); player.inputService = input;
    input.setHeld('move.right', true); input.setHeld('move.back', true);
    expect(player.sampleSteer()).toEqual({ keyX: 1, keyY: -1, stickX: 0.8, stickY: 0.4 });
    input.setHeld('sprint', false); expect(player.sampleCommand(1).sprint).toBe(false);
  } finally { player.motor.dispose(); physics.dispose(); }
});

it('records the traversal consumed controls only with version-1 opt-in, detached from live device state', () => {
  const physics = new Physics(rapier);
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  const used = { steer: { keyX: -1, keyY: 1, stickX: 0.2, stickY: 0.8 }, sprint: true, jump: true };
  let samples = 0;
  try {
    const ordinary = player.sampleCommand();
    player.ride = { drive: () => undefined, step: () => undefined, pose: () => undefined, dismount: () => undefined,
      sampleCommand: () => { samples++; return used; } };
    expect(player.sampleCommand()).toEqual(ordinary); expect(samples).toBe(0);
    const captured = player.sampleCommand(1); expect(samples).toBe(1);
    expect(captured.steer).toEqual(used.steer); expect(captured.sprint).toBe(true); expect(captured.jump).toBe(true);
    used.steer.keyX = 1; used.sprint = false; used.jump = false;
    expect(captured.steer?.keyX).toBe(-1); expect(captured.sprint).toBe(true); expect(captured.jump).toBe(true);
    player.ride = { drive: () => undefined, step: () => undefined, pose: () => undefined, dismount: () => undefined };
    expect(player.sampleCommand(1).steer).toEqual(player.sampleSteer());
  } finally { player.motor.dispose(); physics.dispose(); }
});
