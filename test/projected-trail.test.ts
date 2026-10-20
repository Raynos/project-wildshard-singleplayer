import {expect,test} from 'vitest';
import * as THREE from 'three';
import {ProjectedTrail} from '../src/game/shardfile/clientTrails';
import nalati from '../src/shards/nalati-grasslands/data/bowTrail.json' with {type:'json'};

test('an unrelated prediction ribbon pads its endpoint and follows its own fade row',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,0,5);camera.updateMatrixWorld();
  const trail=new ProjectedTrail(scene,camera,{points:6,width:[.12,.08],lifetime:2,fade:2,color:[.2,.6,1.1],order:3});
  expect(trail.mesh.visible).toBe(false);trail.points.set([0,0,0,1,0,0,2,1,0]);trail.show(3);
  const position:unknown=trail.mesh.geometry.getAttribute('position');if(!(position instanceof THREE.BufferAttribute))throw new Error('Missing prediction buffer');
  expect(position.count).toBe(12);const left=new THREE.Vector3().fromBufferAttribute(position,0),right=new THREE.Vector3().fromBufferAttribute(position,1);
  expect(left.distanceTo(right)).toBeCloseTo(.24);
  for(let i=4;i<12;i+=2){left.fromBufferAttribute(position,i);right.fromBufferAttribute(position,i+1);expect(left.add(right).multiplyScalar(.5).toArray()).toEqual([2,1,0]);}
  trail.advance(1);expect(trail.mesh.material.uniforms.uAlpha.value).toBe(.25);expect(trail.mesh.visible).toBe(true);
  trail.advance(1);expect(trail.mesh.visible).toBe(false);expect(()=>trail.show(7)).toThrow('Invalid prediction length');trail.dispose();expect(scene.children).toHaveLength(0);
});

test('the held variant declares the existing ribbon topology and brightness',()=>{
  const scene=new THREE.Scene(),trail=new ProjectedTrail(scene,new THREE.PerspectiveCamera(),nalati);
  expect(trail.points).toHaveLength(144);expect(trail.mesh.geometry.index?.count).toBe(47*6);
  expect(trail.mesh.material.uniforms.uColor.value.toArray()).toEqual([2.4,1.6,.5]);expect(trail.mesh.renderOrder).toBe(16);
  expect(()=>new ProjectedTrail(scene,new THREE.PerspectiveCamera(),{...nalati,build:()=>null})).toThrow();trail.dispose();
});
