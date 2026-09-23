// PHYSICS.md P8: a dying animal's ragdoll — built from the rig's bones, thrown by the hit, settled on the floor, frozen
// (its bodies leave the world, the pose stays), and capped per tier.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadSpecies } from './species';
import { speciesDef } from '../src/entities/species/registry';
import { Rng } from '../src/core/rng';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { groups } from '../src/physics/groups';
import { Ragdolls, type Ragdoll, type RagdollBuild } from '../src/physics/ragdoll';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

loadSpecies();
const Y = new THREE.Vector3(0, 1, 0);
const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

/** The species' rig as AnimalFactory.instantiate builds it (bones only, no mesh): a root Object3D + the named bones. */
function rig(kind: string, x = 0, z = 0) {
  const sp = speciesDef(kind);
  const v = sp.variants[0];
  if (v === undefined) throw new Error(kind);
  const built = sp.build(v, new Rng(1));
  const bones: Record<string, THREE.Bone> = {};
  const root = new THREE.Group();
  for (const d of built.bones) {
    const b = new THREE.Bone();
    const parent = d.parent !== null ? built.bones.find((p) => p.name === d.parent) : undefined;
    b.position.set(d.pos[0] - (parent?.pos[0] ?? 0), d.pos[1] - (parent?.pos[1] ?? 0), d.pos[2] - (parent?.pos[2] ?? 0));
    bones[d.name] = b;
    const pb = parent !== undefined ? bones[parent.name] : undefined;
    (pb ?? root).add(b);
  }
  root.position.set(x, 0, z);
  root.updateMatrixWorld(true);
  return { root, bones, dims: built.dims, custom: sp.rig === 'custom' };
}

function world(R: Awaited<ReturnType<typeof rapier>>): Physics {
  const ph = new Physics(R);
  ph.world.createCollider(R.ColliderDesc.cuboid(80, 0.5, 80).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  return ph;
}

function spawn(rd: Ragdolls, kind: string, build: RagdollBuild, x = 0, lite = false): { doll: Ragdoll | null; r: ReturnType<typeof rig> } {
  const r = rig(kind, x);
  const doll = rd.spawn({
    build, root: r.root, bones: r.bones, dims: r.dims, scale: 1, lite,
    velocity: { x: 0, y: 0, z: 0 }, hitPoint: { x: x + 0.2, y: r.dims.bodyY, z: 0 }, dir: { x: 1, y: 0, z: 0 }, damage: 60,
  });
  return { doll, r };
}

/** step the world and pose the ragdoll like a 60 fps frame loop, until it freezes (or `seconds` run out) */
function run(ph: Physics, dolls: Ragdoll[], seconds: number): number {
  let t = 0;
  for (; t < seconds && dolls.some((d) => d.state === 'live'); t += 1 / 60) {
    ph.step();
    for (const d of dolls) d.pose(1 / 60);
  }
  return t;
}

describe('ragdolls', () => {
  it('a deer collapses onto the floor, settles, and freezes: its bodies leave the world, the corpse keeps its pose', async () => {
    const R = await rapier();
    for (const lite of [false, true]) {
      const ph = world(R);
      const rd = new Ragdolls(ph, 6);
      const { doll, r } = spawn(rd, 'deer', 'quadruped', 0, lite);
      if (doll === null) throw new Error('no ragdoll');
      expect(doll.bodies).toBe(lite ? 6 : 11);
      expect(ph.world.bodies.len()).toBe(lite ? 6 : 11);
      expect(ph.world.impulseJoints.len()).toBe(lite ? 5 : 10);
      const t = run(ph, [doll], 8);
      expect(doll.state).toBe('frozen');
      expect(t).toBeLessThan(5.1);
      expect(ph.world.bodies.len()).toBe(0);
      expect(ph.world.impulseJoints.len()).toBe(0);
      expect(rd.live).toBe(0);
      // down: the torso lies on the floor (≈ its half width up, not standing at bodyY), thrown along the hit (+x)
      const body = r.bones['body'];
      if (body === undefined) throw new Error('no body bone');
      const p = body.getWorldPosition(new THREE.Vector3());
      expect(p.y).toBeLessThan(r.dims.bodyY * 0.6);
      expect(p.y).toBeGreaterThan(r.dims.halfWidth * 0.5);
      expect(p.x).toBeGreaterThan(0);
      // every hoof is above the floor, no bone went NaN
      for (const foot of ['FL_fetlock', 'FR_fetlock', 'BL_hock', 'BR_hock']) {
        const f = r.bones[foot]?.getWorldPosition(new THREE.Vector3());
        expect(f?.y ?? Number.NaN, foot).toBeGreaterThan(-0.12);
      }
      // frozen = static: more frames don't move it
      const before = r.root.position.clone();
      for (let i = 0; i < 30; i++) { ph.step(); doll.pose(1 / 60); }
      expect(r.root.position.distanceTo(before)).toBe(0);
      ph.dispose();
    }
  });

  it('a deer that dies grazing (neck and head folded past the resting limits) starts from that pose, no snap', async () => {
    const R = await rapier();
    const ph = world(R);
    const rd = new Ragdolls(ph, 6);
    const r = rig('deer');
    const set = (n: string, x: number) => { const b = r.bones[n]; if (b === undefined) throw new Error(n); b.rotation.x = x; };
    set('neck1', 1.2); set('neck2', 0.95); set('head', 0.75);
    r.root.updateMatrixWorld(true);
    const head0 = r.bones['head']?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    const doll = rd.spawn({ build: 'quadruped', root: r.root, bones: r.bones, dims: r.dims, scale: 1, lite: false,
      velocity: { x: 0, y: 0, z: 0 }, hitPoint: { x: 0, y: 1, z: 0 }, dir: { x: 1, y: 0, z: 0 }, damage: 40 });
    if (doll === null) throw new Error('no ragdoll');
    ph.step(); doll.pose(1 / 60); ph.step(); doll.pose(1 / 60);
    const head1 = r.bones['head']?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    expect(head1.distanceTo(head0)).toBeLessThan(0.08);           // two steps of falling, not a joint snapping
    run(ph, [doll], 8);
    expect(doll.state).toBe('frozen');
    ph.dispose();
  });

  it('a crab is thrown as one body and a sailor falls off a deck, feet first', async () => {
    const R = await rapier();
    const ph = world(R);
    // a 1.5 m deck the sailor stands on the edge of
    ph.world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 2).setTranslation(-1.9, 1.4, 0).setCollisionGroups(groups('WORLD')));
    const rd = new Ragdolls(ph, 6);
    const crab = spawn(rd, 'crab', 'rigid', 5);
    const sailor = rig('sailor');
    sailor.root.position.set(0, 1.5, 0); sailor.root.updateMatrixWorld(true);
    const s = rd.spawn({ build: 'upright', root: sailor.root, bones: sailor.bones, dims: sailor.dims, scale: 1, lite: false,
      velocity: { x: 0, y: 0, z: 0 }, hitPoint: { x: 0, y: 2.4, z: 0 }, dir: { x: 1, y: 0, z: 0 }, damage: 40 });
    if (crab.doll === null || s === null) throw new Error('no ragdoll');
    expect(crab.doll.bodies).toBe(1);
    run(ph, [crab.doll, s], 8);
    expect(crab.doll.state).toBe('frozen'); expect(s.state).toBe('frozen');
    expect(crab.r.root.position.x).toBeGreaterThan(5);           // thrown along the hit
    expect(sailor.root.position.y).toBeLessThan(0.05);           // off the deck, on the ground
    expect(sailor.root.position.x).toBeGreaterThan(0);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(sailor.root.quaternion);
    expect(up.y).toBeGreaterThan(0.999);                         // upright: the keyframed death does the topple
    expect(ph.world.bodies.len()).toBe(0);
    ph.dispose();
  });

  it('a quadruped comes to rest on its side, legs out, never on its back: 64 deaths over species, builds, slopes and hits', async () => {
    // deer / boar / bear / elk × full / lite × flat / 15° / 26° ground, a random heading, hit direction, damage and a
    // running death for some. Before the righting bias a sweep like this left ~1 in 6 on its back and ~2 in 5 on the belly.
    const R = await rapier();
    const rng = new Rng(5);
    const kinds = ['deer', 'boar', 'bear', 'elk'], slopes = [0, 0.26, 0.45];
    const settle: number[] = [];
    const rests: string[] = [];
    for (let i = 0; i < 64; i++) {
      const kind = kinds[i % 4] ?? 'deer', lite = Math.floor(i / 4) % 2 === 1, slope = slopes[i % 3] ?? 0;
      const ph = new Physics(R);
      const sAx = rng.range(0, Math.PI * 2);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(sAx), 0, Math.sin(sAx)), slope);
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(tilt);
      ph.world.createCollider(R.ColliderDesc.cuboid(80, 0.5, 80).setTranslation(-n.x * 0.5, -n.y * 0.5, -n.z * 0.5).setRotation(tilt).setCollisionGroups(groups('WORLD')));
      const rd = new Ragdolls(ph, 6);
      const r = rig(kind);
      const yaw = rng.range(0, Math.PI * 2);
      r.root.quaternion.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
      r.root.updateMatrixWorld(true);
      const ha = rng.range(0, Math.PI * 2);
      const dir = new THREE.Vector3(Math.cos(ha), rng.range(-0.3, 0.1), Math.sin(ha)).normalize();
      const hitPoint = new THREE.Vector3(0, r.dims.bodyY, 0).applyQuaternion(r.root.quaternion).addScaledVector(dir, -r.dims.halfWidth);
      const speed = rng.next() < 0.4 ? rng.range(1, 7) : 0;
      const doll = rd.spawn({ build: 'quadruped', root: r.root, bones: r.bones, dims: r.dims, scale: 1, lite,
        velocity: { x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, hitPoint, dir, damage: rng.range(15, 110) });
      if (doll === null) throw new Error('no ragdoll');
      settle.push(run(ph, [doll], 8));
      expect(doll.state).toBe('frozen');
      // the torso's up against the ground's normal: 90° = on its side, 0° = on the belly, 180° = on its back
      const body = r.bones['body'];
      if (body === undefined) throw new Error('no body bone');
      const up = Y.clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()));
      const deg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.dot(n), -1, 1)));
      // legs out: the hooves on average below the torso's centre (off the ground's normal), not up in the air
      const c = body.getWorldPosition(new THREE.Vector3());
      let hoof = 0;
      for (const f of ['FL_fetlock', 'FR_fetlock', 'BL_hock', 'BR_hock']) hoof += (r.bones[f]?.getWorldPosition(new THREE.Vector3()) ?? c).sub(c).dot(n) / 4;
      if (deg < 55 || deg > 110 || hoof > 0) rests.push(`#${i} ${kind} ${lite ? 'lite' : 'full'} slope ${slope} rests at ${deg.toFixed(0)}°, hooves ${hoof.toFixed(2)} m`);
      ph.dispose();
    }
    expect(rests).toEqual([]);
    settle.sort((a, b) => a - b);
    expect(settle[settle.length >> 1]).toBeLessThanOrEqual(3);
  });

  it('respects the cap: past it spawn() is null (the keyframed fallback); a frozen ragdoll frees its slot', async () => {
    const R = await rapier();
    const ph = world(R);
    const rd = new Ragdolls(ph, 2);
    const a = spawn(rd, 'deer', 'quadruped', 0).doll, b = spawn(rd, 'boar', 'quadruped', 4).doll;
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(spawn(rd, 'deer', 'quadruped', 8).doll).toBeNull();
    expect(rd.live).toBe(2);
    if (a === null || b === null) throw new Error('no ragdoll');
    b.dispose();
    expect(rd.live).toBe(1);
    run(ph, [a], 8);
    expect(rd.live).toBe(0);
    expect(spawn(rd, 'deer', 'quadruped', 8).doll).not.toBeNull();
    ph.dispose();
  });
});
