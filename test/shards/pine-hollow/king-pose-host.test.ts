// oxlint-disable-next-line import/no-nodejs-modules -- Open the actual committed King rig for the independent live-bone oracle.
import { resolve } from 'node:path';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { PineKingPose } from '../../../src/shards/pine-hollow/runtime/kingPoseHost';
import { readKingCollisionBake } from '../../../src/shards/pine-hollow/runtime/kingCollisionBake';
import { advanceKingPose, applyKingPose, newPose, type KingPoseInput } from '../../../src/shards/pine-hollow/combat/kingRig';
import { readKingRig } from '../../../scripts/bake-pine-king-collision.mjs';
import { ShippingAnimalPoseOracle } from '../../fixtures/animal-pose/shipping';
import raw from '../../../src/shards/pine-hollow/runtime/kingCollision.baked.json';

const metadata = readKingCollisionBake(raw);
const height = (x: number, z: number): number => 0.035 * x - 0.027 * z;
function actor(): AnimalSim {
  const row = pineBake().parked.find(b => b.kind === 'antler-king');
  if (row === undefined) throw new Error('Missing actual King recipe');
  const body = new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: height, random: () => 0.5 });
  body.place(6, -4, 0.3); body.driven = true;
  return body;
}
const root = resolve(import.meta.dirname, '../../..');

describe('native King scalar pose ownership', () => {
  it('matches shipping custom timers, near/far pose retention and live chest/head anchors', () => {
    const body = actor(), host = new PineKingPose(body, metadata);
    const oracle = new ShippingAnimalPoseOracle({ custom: true, dims: body.dims });
    const { group, rest, bones } = readKingRig(root), pose = newPose();
    const head = bones['head'], chest = bones['chest'];
    if (head === undefined || chest === undefined) throw new Error('Missing King oracle joints');
    const input: KingPoseInput = { dt: 0, t: 0, scale: body.scale, speed: 0, deathT: -1, flinch: 0, brace: 0,
      attack: -1, lookWeight: 0, yaw: body.yaw, mem: {}, position: body.position, lookTarget: body.lookTarget };
    const got = new Vector3(), expected = new Vector3();
    const read = (): void => {
      const state = body.snapshot();
      Object.assign(oracle.input, state.motion, state.flags, { position: body.position, lookTarget: body.lookTarget, advanceAttack: false });
    };
    read(); oracle.sampleTerrain(height);
    for (let tick = 0; tick < 1800; tick++) {
      const dt = tick % 3 === 0 ? 1 / 30 : 1 / 60, t = tick / 60, near = tick % 180 < 140;
      body.speed = 13 * (0.5 + 0.5 * Math.sin(t)); body.yaw = t * 0.13;
      body.lookWeight = 0.5 + 0.5 * Math.sin(t * 0.4); body.lookTarget.set(15, 2, -8);
      body.mem['act'] = 1 + Math.floor(tick / 90) % 4;
      if (tick % 90 === 0) body.startAttack(1.1);
      if (tick % 220 === 0) body.stagger(new Vector3(0.3, 0, 0.8), 0.5);
      if (tick % 60 === 0) { host.sampleTerrain(); read(); oracle.sampleTerrain(height); }
      body.step(dt); read(); oracle.advance(dt, t, near);
      const shared = oracle.input;
      if (near) {
        Object.assign(input, { dt, t, speed: body.speed, deathT: shared.deathT, flinch: shared.flinch,
          brace: shared.brace * shared.brace * (3 - 2 * shared.brace), attack: body.attackPhase,
          lookWeight: oracle.lookAmt, yaw: body.yaw });
        input.mem['act'] = body.mem['act'] ?? 0;
        advanceKingPose(input, metadata.rest, pose);
      }
      host.advance(dt, t, near);
      applyKingPose(rest, pose);
      const f = body.alive ? shared.flinch * 1.8 : 0;
      group.position.copy(body.position); group.scale.setScalar(body.scale);
      group.rotation.set(oracle.tiltPitch + shared.flinchPitch * f, body.yaw, oracle.tiltRoll + shared.flinchRoll * f, 'YXZ');
      chest.updateWorldMatrix(true, false); host.ribs(got);
      expected.set(...metadata.volumes.ribs).applyMatrix4(chest.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(1e-10);
      group.updateMatrixWorld(true); host.publish('head'); host.query.head(got);
      expected.set(...metadata.volumes.head).applyMatrix4(head.matrixWorld);
      expect(got.distanceTo(expected)).toBeLessThanOrEqual(1e-10);
    }
  });

  it('preserves an exact mixed-publication restored suffix and refuses corrupted nested state atomically', () => {
    const body = actor(), host = new PineKingPose(body, metadata), copy = actor(), restored = new PineKingPose(copy, metadata);
    for (let tick = 0; tick < 600; tick++) {
      body.step(1 / 60); host.advance(1 / 60, tick / 60, true);
      if (tick % 2 === 0) host.publish('ribs');
      else host.publish('head');
    }
    const saved = host.snapshot(); copy.restore(body.snapshot()); restored.restore(saved);
    expect(restored.snapshot()).toEqual(saved);
    const corrupt = structuredClone(saved); corrupt.timers = '{}';
    expect(() => restored.restore(corrupt)).toThrow(); expect(restored.snapshot()).toEqual(saved);
    expect(() => restored.advance(Number.NaN, 1, true)).toThrow('Invalid King pose clock');
    expect(restored.snapshot()).toEqual(saved);
    for (let tick = 600; tick < 1200; tick++) {
      body.mem['act'] = copy.mem['act'] = tick % 4; body.step(1 / 60); copy.step(1 / 60);
      host.advance(1 / 60, tick / 60, tick % 3 !== 0); restored.advance(1 / 60, tick / 60, tick % 3 !== 0);
      host.publish('head'); restored.publish('head');
      expect(restored.snapshot()).toEqual(host.snapshot()); expect(copy.snapshot()).toEqual(body.snapshot());
    }
  });
});
