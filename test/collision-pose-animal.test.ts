// oxlint-disable-next-line import/no-nodejs-modules -- Bit-identical comparison of the shipping FK formula.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Fence the byte-identical historical collision law.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the historical source capture.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { it, expect } from 'vitest';
import { Bone, Group, Vector3, type EulerOrder } from 'three';
import { CollisionPose } from '../src/game/combat/collisionPose';
import { CollisionPose as ShippingCollisionPose } from './fixtures/animal-pose/collisionShipping';

const joints = [{parent:-1,position:[0,1.5,-.1]},{parent:0,position:[0,.5,.6]},{parent:1,position:[0,.3,.3]}] as const;
it('keeps 10k shipping default frames, anchors and x/z capsules bit-identical',()=>{
  const shipping=new ShippingCollisionPose(joints),actual=new CollisionPose(joints),frame=new Group();
  const expected=new Vector3(),got=new Vector3(),oldA=new Vector3(),oldB=new Vector3(),a=new Vector3(),b=new Vector3();
  for(let tick=0;tick<10_000;tick++){
    const t=tick/60;frame.position.set(150+t,4,-30);frame.scale.setScalar(2.6);frame.rotation.set(.1*Math.sin(t),t,-.08*Math.cos(t),'YXZ');frame.updateMatrixWorld(true);
    for(let i=0;i<joints.length;i++){
      const offset=[0,Math.sin(t+i)*.1,0] as const,angles=[Math.sin(t+i)*.7,Math.cos(t+i)*.3,Math.sin(t*2+i)*.1] as const;
      shipping.set(i,offset,angles);actual.set(i,offset,angles);
    }
    shipping.solve(frame.matrixWorld);actual.solve(frame.matrixWorld);
    for(let i=0;i<joints.length;i++){shipping.point(i,[0,-.06,.12],expected);actual.point(i,[0,-.06,.12],got);assert.deepStrictEqual(got.toArray(),expected.toArray());}
    for(const axis of ['x','z'] as const){shipping.capsule(0,[0,-.3,-.32],axis,.38,.45,oldA,oldB);actual.capsule(0,[0,-.3,-.32],axis,.38,.45,a,b);assert.deepStrictEqual(a.toArray(),oldA.toArray());assert.deepStrictEqual(b.toArray(),oldB.toArray());}
  }
});
const orders:readonly EulerOrder[]=['XYZ','YXZ','ZXY','ZYX','YZX','XZY'];
for(const order of orders)it(`${order}: rest scale, animated squash and upright capsules equal real propagated joints`,()=>{
  const rows=joints.map((row,i)=>({parent:row.parent,position:row.position,order,scale:[1+i*.1,1-i*.08,1+i*.2] as const}));
  const collision=new CollisionPose(rows),frame=new Group(),bones=rows.map(row=>{const bone=new Bone();bone.position.set(row.position[0],row.position[1],row.position[2]);bone.scale.set(...row.scale);return bone;});
  rows.forEach((row,i)=>{const bone=bones[i],parent=row.parent<0?frame:bones[row.parent];if(bone===undefined||parent===undefined)throw new Error('Missing real fixture joint');parent.add(bone);});
  const expected=new Vector3(),got=new Vector3(),a=new Vector3(),b=new Vector3();
  for(let tick=0;tick<600;tick++){
    const t=tick/60;frame.position.set(5,2,-3);frame.scale.setScalar(1.4);frame.rotation.set(.1,t,.2,'YXZ');
    bones.forEach((bone,i)=>{
      const row=rows[i];if(row===undefined)throw new Error('Missing real rest joint');
      const offset=[.03*Math.sin(t),.07*Math.cos(t+i),0] as const,angles=[.1*Math.sin(t),t*.2,.17*Math.cos(t+i)] as const;
      const scale=[1+.1*Math.sin(t),.85+.15*Math.cos(t+i),1+.3*Math.sin(t*.7)] as const;
      collision.set(i,offset,angles,scale);bone.position.set(row.position[0]+offset[0],row.position[1]+offset[1],row.position[2]+offset[2]);bone.rotation.set(...angles,order);bone.scale.set(...scale);
    });
    frame.updateMatrixWorld(true);collision.solve(frame.matrixWorld);
    bones.forEach((bone,i)=>{collision.point(i,[.1,-.2,.3],got);expected.set(.1,-.2,.3).applyMatrix4(bone.matrixWorld);assert.ok(got.distanceTo(expected)<=1e-12);});
    const root=bones[0];if(root===undefined)throw new Error('Missing real root');const e=root.matrixWorld.elements;
    collision.capsule(0,[0,0,0],'y',.8,.4,a,b);
    expected.set(e[12],e[13],e[14]).addScaledVector(got.set(e[4],e[5],e[6]),-.4);assert.ok(a.distanceTo(expected)<=1e-12);
    expected.set(e[12],e[13],e[14]).addScaledVector(got,.4);assert.ok(b.distanceTo(expected)<=1e-12);
  }
});
it('uses rest scale before the first pose and refuses invalid scale without corrupting the previous pose',()=>{
  const pose=new CollisionPose([{parent:-1,position:[0,1,0],scale:[2,3,4]}]),frame=new Group(),out=new Vector3();frame.updateMatrixWorld(true);
  pose.solve(frame.matrixWorld);pose.point(0,[1,1,1],out);expect(out.toArray()).toEqual([2,4,4]);
  pose.set(0,[0,0,0],[0,0,0]);pose.solve(frame.matrixWorld);pose.point(0,[1,1,1],out);expect(out.toArray()).toEqual([2,4,4]);
  expect(()=>pose.set(0,[0,0,0],[0,0,0],[1,Number.NaN,1])).toThrow('Invalid collision joint pose');
  pose.solve(frame.matrixWorld);pose.point(0,[1,1,1],out);expect(out.toArray()).toEqual([2,4,4]);
  expect(()=>new CollisionPose([{parent:-1,position:[0,0,0],scale:[1,Number.POSITIVE_INFINITY,1]}])).toThrow('Invalid collision joint chain');
});

it('absolute locals preserve current Euler order and publish only at solve, matching real cached joints for 10k frames',()=>{
  const pose=new CollisionPose([{parent:-1,position:[.3,1,-.7]}]),frame=new Group(),bone=new Bone(),out=new Vector3(),expected=new Vector3();
  frame.add(bone);bone.position.set(.3,1,-.7);frame.updateMatrixWorld(true);pose.solve(frame.matrixWorld);
  for(let tick=0;tick<10_000;tick++){
    const t=tick/60,order=orders[tick%orders.length];if(order===undefined)throw new Error('Missing joint order');
    bone.position.set(Math.sin(t)*.3,1+Math.cos(t)*.2,Math.cos(t)*.7);bone.rotation.set(t*.1,Math.sin(t)*.3,Math.cos(t)*.2,order);bone.scale.set(1+.1*Math.sin(t),1-.1*Math.cos(t),1+.2*Math.cos(t));
    pose.setLocal(0,bone);pose.point(0,[0,0,0],out);expected.setFromMatrixPosition(bone.matrixWorld);assert.deepStrictEqual(out.toArray(),expected.toArray());
    frame.updateMatrixWorld(true);pose.solve(frame.matrixWorld);pose.point(0,[.2,.3,-.1],out);expected.set(.2,.3,-.1).applyMatrix4(bone.matrixWorld);assert.deepStrictEqual(out.toArray(),expected.toArray());
  }
  const before=out.clone();expect(()=>pose.setLocal(0,{position:{x:1,y:Number.NaN,z:1},rotation:bone.rotation,scale:bone.scale})).toThrow('Invalid collision joint pose');
  pose.solve(frame.matrixWorld);pose.point(0,[.2,.3,-.1],out);assert.deepStrictEqual(out.toArray(),before.toArray());
});
it('fences the historical collision law as byte-identical shipping source',()=>{
  const source=v.parse(v.strictObject({source:v.string(),revision:v.string(),sha256:v.string()}),JSON.parse(readFileSync(new URL('fixtures/animal-pose/collisionShipping.json',import.meta.url),'utf8')));
  expect(source.source).toBe('src/game/combat/collisionPose.ts');expect(source.revision).toMatch(/^[a-f0-9]{40}$/u);
  expect(createHash('sha256').update(readFileSync(new URL('fixtures/animal-pose/collisionShipping.ts',import.meta.url))).digest('hex')).toBe(source.sha256);
});
