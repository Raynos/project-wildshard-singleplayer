import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stepNpcFigure, npcFigurePose, type NpcFigureState } from '../../../src/game/systems/npc/figureMotion';
import { fitNpcFigure, mergeNpcFigures } from '../../../src/game/systems/npc/figureRig';
import { CAMP_MOTION } from '../../../src/shards/nalati-grasslands/campPeopleProfiles';
import before from './camp-motion-before.json';

const frame = { height: 1.75, neck: new THREE.Vector3(0, 1.45, 0.01), shoulder: new THREE.Vector3(-0.21, 1.34, 0) };
const snapshots: Record<string, { feet: number[]; angles: number[] }> = before;
describe('camp people on the shared NPC figure rig', () => {
  it.each(['elder', 'cook', 'child'] as const)('preserves %s idle, focus and talking trajectories from 72fb9115', (id) => {
    const p: NpcFigureState = { feet: new THREE.Vector3(id === 'child' ? 2.3 : 0, 0, 0), headWorld: new THREE.Vector3(), talking: false,
      yaw: 0.25, idleYaw: 0.25, headYaw: 0, headPitch: 0, armX: 0, armZ: 0, glanceT: 2, glance: 0, phase: 0, ring: 0 };
    const profile = { ...CAMP_MOTION[id] };
    if (profile.orbit) profile.orbit = { ...profile.orbit, x: 0, z: 0 };
    const pose = npcFigurePose();
    for (let i = 0; i < 60; i++) {
      p.talking = i >= 50;
      stepNpcFigure(p, frame, profile, 0.1, 1 + i * 0.1, new THREE.Vector3(i < 40 ? 40 : 3, 0, i < 40 ? 20 : 1.5), () => 0);
      if (![39, 49, 59].includes(i)) continue;
      const expected = snapshots[`${id}-${i}`]; if (!expected) throw new Error('Missing original trajectory');
      const values = [...p.feet, p.yaw, p.idleYaw, p.headYaw, p.headPitch, p.armX, p.armZ, p.glanceT, p.glance, p.phase, p.ring];
      const original = [...expected.feet, ...expected.angles];
      values.forEach((value, j) => { expect(value).toBeCloseTo(original[j] ?? Infinity, 12); });
      pose(p, frame, (body, head, arm) => {
        expect(body.determinant()).toBeCloseTo(1 + Math.sin(p.phase * 1.3) * 0.012, 12);
        expect(head.determinant()).toBeCloseTo(body.determinant(), 12); expect(arm.determinant()).toBeCloseTo(body.determinant(), 12);
      });
      expect(p.headWorld.y).toBeCloseTo(p.feet.y + frame.neck.y * (1 + Math.sin(p.phase * 1.3) * 0.012) + 0.12, 12);
    }
  });
  it('fits and binds five independent root/head/arm rigs into the same mesh and palette', () => {
    const figures = ['a', 'b', 'c', 'd', 'e'].map((key) => {
      const geo = new THREE.BoxGeometry(0.4, 1.75, 0.2);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3));
      return fitNpcFigure(key, geo, null, frame, frame.neck.y);
    });
    const rig = mergeNpcFigures(figures, (map) => new THREE.MeshLambertMaterial({ map, vertexColors: true }), 'fixture', 256);
    expect(rig.mesh.skeleton.bones).toHaveLength(15); expect(rig.mesh.geometry.getAttribute('position').count).toBe(120);
    const weights = rig.mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < weights.count; i++) expect(weights.getX(i) + weights.getY(i) + weights.getZ(i)).toBeCloseTo(1, 6);
    expect(rig.mesh.castShadow).toBe(true); expect(rig.mesh.receiveShadow).toBe(true); expect(rig.mesh.frustumCulled).toBe(false);
    rig.mesh.geometry.dispose(); rig.mesh.skeleton.dispose();
    if (!Array.isArray(rig.mesh.material)) rig.mesh.material.dispose();
  });
});
