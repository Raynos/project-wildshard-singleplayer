import { expect, it } from 'vitest';
import { Bone, Group, Vector3 } from 'three';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { AnimalPoseLaw } from '../../../src/engine/entities/animalPose';
import { QuadrupedRigPose, applyAnimalRoot, type AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { NalatiTamingHorsePose } from '../../../src/shards/nalati-grasslands/runtime/tamingHorsePose';
import { nalatiTulparSpec } from '../../../src/shards/nalati-grasslands/runtime/headlessHorse';
import { HORSE_SPECIES } from '../../../src/shards/nalati-grasslands/species/horse';
import { bodyKey } from '../../../src/shards/nalati-grasslands/species/bodyKey';
import rows from '../../../src/shards/nalati-grasslands/data/bodies.json';
import { shippingHorsePose } from '../../fixtures/taming-oracle/horsePose';

it('poses the real Tulpar head exactly as the page bind joints and shipping overlays, then quietly resumes one frozen-LOD checkpoint', () => {
  const spec = nalatiTulparSpec(), variant = HORSE_SPECIES.variants.find(a => a.id === 'tulpar');
  if (variant === undefined) throw new Error('Missing actual Tulpar');
  const row = rows.bodies.find(b => b.key === bodyKey('horse', variant)); if (row === undefined) throw new Error('Missing actual Tulpar bind');
  const actor = () => new AnimalSim(spec, 13.2, 1.08, 'horse-test', { heightAt: (x, z) => Math.sin(x * 0.03) + Math.cos(z * 0.03), random: () => 0.5 });
  const native = actor(), original = actor(), restored = actor();
  const wind = { x: 0.3, z: -0.5, strength: 0.7 };
  const pose = new NalatiTamingHorsePose(native, () => wind), resumed = new NalatiTamingHorsePose(restored, () => wind);
  const root = new Group(), bones: Record<string, Bone> = {};
  for (const def of row.bones) {
    const b = new Bone(), parent = row.bones.find(p => p.name === def.parent); b.name = def.name;
    b.position.set((def.pos[0] ?? 0) - (parent?.pos[0] ?? 0), (def.pos[1] ?? 0) - (parent?.pos[1] ?? 0), (def.pos[2] ?? 0) - (parent?.pos[2] ?? 0));
    bones[b.name] = b; const owner = parent === undefined ? root : bones[parent.name]; if (owner === undefined) throw new Error('Missing page parent'); owner.add(b);
  }
  const law = new AnimalPoseLaw({ dims: spec.dims, custom: false, ...(HORSE_SPECIES.gait === undefined ? {} : { gait: HORSE_SPECIES.gait }), ...(HORSE_SPECIES.pose === undefined ? {} : { pose: HORSE_SPECIES.pose }) });
  const joints = new QuadrupedRigPose(bones), legAbd = new Float32Array(4), head = bones['head']; if (head === undefined) throw new Error('Missing page head');
  const c: AnimalRigContext = { bones, dims: spec.dims, dt: 0, t: 0, seed: original.seed, scale: original.scale,
    speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1,
    lookTarget: original.lookTarget, lookWeight: 0, position: original.position, yaw: 0, mem: original.mem, animal: original };
  const aHead = new Vector3(), bHead = new Vector3(); let checkpointed = false;
  for (let tick = 0; tick < 10000; tick++) {
    const dt = 1 / 60, t = tick * dt, near = tick % 400 < 350;
    for (const a of [native, original, ...(checkpointed ? [restored] : [])]) {
      a.position.set(Math.sin(t) * 10, 0, Math.cos(t) * 10); a.yaw = t * 0.2; a.speed = Math.abs(Math.sin(t) * 8); a.scale = tick > 8000 ? 1.3 : 1.08;
      a.mem['rear'] = tick % 1000 < 300 ? 1 : 0; a.mem['buck'] = tick % 700 < 120 ? 1 : 0;
      a.mem['buckDir'] = tick % 200 < 100 ? 1 : -1; a.mem['toss'] = tick % 100 === 0 ? 1 : (a.mem['toss'] ?? 0);
    }
    if (tick % 3 === 0) { pose.sampleTerrain(); original.samplePoseTerrain(law); if (checkpointed) resumed.sampleTerrain(); }
    pose.advance(dt, t, near); original.advancePose(law, dt, t, near, false);
    const input = law.input;
    if (near) {
      joints.apply(law.pose, dt, { bodyY: spec.dims.bodyY, alive: input.alive, deathT: input.deathT, deathSide: input.deathSide, speed: original.speed, legAbd });
      c.dt = dt; c.t = t; c.speed = original.speed; c.strafe = original.strafe; c.phase = law.phase; c.state = original.state; c.alive = original.alive;
      c.deathT = input.deathT; c.flinch = input.flinch; c.brace = input.brace * input.brace * (3 - 2 * input.brace);
      c.attack = original.attackPhase; c.lookWeight = law.lookAmt; c.yaw = original.yaw;
      shippingHorsePose(c, wind);
    }
    applyAnimalRoot(root, original.position, original.yaw, law.tiltPitch, law.tiltRoll, false, original.alive, input.flinch, 0, 0);
    root.scale.setScalar(original.scale); root.updateMatrixWorld(true);
    const at = spec.dims.headAt;
    if (at === undefined) bHead.setFromMatrixPosition(head.matrixWorld); else bHead.set(at[0], at[1], at[2]).applyMatrix4(head.matrixWorld);
    expect(pose.headWorld(aHead).toArray()).toEqual(bHead.toArray()); expect(native.mem).toEqual(original.mem);
    if (checkpointed) { resumed.advance(dt, t, near); expect(resumed.snapshot()).toBe(pose.snapshot()); }
    if (tick === 399) { restored.restore(native.snapshot()); resumed.restore(pose.snapshot()); expect(resumed.snapshot()).toBe(pose.snapshot()); checkpointed = true; }
  }
});
