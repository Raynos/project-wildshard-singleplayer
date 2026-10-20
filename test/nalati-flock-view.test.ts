import { FlockBrain, type FlockPose } from '../src/engine/ai/flock';
import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { parseFlock } from '../src/format/crowds';
import viewRows from '../src/shards/nalati-grasslands/creatures/flock.json' with { type: 'json' };
import { CrowdDraw } from '../src/game/ambient/crowdDraw';

test('orchard crowd lends live poses to the shared draw and keeps prey and paused uploads authoritative', () => {
  const rows: FlockPose[] = [
    { x: 4, y: 2, z: 8, yaw: .3, speed: 3, phase: .2, graze: .4, dead: false, deathTime: 0, scale: 1.2, wool: 2 },
    { x: 9, y: 1, z: -3, yaw: -.2, speed: 0, phase: .1, graze: 0, dead: true, deathTime: .5, scale: .8, wool: 0 },
  ];
  const controller = new FlockBrain({ heightAt:()=>0,normalY:()=>1,inBounds:()=>true,wetAt:()=>false,playerCrouched:()=>false,grassHeightAt:()=>.5,trample:()=>undefined,centre:()=>undefined },
    parseFlock({id:'orchard.crowd',kind:'flock',x:5,z:6,count:2,seed:1,range:12,runSpeed:4,walkSpeed:1,grazeStep:.2,bleatCue:'bleat'}));
  controller.initialize();
  vi.spyOn(controller,'readPose').mockImplementation((i,out)=>{const pose=rows[i];if(pose===undefined)throw new Error('Missing test pose');return Object.assign(out,pose);});
  vi.spyOn(controller,'kill').mockImplementation(i=>{const pose=rows[i];if(pose!==undefined)pose.dead=true;});
  vi.spyOn(controller,'alive','get').mockImplementation(()=>rows.filter(pose=>!pose.dead).length);
  const rig = new THREE.BoxGeometry(), n = rig.getAttribute('position').count;
  rig.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  rig.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n * 4), 4));
  rig.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  const geometry = new THREE.BoxGeometry(), parts = ['body','head'];
  const material=new THREE.MeshLambertMaterial();
  const flock = new CrowdDraw(controller,{geometry,parts,pivots:parts.map(()=>[0,0,0])},material,
    {...viewRows,name:'orchard.crowd',motion:{...viewRows.motion,joints:[[0,0,0,0,0,0,0],[.8,.05,4,2,-.1,0,6.2832]]}});
  const mesh = flock.mesh, oldGeometry = mesh.geometry;
  const anim = oldGeometry.getAttribute('iAnim');
  flock.useRig({geometry:rig,map:null,joints:parts.map(name=>({name}))});
  expect(mesh.geometry).not.toBe(oldGeometry);
  expect(mesh.geometry.getAttribute('iAnim')).toBe(anim);
  expect(mesh.geometry.getAttribute('aRig').count).toBeGreaterThan(0);
  expect(mesh.count).toBe(2);
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(); mesh.getMatrixAt(0, matrix); point.setFromMatrixPosition(matrix);
  expect(point.x).toBeCloseTo(4); expect(point.y).toBeCloseTo(1.98); expect(point.z).toBeCloseTo(8);
  expect(anim.getW(1)).toBeCloseTo(.5);
  const version = mesh.instanceMatrix.version, first = rows[0]; if (first === undefined) throw new Error('Missing first sheep');
  first.x = 12; first.yaw = 1.1;
  flock.project(); expect(mesh.instanceMatrix.version).toBe(version);
  const prey = flock.prey(0); expect(prey.position.x).toBe(12); expect(prey.yaw).toBe(1.1);
  expect(flock.raycast(new THREE.Vector3(12, 2.6, 3), new THREE.Vector3(0, 0, 1), 10)).toBe(0);
  flock.project(1); expect(mesh.instanceMatrix.version).toBeGreaterThan(version);
  mesh.getMatrixAt(0, matrix); expect(point.setFromMatrixPosition(matrix).x).toBe(12);
  prey.applyDamage(); expect(prey.alive).toBe(false); expect(flock.alive).toBe(0);
  expect(flock.raycast(new THREE.Vector3(12, 2.6, 3), new THREE.Vector3(0, 0, 1), 10)).toBe(-1);
  mesh.geometry.dispose(); geometry.dispose(); rig.dispose();
});
