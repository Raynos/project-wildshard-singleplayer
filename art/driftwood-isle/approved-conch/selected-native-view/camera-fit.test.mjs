import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Matrix4,Vector3} from 'three';
import {fitViews,ROOM} from './camera-fit.mjs';
const bounds=new Box3(new Vector3(-1.6118314266204834,-.009531468152999878,-1.1148000955581665),new Vector3(1.6487998962402344,3.654320001602173,1.1079367399215698));
const world=new Matrix4().makeTranslation(0,900,-6.5);
test('former 35 degree fit is rejected before any top/elevated render',()=>{
  assert.throws(()=>fitViews(bounds,world,402/874,.1,1000,[35]),/No camera fit/u);
});
test('one wider matched projection fits all nine cameras and full character inside actual room',()=>{
  const fit=fitViews(bounds,world,402/874);assert.equal(Object.keys(fit.views).length,9);assert.ok(fit.fov>35);
  for(const view of Object.values(fit.views)) {
    view.position.forEach((v,i)=>assert.ok(v>=ROOM.cameraMin[i]&&v<=ROOM.cameraMax[i]));
    for(const p of view.projectedCorners)assert.ok(Math.abs(p[0])<=.98&&Math.abs(p[1])<=.98&&p[2]>-1&&p[2]<1);
  }
  assert.ok(fit.views.top.position[1]<909);
});
test('character outside room and insufficient FOV fail closed, never hide geometry',()=>{
  assert.throws(()=>fitViews(bounds,new Matrix4().makeTranslation(49,900,0),402/874),/Character bounds/u);
  assert.throws(()=>fitViews(bounds,world,402/874,.1,1000,[35,40]),/No camera fit/u);
});
