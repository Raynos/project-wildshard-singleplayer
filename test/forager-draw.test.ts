import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BoxGeometry, MeshLambertMaterial, Matrix4, Vector3, Quaternion, Euler } from 'three';
import { ForagerPopulation } from '../src/engine/ai/ambientForager';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { ForagerPopulationSchema } from '../src/format/ambientLife';
import { ForagerDraw } from '../src/game/ambient/foragerDraw';
import policy from '../src/shards/nalati-grasslands/creatures/marmotForager.json' with {type:'json'};

const rows={name:'orchard-sentries',books:{phone:'models/sentry-phone.json',desktop:'models/sentry-desktop.json'},model:'sentry',rim:.2,bands:.6,tilt:-.7,sink:-.9};
function population(){return new ForagerPopulation(v.parse(ForagerPopulationSchema,{...policy,id:'orchard-sentry',count:2,place:{kind:'colonies',size:[2,2],radius:[0,0],home:0,timer:[1,1]}}),31).colonies([{x:2,z:3}]);}

test('orchard sentries project due native poses and keep the actual continuation untouched',()=>{
  const owner=population(),geometry=new BoxGeometry(),material=new MeshLambertMaterial();
  setTerrainHeight(()=>12);
  try{
    const first=owner.rows[0];if(first===undefined)throw new Error('Missing fixture body');
    first.yaw=.3;first.sit=.5;first.sink=.4;
    const before=owner.snapshot(),view=new ForagerDraw(owner,geometry,material,rows),matrix=new Matrix4(),point=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
    view.mesh.getMatrixAt(0,matrix);matrix.decompose(point,rotation,scale);
    expect(point.toArray()).toEqual([2,expect.closeTo(11.64,5),3]);expect(scale.toArray()).toEqual([expect.closeTo(1,5),expect.closeTo(1,5),expect.closeTo(1,5)]);
    expect(rotation.normalize().angleTo(new Quaternion().setFromEuler(new Euler(-.35,.3,0,'YXZ')))).toBeLessThan(1e-5);
    const frozen=matrix.clone();first.x=7;owner.due[0]=0;view.project();view.mesh.getMatrixAt(0,matrix);expect(matrix).toEqual(frozen);
    owner.due[0]=1;view.project();view.mesh.getMatrixAt(0,matrix);expect(matrix.elements[12]).toBe(7);
    first.x=2;expect(owner.snapshot()).toEqual(before);expect(view.mesh.count).toBe(2);expect(view.mesh.name).toBe(rows.name);
    view.mesh.dispose();
  }finally{setTerrainHeight(()=>0);geometry.dispose();material.dispose();}
});

test('forager projection refuses callback rows and has no owner clock of its own',()=>{
  const owner=population(),geometry=new BoxGeometry(),material=new MeshLambertMaterial();
  try{expect(()=>new ForagerDraw(owner,geometry,material,{...rows,heightAt:()=>0})).toThrow();expect(()=>new ForagerDraw(owner,geometry,material,{...rows,sink:Infinity})).toThrow();}
  finally{geometry.dispose();material.dispose();}
});
