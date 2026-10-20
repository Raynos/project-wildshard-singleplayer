import { encodeCanonicalJson } from '../src/sdk/immutable';
import { expect, test } from 'vitest';
import type { ShardContext } from '../src/game/plugin/context';
import * as THREE from 'three';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import { Scope } from '../src/engine/app/scope';
import { zlibSync, unzlibSync } from 'fflate';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import * as v from 'valibot';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import { dressingScene } from '../src/shards/nalati-grasslands/generators/dressingScene';
import { isJsonData } from '../src/format/json';
import { readBakedGeometry } from '../src/game/plugin/geometry';
import prepared from '../src/shards/nalati-grasslands/data/placeRuntime.generated.json';

const wire = (input:unknown):unknown => JSON.parse(encodeCanonicalJson(input));
test('both Nalati tiers retain scatter policies, static contacts and GPU cloth buffers within JSON bounds',()=>{
  for(const tier of ['phone','desktop']as const){
    const input=wire(dressingScene(tier));expect(isJsonData(input)).toBe(true);
    const rows=v.parse(SceneDressingSchema,input);
    expect(rows.layers).toHaveLength(10);
    expect(rows.layers.find(row=>row.id==='nalati-dress-boulder-tall')?.select).toEqual({modulo:3,remainder:2,equal:true});
    expect(rows.layers.find(row=>row.id==='nalati-dress-stone')?.binary).toBe(true);
    expect(rows.layers.find(row=>row.id==='nalati-dress-stone')?.far).toBe(tier==='phone'?.55:1);
    for(const name of ['dressing-statics','dressing-clutter']){
      const source=prepared.places.rows.find(row=>row.name===name),actual=rows.statics.find(row=>row.name===name);
      expect(actual?.members).toHaveLength(source?.members.length ?? 0);
      expect(actual?.members.reduce((sum,member)=>sum+member.placements.length,0)).toBe(name==='dressing-statics'?51:48);
    }
    const cloth=rows.geometry['cloth'];expect(cloth?.kind).toBe('inline');
    if(cloth?.kind==='inline'){
      const raw=unzlibSync(Uint8Array.from(atob(cloth.data),c=>c.codePointAt(0)??0));
      const shape=readBakedGeometry(raw,0,cloth.row);
      expect(shape.getAttribute('aClothA').count).toBeGreaterThan(1000);
      expect(shape.getAttribute('aClothF').itemSize).toBe(2);expect(cloth.sphere?.[3]).toBeGreaterThan(100);shape.dispose();
    }
  }
});

test('an unrelated orchard declares the same dressing contract without any native owner or constructor',()=>{
  const row={name:'orchard-blooms',catalogues:[],packs:{},geometry:{},materials:{},layers:[],statics:[],animations:[],motes:{name:'petals',count:120,seed:91,look:'orchard-petals',drift:.1,driftParam:'offset',pixelParam:'pixels'}};
  expect(v.parse(SceneDressingSchema,row).motes?.count).toBe(120);
  expect(()=>v.parse(SceneDressingSchema,{...row,build:()=>null})).toThrow();
});

test('the orchard fixture constructs and retires the shared client projection',async()=>{
  const shape=new THREE.BoxGeometry(1,2,1),blocks:Uint8Array[]=[],layout=writeGeometry(shape,blocks,'orchard');shape.dispose();
  let encoded='';for(const byte of zlibSync(join(blocks)))encoded+=String.fromCodePoint(byte);
  const scope=new Scope('orchard-row-fixture'),root=new THREE.Group(),camera=new THREE.PerspectiveCamera();
  const ctx={} as ShardContext;Object.assign(ctx,{scope,root,product:{},game:{runtime:{world:{sky:null,game:{camera}}}}});
  const rows={name:'orchard',catalogues:[],packs:{},geometry:{marker:{kind:'inline',data:btoa(encoded),row:layout}},materials:{white:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],statics:[{name:'gate',tris:12,members:[],geometry:{shape:'marker'},materials:{paint:'white'},recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'group',id:'root',children:['marker']},{kind:'mesh',id:'marker',geometry:'shape',material:'paint',missing:'empty',position:[1,2,3]}]}}]};
  const host=await SceneDressing.install(ctx,rows);expect(root.children).toContain(host.group);
  expect(host.group.getObjectByProperty('type','Mesh')?.position.toArray()).toEqual([1,2,3]);
  expect(host.stats().propTris).toBe(12);scope.dispose();expect(root.children).toHaveLength(0);
});
