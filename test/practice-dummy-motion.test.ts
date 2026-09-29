/** E285: the practice dummies' hit-driven springs (src/practice/DummyMotion.ts) and the pose they write to a skeleton. */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DummyMotion, DummyPose, type DummyHit } from '../src/practice/DummyMotion';
import { buildTrainingDummy } from '../src/practice/TrainingDummy';

interface Peak { rock: number; body: number; head: number; arm: number; settle: number }

/** the weapons' own numbers: Sword wood 12 / charged 24 (stagger 0 / 1), a bolt 38 body / 83 head (straw) */
function run(amount: number, py: number, headshot: boolean, stagger: number | null, mass = 0.8): Peak {
  const m = new DummyMotion(1);
  for (let i = 0; i < 120; i++) m.update(1 / 60);
  const hit: DummyHit = { px: 0.05, py, pz: 0.3, dx: 0.3, dz: -0.95, weight: Math.min(3, Math.max(0.3, amount / 25)) / mass, headshot };
  m.hit(hit);
  if (stagger !== null) m.shove(py, 0.5, -0.85, stagger, mass);
  const peak: Peak = { rock: 0, body: 0, head: 0, arm: 0, settle: 0 };
  for (let i = 0; i < 300; i++) {
    m.update(1 / 60);
    const rock = Math.hypot(m.rock.x, m.rock.z), body = Math.hypot(m.spine.x + m.chest.x, m.spine.z + m.chest.z);
    const head = Math.hypot(m.head.x, m.head.z), arm = Math.max(Math.hypot(m.armL.x, m.armL.z), Math.hypot(m.armR.x, m.armR.z));
    for (const v of [rock, body, head, arm]) expect(Number.isFinite(v)).toBe(true);
    peak.rock = Math.max(peak.rock, rock); peak.body = Math.max(peak.body, body); peak.head = Math.max(peak.head, head); peak.arm = Math.max(peak.arm, arm);
    if (rock + body + head > 0.02) peak.settle = i / 60;
  }
  return peak;
}

const DEG = Math.PI / 180;

describe('practice dummy motion', () => {
  it('reads each weapon class differently and settles within two seconds', () => {
    const light = run(12, 1.2, false, 0), charged = run(24, 1.2, false, 1);
    const body = run(38, 1.05, false, null), head = run(83, 1.58, true, null);
    // a light slash is a nudge, a charged blow rocks the figure
    expect(light.rock).toBeGreaterThan(2 * DEG);
    expect(charged.rock).toBeGreaterThan(2.5 * light.rock);
    expect(charged.rock).toBeLessThan(29 * DEG); // never folds over (the rock limit)
    // a bolt punches the chest more than it rocks the post
    expect(body.body).toBeGreaterThan(body.rock);
    // a headshot snaps the head back hard, the body much less
    expect(head.head).toBeGreaterThan(20 * DEG);
    expect(head.head).toBeGreaterThan(3 * head.rock);
    for (const p of [light, charged, body, head]) {
      expect(p.arm).toBeGreaterThan(p.rock); // the arms swing loose
      expect(p.settle).toBeLessThan(2);
    }
    // steel is heavier than straw
    expect(run(38, 1.05, false, null, 1.3).rock).toBeLessThan(body.rock);
  });

  it('idles as a faint drift, not a swing', () => {
    const m = new DummyMotion(2);
    let peak = 0;
    for (let i = 0; i < 60 * 20; i++) { m.update(1 / 60); peak = Math.max(peak, Math.hypot(m.rock.x, m.rock.z)); }
    expect(peak).toBeGreaterThan(0.05 * DEG);
    expect(peak).toBeLessThan(DEG);
  });

  it('poses a skeleton from its rest rotation and keeps the legs on the post', () => {
    // a humanoid chain whose bones carry non-identity rest rotations, like a Blender export
    const root = new THREE.Group();
    const bone = (name: string, parent: THREE.Object3D, y: number, rx: number): THREE.Bone => {
      const b = new THREE.Bone(); b.name = name; b.position.y = y; b.rotation.set(rx, 0.3, -0.2); parent.add(b); return b;
    };
    const post = bone('Root', root, 0, 0.1);
    const pelvis = bone('Pelvis', post, 0.9, -0.4);
    const chest = bone('Chest', pelvis, 0.4, 0.7);
    const head = bone('Head', chest, 0.4, -0.2);
    const thigh = bone('LeftThigh', pelvis, -0.1, 2.9);
    const joints = { root: post, pelvis, chest, head, leftThigh: thigh };
    const rest = [pelvis, chest, head, thigh].map((b) => b.quaternion.clone());
    const thighWorld = thigh.getWorldQuaternion(new THREE.Quaternion());
    const pose = new DummyPose(root, joints);
    const m = new DummyMotion(3);
    pose.apply(m); // at rest: exactly the rest pose
    [pelvis, chest, head, thigh].forEach((b, i) => { expect(b.quaternion.angleTo(rest[i] ?? b.quaternion)).toBeLessThan(1e-6); });
    m.hit({ px: 0, py: 1.2, pz: 0.3, dx: 0, dz: -1, weight: 1.5, headshot: false });
    m.shove(1.2, 0, -1, 1, 1);
    for (let i = 0; i < 12; i++) m.update(1 / 60);
    pose.apply(m);
    // the pelvis leans the top away from the push (−Z) …
    root.updateMatrixWorld(true);
    const top = head.getWorldPosition(new THREE.Vector3());
    expect(top.z).toBeLessThan(-0.05);
    // … while the thigh keeps its world orientation (only its hip pivot moves)
    expect(thigh.getWorldQuaternion(new THREE.Quaternion()).angleTo(thighWorld)).toBeLessThan(1e-3);
  });

  it('drives the procedural fallback figure (torso, head, arms)', () => {
    const model = buildTrainingDummy('wood');
    const pose = new DummyPose(model.root, model.joints);
    const m = new DummyMotion(4);
    m.hit({ px: 0.3, py: 1.2, pz: 0.3, dx: 1, dz: 0, weight: 2, headshot: false });
    for (let i = 0; i < 10; i++) m.update(1 / 60);
    pose.apply(m);
    expect(model.joints.spine?.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.01);
    expect(model.joints.leftUpperArm?.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.01);
  });
});
