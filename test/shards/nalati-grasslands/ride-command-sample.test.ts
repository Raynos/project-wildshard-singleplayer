// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { InputService } from '../../../src/engine/input/InputService';
import { Player } from '../../../src/engine/player/Player';
import { Mount } from '../../../src/shards/nalati-grasslands/ride/Mount';
import { fakeWorld } from '../../fake/world';
import { damageTarget } from '../../fake/legacyActor';

it('records the real reins input before jump consumption and resamples rebound controls on the next input phase', () => {
  const f = fakeWorld(), horse = damageTarget().animal;
  f.player.camera = f.game.camera; f.player.velocity = new Vector3();
  f.player.setHover = () => undefined; f.player.setBodyEnabled = () => undefined;
  f.player.keys = new Set(['KeyW', 'KeyA']); f.player.touchMove = { x: 0.25, y: 0.7 };
  f.player.touchJump = true; f.player.moveScale = 1;
  horse.mem = {}; horse.hidden = false; Object.defineProperty(horse, 'gaitPhase', { value: 0 });
  horse.yaw = 0; horse.setMotion = () => undefined;
  const mount = new Mount({ player: f.player, forest: f.forest }); mount.touchGallop = true;
  try {
    expect(mount.mount(horse)).toBe(true); mount.drive(1 / 60);
    const saved = structuredClone(mount.sampleCommand());
    expect(saved.steer).toEqual({ keyX: -1, keyY: 1, stickX: 0.25, stickY: 0.7 });
    expect(saved.sprint).toBe(true); expect(saved.jump).toBe(true); expect(f.player.touchJump).toBe(false);
    f.player.keys.clear(); f.player.touchMove.x = -0.8; mount.touchGallop = false;
    expect(mount.sampleCommand()).toEqual(saved);
    mount.drive(1 / 60);
    const next = mount.sampleCommand();
    expect(next.steer).toEqual({ keyX: 0, keyY: 0, stickX: -0.8, stickY: 0.7 });
    expect(next.sprint).toBe(false); expect(next.jump).toBe(false);
    expect(saved.steer.stickX).toBe(0.25);
    const input = new InputService(() => 0); mount.input = input;
    input.setHeld('move.right', true); input.setHeld('move.back', true); input.setHeld('ride.gallop', true);
    f.player.keys.add('KeyW'); mount.drive(1 / 60);
    const rebound = mount.sampleCommand();
    expect(rebound.steer.keyX).toBe(1); expect(rebound.steer.keyY).toBe(-1); expect(rebound.sprint).toBe(true);
  } finally { mount.dismount(); }
});

it('reads the collected touch edge and held rebound jump from InputService, consuming each edge once', () => {
  const f = fakeWorld(), horse = damageTarget().animal, input = new InputService(() => 0);
  f.player.camera = f.game.camera; f.player.velocity = new Vector3();
  f.player.setHover = () => undefined; f.player.setBodyEnabled = () => undefined;
  f.player.keys = new Set(); f.player.touchMove = { x: 0, y: 0 }; f.player.moveScale = 1;
  f.player.inputService = input; f.player.touchJump = true;
  horse.mem = {}; horse.hidden = false; Object.defineProperty(horse, 'gaitPhase', { value: 0 }); horse.yaw = 0; horse.setMotion = () => undefined;
  const mount = new Mount({ player: f.player, forest: f.forest }); mount.input = input;
  try {
    expect(mount.mount(horse)).toBe(true);
    // The ordinary page collects actions before the mounted input phase.
    Player.prototype.collectActions.call(f.player);
    expect(f.player.touchJump).toBe(false); expect(input.pressed('jump')).toBe(true);
    mount.drive(1 / 60); expect(mount.sampleCommand().jump).toBe(true); expect(mount.jumpQueued).toBe(true);
    expect(input.pressed('jump')).toBe(false);
    mount.drive(1 / 60); expect(mount.sampleCommand().jump).toBe(false);
    input.setHeld('jump', true); mount.drive(1 / 60); expect(mount.sampleCommand().jump).toBe(true);
    input.setHeld('jump', false); mount.drive(1 / 60); expect(mount.sampleCommand().jump).toBe(false);
  } finally { mount.dismount(); }
});
