/** E336: use the shipped motion library to check blending and additive spring stability. */
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the actual shipped GLB, not a browser module.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { DummyClips } from '../src/practice/DummyClips';
import { DummyMotion, DummyPose } from '../src/practice/DummyMotion';
import { DUMMY_VARIANTS } from '../src/practice/TrainingDummy';

async function library(): Promise<THREE.AnimationClip[]> {
  const bytes = new Uint8Array(readFileSync('public/assets/practice/dummies/unimate-motion.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  return gltf.animations;
}

describe('generated training dummy clips', () => {
  it('contains six finite rest-to-rest rotation clips on each original rig', async () => {
    const clips = await library();
    expect(clips).toHaveLength(18);
    for (const variant of DUMMY_VARIANTS) {
      const own = clips.filter((clip) => clip.name.startsWith(`${variant.id}:`));
      expect(own).toHaveLength(6);
      for (const clip of own) {
        expect(clip.duration).toBe(2);
        expect(clip.tracks).toHaveLength(13);
        for (const track of clip.tracks) {
          expect(track.name).not.toMatch(/Root|Thigh|Shin|position|scale/);
          expect([...track.values].every(Number.isFinite)).toBe(true);
          const first = new THREE.Quaternion().fromArray(track.values);
          const last = new THREE.Quaternion().fromArray(track.values, track.values.length - 4);
          expect(first.angleTo(last)).toBeLessThan(0.001);
          for (let i = 0; i < track.values.length; i += 4) {
            const q = new THREE.Quaternion().fromArray(track.values, i);
            expect(Math.abs(q.length() - 1)).toBeLessThan(1e-6);
            expect(first.angleTo(q)).toBeLessThan(22.01 * Math.PI / 180);
          }
        }
      }
    }
  });

  it('writes a full base pose every frame so repeated additive hits cannot accumulate', async () => {
    const all = await library();
    for (const variant of DUMMY_VARIANTS) {
      const clips = all.filter((clip) => clip.name.startsWith(`${variant.id}:`));
      const idle = clips.find((clip) => clip.name.endsWith(':idle'));
      expect(idle).toBeDefined();
      if (!idle) throw new Error('missing idle');
      const root = new THREE.Group(), bones = new Map<string, THREE.Bone>();
      for (const track of idle.tracks) {
        const b = new THREE.Bone(); b.name = track.name.replace(/\.quaternion$/, '');
        b.quaternion.fromArray(track.values).normalize(); root.add(b); bones.set(b.name, b);
      }
      const arm = bones.get('LeftUpperArm');
      if (!arm) throw new Error('missing arm');
      const pose = new DummyPose(root, { leftUpperArm: arm });
      const motion = new DummyMotion(336), player = new DummyClips(root, clips, variant.id);
      for (let frame = 0; frame < 600; frame++) {
        if (frame < 100 && frame % 8 === 0) {
          player.hit(frame % 16 === 0 ? 'hit-left' : 'heavy-hit', 2, 0.8);
          motion.hit({ px: 0.3, py: 1.1, pz: 0, dx: 0.3, dz: -0.95, weight: 2, headshot: false });
        }
        player.update(1 / 60);
        const base = arm.quaternion.clone();
        motion.update(1 / 60); pose.apply(motion, true);
        const components = arm.quaternion.toArray();
        expect(components.every(Number.isFinite)).toBe(true);
        const once = arm.quaternion.clone();
        player.update(0); pose.apply(motion, true);
        const previous = once.toArray(), reapplied = arm.quaternion.toArray();
        previous.forEach((value, i) => { expect(value).toBeCloseTo(reapplied[i] ?? 0, 12); });
        if (frame > 500) expect(base.angleTo(arm.quaternion)).toBeLessThan(0.025);
      }
    }
  });
});
