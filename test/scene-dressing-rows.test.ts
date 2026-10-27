import {scalarBlockBytes} from './fixtures/nalati-scalar-blocks';
import { nalatiSpecimens } from './fixtures/nalati-specimens';
import { nalatiBalbal } from './fixtures/nalati-balbal';
import { nalatiRuntime } from './fixtures/nalati-runtime';
import { nalatiDecorative } from './fixtures/nalati-decorative';
import { originalPlaceBinary } from './fixtures/nalati-original-place-binary';
// oxlint-disable-next-line import/no-nodejs-modules -- validate generated dressing fixtures without inferring their complete JSON types
import { readFileSync } from 'node:fs';
import { PrivateSceneSchema } from '../src/format/clientChannels';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { decodeLaneBytes } from '../src/engine/core/deflate';
import {bakedSamplers} from '../src/format/bakedTerrainSampling';
import { expect, test, vi } from 'vitest';
import type { ShardContext } from '../src/game/plugin/context';
import * as THREE from 'three';
import { SceneDressing, readSceneGeometryAddress, readSceneFloors } from '../src/game/shardfile/sceneDressing';
import { Scope } from '../src/engine/app/scope';
import { WorldRegistry } from '../src/engine/world/registry';
import { zlibSync, unzlibSync } from 'fflate';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import * as v from 'valibot';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import { dressingScene } from './fixtures/nalati-dressing-scene';
import { dressingCragDecoded } from '../src/shards/nalati-grasslands/generators/dressingScene';
import { nalatiCragRows } from './fixtures/nalati-crags';
import { nalatiBakeBlob } from '../src/shards/nalati-grasslands/generators/placeBlobProgram';
import { nalatiPlacesProgram } from '../src/shards/nalati-grasslands/generators/placesProgram';
import { buildDressingWire } from '../src/shards/nalati-grasslands/generators/dressingProgram';
import { nameBlob } from '../src/sdk/blobs';
import { isJsonData } from '../src/format/json';
import { readBakedGeometry } from '../src/game/plugin/geometry';
import {legacyDouble} from '@wildshard/engine/test/FakeGame';

const finite=v.pipe(v.number(),v.finite());
const cragTier=v.object({recipe:PrivateSceneSchema,placements:v.array(v.unknown()),boxes:v.array(finite),
  hulls:v.array(v.object({points:v.array(finite)}))});
const cragRows=v.parse(v.object({phone:cragTier,desktop:cragTier}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/cragRock.generated.json','utf8')));
const prepared=v.parse(v.object({places:v.object({rows:v.array(v.object({name:v.string(),members:v.array(v.unknown())}))})}),
  nalatiRuntime);

const wire = (input:unknown):unknown => JSON.parse(encodeCanonicalJson(input));
test.each([['geometry','world'],['geometry','retire'],['geometry','length'],['lettering','world'],['lettering','retire'],['lettering','length']]as const)('raw %s refuses %s changes before any resource or system publication',async(kind,failure)=>{
  const inputShape=new THREE.BoxGeometry(1,2,1);inputShape.clearGroups();const blocks:Uint8Array[]=[],layout=writeGeometry(inputShape,blocks,'held');inputShape.dispose();
  const parent=new Scope('raw.parent'),scope=parent.child('raw.entered'),root=new THREE.Group(),system=vi.fn<ShardContext['system']>();
  type Runtime=NonNullable<ShardContext['game']['runtime']>;
  const runtime=legacyDouble<Runtime>({world:legacyDouble<NonNullable<Runtime['world']>>({})}),owned=vi.spyOn(scope,'own');let finish:(bytes:Uint8Array)=>void=()=>undefined;
  const held=new Promise<Uint8Array>(resolve=>{finish=resolve;}),read=vi.fn((name:string)=>name==='bad.bin'?Promise.resolve(new Uint8Array(1)):held);
  const ctx=legacyDouble<ShardContext>({scope,root,system,app:legacyDouble<ShardContext['app']>({registry:new WorldRegistry()}),game:legacyDouble<ShardContext['game']>({runtime}),product:legacyDouble<ShardContext['product']>({file:read,hasFile:()=>true})});
  const rows={name:'raw-orchard',catalogues:[],packs:{},geometry:kind==='geometry'?{marker:{kind:'file',file:'held.bin',row:layout},
    ...(failure==='length'?{bad:{kind:'file',file:'bad.bin',row:layout}}:{})}:{},materials:kind==='lettering'?{paint:{kind:'lettering-file',file:'held.bin',width:1,height:join(blocks).byteLength/4,rim:.2},
    ...(failure==='length'?{bad:{kind:'lettering-file',file:'bad.bin',width:1,height:1,rim:.2}}:{})}:{},layers:[],statics:[],animations:[]};
  const pending=SceneDressing.install(ctx,rows);expect(read).toHaveBeenCalledTimes(1);expect(owned).not.toHaveBeenCalled();
  if(failure==='world')runtime.world=legacyDouble<NonNullable<Runtime['world']>>({});
  const retiring=failure==='retire'?parent.disposeSteps():undefined;retiring?.next();finish(join(blocks));
  await expect(pending).rejects.toThrow(failure==='length'?'byte count':failure==='retire'?'retired':'owner changed');
  expect(owned).not.toHaveBeenCalled();expect(system).not.toHaveBeenCalled();expect(root.children).toEqual([]);
  if(retiring!==undefined)for(const _step of retiring){ /* finish the original sliced retirement */ }
  parent.dispose();owned.mockRestore();
});
test('both Nalati tiers retain scatter policies, static contacts and GPU cloth buffers within JSON bounds',()=>{
  for(const tier of ['phone','desktop']as const){
    const input=wire(dressingScene(tier,nalatiDecorative,nalatiRuntime,nalatiBalbal,nalatiSpecimens));expect(isJsonData(input)).toBe(true);
    const rows=v.parse(SceneDressingSchema,input);
    expect(rows.layers).toHaveLength(10);
    const crags=rows.statics.find(row=>row.name==='cragRocks'),cragMember=crags?.members[0];
    expect(crags?.recipe).toEqual(v.parse(PrivateSceneSchema,cragRows[tier].recipe));expect(cragMember?.placements).toEqual(cragRows[tier].placements);
    expect(cragMember?.boxes).toEqual(cragRows[tier].boxes);expect(cragMember?.contacts).toMatchObject({kind:'packed-hulls',surface:'rock'});
    if(cragMember!==undefined&&!Array.isArray(cragMember.contacts)){
      if(!('data'in cragMember.contacts))throw new Error('Crag contacts retain their original inline source');
      const raw=unzlibSync(Uint8Array.from(atob(cragMember.contacts.data),c=>c.codePointAt(0)??0));
      expect(raw).toEqual(new Uint8Array(Float32Array.from(cragRows[tier].hulls.flatMap(row=>row.points)).buffer));
    }

    expect(rows.statics.find(row=>row.name==='farHerds')?.recipe.nodes.find(node=>node.kind==='group')?.name).toBe('nalati-far-herds');
    expect(rows.statics.find(row=>row.name==='snowLotus')?.recipe.nodes.filter(node=>node.kind==='group').find(node=>node.id==='root')?.name).toBe('nalati-snow-lotus');
    expect(rows.instances.filter(row=>row.group==='farHerds').every(row=>row.name==='nalati-far-herd')).toBe(true);
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
      expect(shape.getAttribute('normal').count).toBe(shape.getAttribute('position').count);
      expect(shape.getAttribute('aClothF').itemSize).toBe(2);expect(cloth.sphere?.[3]).toBeGreaterThan(100);shape.dispose();
    }
  }
});

test('an unrelated orchard declares the same dressing contract without any native owner or constructor',()=>{
  const row={name:'orchard-blooms',catalogues:[],packs:{},geometry:{},materials:{},layers:[],statics:[],animations:[],motes:{name:'petals',count:120,seed:91,look:'orchard-petals',drift:.1,driftParam:'offset',pixelParam:'pixels'}};
  expect(v.parse(SceneDressingSchema,row).motes?.count).toBe(120);
  expect(()=>v.parse(SceneDressingSchema,{...row,build:()=>null})).toThrow();
});

test.each(['ordinary','offset']as const)('the orchard fixture constructs and retires the shared client projection (%s)',async mode=>{
  const shape=new THREE.BoxGeometry(1,2,1);shape.clearGroups();
  const blocks:Uint8Array[]=[],layout=writeGeometry(shape,blocks,'orchard');shape.dispose();
  const bytes=join(blocks),backing=new Uint8Array(bytes.length+4);backing.set(bytes,4);
  const loan=mode==='offset'?backing.subarray(4):bytes;expect(Buffer.compare(loan,bytes)).toBe(0);
  const scope=new Scope('orchard-row-fixture'),root=new THREE.Group(),camera=new THREE.PerspectiveCamera();
  const system=vi.fn<ShardContext['system']>(),ctx={} as ShardContext;Object.assign(ctx,{system,scope,root,app:{registry:new WorldRegistry()},product:{file:()=>Promise.resolve(loan),hasFile:()=>true},game:{runtime:{world:{sky:null,player:{position:new THREE.Vector3()},game:{camera}}}}});
  const rows={name:'orchard',catalogues:[],packs:{},geometry:{marker:{kind:'file',file:'orchard.bin',row:layout}},materials:{white:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],statics:[{name:'gate',tris:12,members:[],geometry:{shape:'marker'},materials:{paint:'white'},recipe:{version:1,root:'root',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'group',id:'root',children:['marker']},{kind:'mesh',id:'marker',geometry:'shape',material:'paint',missing:'empty',position:[1,2,3]}]}}]};
  const host=await SceneDressing.install(ctx,rows);expect(root.children).toContain(host.group);
  expect(host.group.getObjectByProperty('type','Mesh')?.position.toArray()).toEqual([1,2,3]);
  expect(host.stats().propTris).toBe(12);
  const frame=system.mock.calls[0]?.[0];expect(frame).toMatchObject({id:'client.scene.dressing',phase:'update',after:['main.world'],before:['engine.creatures.update']});
  if(frame===undefined)throw new Error('Missing declared dressing frame');frame.run(.1,1);
  const otherScope=new Scope('second-orchard'),otherRoot=new THREE.Group(),other={} as ShardContext;Object.assign(other,ctx,{scope:otherScope,root:otherRoot});
  const second=await SceneDressing.install(other,rows);expect(second).not.toBe(host);expect(SceneDressing.current(ctx)).toBe(host);expect(SceneDressing.current(other)).toBe(second);
  scope.dispose();expect(root.children).toHaveLength(0);expect(SceneDressing.current(other)).toBe(second);otherScope.dispose();expect(otherRoot.children).toHaveLength(0);
});


test('uploaded dressing channels retire while picking and cloneable templates retain their arrays',async()=>{
  const source=new THREE.BoxGeometry(1,2,1);source.clearGroups();
  const blocks:Uint8Array[]=[],layout=writeGeometry(source,blocks,'dressing-upload');source.dispose();
  const raw=join(blocks);
  for(const template of [false,true]){
    const scope=new Scope('dressing-upload'),root=new THREE.Group(),ctx={} as ShardContext;
    Object.assign(ctx,{scope,root,system:vi.fn(),app:{registry:new WorldRegistry()},product:{hasFile:()=>true,file:()=>Promise.resolve(raw)},game:{runtime:{world:{sky:null}}}});
    const rows={name:'upload',catalogues:[],packs:{},geometry:{shape:{kind:'file',file:'upload.bin',row:layout}},materials:{paint:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],
      staticModels:template?[{model:{id:'fixture/upload',name:'Upload',file:'test/scene-dressing-rows.test.ts',category:'props',pipeline:'code',defaults:{}},geometry:'shape',material:'paint'}]:[],
      statics:[{name:'draw',tris:12,members:[],geometry:{shape:'shape'},materials:{paint:'paint'},recipe:{version:1,root:'mesh',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'mesh',id:'mesh',geometry:'shape',material:'paint',missing:'empty'}]}}]};
    const owner=await SceneDressing.install(ctx,rows),mesh=owner.group.children[0];
    if(!(mesh instanceof THREE.Mesh))throw new Error('Missing dressing draw');
    const drawn:unknown=mesh.geometry;if(!(drawn instanceof THREE.BufferGeometry))throw new Error('Missing dressing geometry');
    const normal:unknown=drawn.getAttribute('normal');if(!(normal instanceof THREE.BufferAttribute))throw new Error('Missing dressing normals');
    const count=normal.count,box=drawn.boundingBox?.clone()??null;normal.onUploadCallback();
    expect(normal.count).toBe(count);expect(normal.array.byteLength>0).toBe(template);
    const position:unknown=drawn.getAttribute('position');if(!(position instanceof THREE.BufferAttribute))throw new Error('Missing picking positions');
    expect(position.array.byteLength).toBeGreaterThan(0);expect(drawn.index?.array.byteLength).toBeGreaterThan(0);
    expect(drawn.boundingBox).toEqual(box);expect(drawn.boundingSphere?.radius).toBeGreaterThan(0);
    if(template){const copy=drawn.clone(),copied:unknown=copy.getAttribute('normal');if(!(copied instanceof THREE.BufferAttribute))throw new Error('Missing template normals');expect(copied.count).toBe(count);expect(copied.array.byteLength).toBeGreaterThan(0);copy.dispose();}
    scope.dispose();
  }
});

test.each([false,true])('packed dressing hulls register exact independent float lanes in source order (offset=%s)',async offset=>{
  const pattern=[-1,0,-1,1,0,-1,0,1,1,0,0,0,.25,0,-.5,1,0,-1,0,1,1,0,0,0];
  const points=Float32Array.from({length:67*12},(_,i)=>pattern[i%pattern.length]??0),origins=Array.from({length:67},(_,i)=>[i,i+1,i+2,12]);
  const packed=zlibSync(new Uint8Array(points.buffer)),backing=new Uint8Array(packed.byteLength+4);backing.set(packed,4);
  const loan=offset?backing.subarray(4):packed;expect(unzlibSync(loan)).toEqual(new Uint8Array(points.buffer));
  const shape=new THREE.BoxGeometry(1,1,1);shape.clearGroups();const blocks:Uint8Array[]=[],layout=writeGeometry(shape,blocks,'packed-contact');shape.dispose();
  const modelBytes=join(blocks);
  const scope=new Scope('packed-dressing'),registry=new WorldRegistry(),ctx={} as ShardContext,shardfile={spawn:{x:0,y:0,z:0},entryways:[]};
  const product={shardfile,hasFile:(name:string)=>name==='contacts.bin'||name==='shape.bin',file(name:string):Promise<Uint8Array>{expect(this).toBe(product);expect(['contacts.bin','shape.bin']).toContain(name);return Promise.resolve(name==='contacts.bin'?loan:modelBytes);}};
  Object.assign(ctx,{scope,root:new THREE.Group(),system:vi.fn(),app:{registry},product,game:{runtime:{world:{sky:null}}}});
  const dressing=await SceneDressing.install(ctx,{name:'packed',catalogues:[],packs:{},geometry:{shape:{kind:'file',file:'shape.bin',row:layout}},materials:{paint:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],
    staticModels:[{model:{id:'fixture/packed-contact',name:'Packed',file:'test/scene-dressing-rows.test.ts',category:'props',pipeline:'code',defaults:{}},geometry:'shape',material:'paint'}],
    statics:[{name:'contact',tris:12,geometry:{shape:'shape'},materials:{paint:'paint'},recipe:{version:1,root:'mesh',materials:[{kind:'port',id:'paint',source:'paint'}],nodes:[{kind:'mesh',id:'mesh',geometry:'shape',material:'paint',missing:'empty'}]},
      members:[{model:'fixture/packed-contact',draw:'single',placements:[{x:0,y:0,z:0}],boxes:[-.5,-.5,-.5,.5,.5,.5],contacts:{kind:'packed-hulls',file:'contacts.bin',origins,surface:'rock'}}]}]});
  // DR11: the colliders register by tile (the collider ring); the placement lists them all, in source order
  const rows=dressing.placed[0]?.colliders??[],first=rows[0],second=rows[1];
  if(first?.kind!=='hull'||second?.kind!=='hull')throw new Error('Missing packed contacts');
  expect(rows).toEqual(origins.map(([x,y,z],i)=>({kind:'hull',x,y,z,points:points.slice(i*12,(i+1)*12),surface:'rock'})));
  expect(first.points.buffer).not.toBe(points.buffer);expect(first.points.buffer).not.toBe(second.points.buffer);
  first.points[0]=9;expect(points[0]).toBe(-1);expect(second.points[0]).toBe(.25);scope.dispose();
});

test('geometry source addresses remain binary while the JSON address word stays bounded',()=>{
  const bytes=new Uint8Array(8),view=new DataView(bytes.buffer);view.setUint32(0,17000000,true);view.setUint32(4,10000000,true);
  expect(readSceneGeometryAddress(bytes,0)).toBe(17000000);expect(readSceneGeometryAddress(bytes,1)).toBe(10000000);
  expect(()=>readSceneGeometryAddress(bytes,2)).toThrow();expect(()=>readSceneGeometryAddress(bytes,-1)).toThrow();
  for(const tier of ['phone','desktop']as const)for(const row of Object.values(dressingScene(tier,nalatiDecorative,nalatiRuntime,nalatiBalbal,nalatiSpecimens).geometry))if(row.kind==='baked-file'){
    expect(row.address.word).toBeLessThan(1000000);expect(row.address.file).toBe(`world/dressing-addresses-${tier}.bin`);
    expect(['world/crags.bin','world/dressing.bin','world/places.bin']).toContain(row.file);expect(row).not.toHaveProperty('url');
  }
  for(const tier of ['phone','desktop']as const)expect(Object.values(dressingScene(tier,nalatiDecorative,nalatiRuntime,nalatiBalbal,nalatiSpecimens).geometry).some(row=>row.kind==='baked')).toBe(false);
});

test('Nalati logical bakes admit the exact shipping compressed bytes and decoded costs',async()=>{
  const dressing=buildDressingWire(),stamp=v.object({bytes:v.pipe(v.number(),v.integer(),v.minValue(0))});
  const dressingCost=v.parse(stamp,JSON.parse(new TextDecoder().decode(dressing.document))).bytes;
  const sources=[nameBlob('world/dressing.bin','bin',dressing.binary,{decoded:dressingCost})];
  const placeInputs=new Map([['/assets/baked/nalati-grasslands/terrain.bin',readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')],
    ...['pond','red','green','blue'].map(name=>{const path=`data/geography-${name}.bin`;return[path,scalarBlockBytes({file:path})] as const;})]);
  const ownedPlaces=await nalatiPlacesProgram({cached:(_step,generate)=>Promise.resolve(generate(placeInputs))});
  const placeBytes=ownedPlaces.get('places.bin');if(placeBytes===undefined)throw new Error('Missing native places');
  const placeDocument=ownedPlaces.get('places.json');if(placeDocument===undefined)throw new Error('Missing native places metadata');
  const placeCost=v.parse(stamp,JSON.parse(new TextDecoder().decode(placeDocument))).bytes;
  sources.push(nameBlob('world/places.bin','bin',placeBytes,{decoded:placeCost}));
  sources.push(await nalatiBakeBlob({cached:(_step,generate)=>Promise.resolve(generate(new Map([
    ['/assets/nalati/baked/crags.bin',readFileSync('public/assets/nalati/baked/crags.bin')],
  ])))},'crags',dressingCragDecoded(nalatiCragRows)));
  expect(sources.map(source=>source.file.name).sort((a,b)=>(a??'').localeCompare(b??''))).toEqual(['world/crags.bin','world/dressing.bin','world/places.bin']);
  for(const admitted of sources){
    const name=admitted.file.name?.slice('world/'.length);
    if(name===undefined)throw new Error('Missing named logical bake');
    const original=name==='places.bin'?await originalPlaceBinary():readFileSync(name==='dressing.bin'?'test/fixtures/nalati-dressing.bin':`public/assets/nalati/baked/${name}`);
    expect(admitted.file.hash).toBe(hashImmutableBytes(original));expect(Buffer.compare(admitted.bytes,original)).toBe(0);
    expect((await decodeLaneBytes(admitted.bytes)).byteLength).toBe(admitted.file.decoded);
  }
});

test('the defining dressing contract converts to the admitted named JSON schema',()=>{
  expect(namedJsonSchema(SceneDressingSchema)['type']).toBe('object');
});

test('look bindings remain declared data on an unrelated static scene',async()=>{
  const scope=new Scope('orchard-graph-rows'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),setParam=vi.fn();
  lendLooks(scope,{materials:new Map([['orchard-paint',material]]),setParam:(...args)=>{setParam(...args);},setTexture:()=>undefined,bindMeshMap:()=>material});
  const ctx={} as ShardContext;Object.assign(ctx,{scope,root,system:vi.fn(),app:{registry:new WorldRegistry()},product:{},game:{runtime:{world:{sky:null,player:{position:new THREE.Vector3()},game:{camera:new THREE.PerspectiveCamera()}}}}});
  const host=await SceneDressing.install(ctx,{name:'orchard',catalogues:[],packs:{},geometry:{},materials:{paint:{kind:'look',look:'orchard-paint',params:{threshold:.8,tint:[.2,.4,.6]}}},layers:[],statics:[],animations:[]});
  expect(setParam.mock.calls).toEqual([['orchard-paint','threshold',.8],['orchard-paint','tint',[.2,.4,.6]]]);
  expect(SceneDressing.current(ctx)).toBe(host);scope.dispose();material.dispose();
});

test('an orchard floor table shares the native highest-deck and sampled-height laws',()=>{
  const [deck]=readSceneFloors([{rects:[{x:8,z:5,hw:2,hd:3,y:4},{x:8,z:5,hw:1,hd:1,y:6,slope:.5}]}]);
  expect(deck?.(8,5)).toBe(6);expect(deck?.(8,5.5)).toBe(6.25);expect(deck?.(10,5)).toBe(4);expect(deck?.(20,5)).toBeUndefined();
  const heights=new Float32Array([2,4,6,8]),files=new Map([['orchard-floor.bin',new Uint8Array(heights.buffer)]]);
  const [ground]=readSceneFloors([{x:30,z:40,size:2,res:2,file:'orchard-floor.bin'}],files);
  expect(ground?.(30,40)).toBe(5);expect(ground?.(29,39)).toBe(2);expect(ground?.(31,41)).toBe(8);
  expect(()=>readSceneFloors([{x:0,z:0,size:2,res:3,file:'orchard-floor.bin'}],files)).toThrow('Floor sample byte count differs');
});

test('dressing keeps its small animation and mote rows live after construction',async()=>{
  const scope=new Scope('orchard-runtime-rows'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),setParam=vi.fn();
  lendLooks(scope,{materials:new Map([['orchard-paint',material]]),setParam:(...args)=>{setParam(...args);},setTexture:()=>undefined,bindMeshMap:()=>material});
  const camera=new THREE.PerspectiveCamera(50),ctx={} as ShardContext;
  Object.assign(ctx,{scope,root,system:vi.fn(),app:{registry:new WorldRegistry()},product:{},game:{runtime:{world:{sky:null,player:{position:new THREE.Vector3()},game:{camera,renderer:{getDrawingBufferSize:(size:THREE.Vector2)=>size.set(390,844)}}}}}});
  const host=await SceneDressing.install(ctx,{name:'orchard',catalogues:[],packs:{},geometry:{},materials:{},layers:[],statics:[],
    animations:[{look:'orchard-paint',timeParam:'clock',windParam:'wind',windScale:1,windMax:2}],
    motes:{name:'petals',count:120,seed:91,look:'orchard-paint',drift:.1,driftParam:'offset',pixelParam:'pixels'}});
  host.update(.25);
  expect(setParam).toHaveBeenCalledWith('orchard-paint','clock',.25);
  expect(setParam).toHaveBeenCalledWith('orchard-paint','pixels',844/(2*Math.tan(50*Math.PI/360)));
  const petals=host.group.getObjectByName('petals');
  if(!(petals instanceof THREE.Points))throw new Error('Missing runtime motes');
  const petalShape:unknown=petals.geometry;
  if(!(petalShape instanceof THREE.BufferGeometry))throw new Error('Missing mote geometry');
  const seeds:unknown=petalShape.getAttribute('aSeed');
  if(!(seeds instanceof THREE.BufferAttribute))throw new Error('Missing mote seeds');
  expect(seeds.count).toBe(120);
  host.update(.25);expect(setParam).toHaveBeenCalledWith('orchard-paint','clock',.5);
  scope.dispose();expect(root.children).toHaveLength(0);material.dispose();
});


test('raw floor grids preserve legacy NaN holes, interpolation and shifted buffers',()=>{
  const bytes=new Uint8Array(new Float32Array([2,Number.NaN,6,8]).buffer);
  let packed='';for(const byte of zlibSync(bytes))packed+=String.fromCodePoint(byte);
  const row={x:30,z:40,size:2,res:2},files=new Map([['floor.bin',bytes]]);
  const decoded=unzlibSync(Uint8Array.from(atob(btoa(packed)),value=>value.codePointAt(0)??0));
  const sample=bakedSamplers({res:row.res,size:row.size,heights:new Float32Array(decoded.buffer,decoded.byteOffset,decoded.byteLength/4),seed:0,landscapeHash:0,splat:new Uint8Array(),undergrowth:null}).heightAt;
  const legacy=(x:number,z:number):number|undefined=>{const height=sample(x-row.x,z-row.z);return Number.isFinite(height)?height:undefined;};
  const raw=readSceneFloors([{...row,file:'floor.bin'}],files)[0];
  expect(legacy).toBeDefined();expect(raw).toBeDefined();
  for(let x=28;x<=32;x+=.1)for(let z=38;z<=42;z+=.1)expect(raw?.(x,z)).toBe(legacy?.(x,z));
  expect(raw?.(31,39)).toBeUndefined();
  const shifted=new Uint8Array(bytes.byteLength+1);shifted.set(bytes,1);
  const unaligned=readSceneFloors([{...row,file:'floor.bin'}],new Map([['floor.bin',shifted.subarray(1)]]))[0];
  expect(unaligned?.(29,39)).toBe(legacy?.(29,39));
  expect(()=>readSceneFloors([{...row,file:'floor.bin'}])).toThrow('not prepared');
  expect(()=>readSceneFloors([{...row,file:'floor.bin',data:btoa(packed)}],files)).toThrow();
  expect(()=>readSceneFloors([{...row,file:'floor.bin',res:3}],files)).toThrow('byte count');
});

test.each(['world','retire','length']as const)('raw floor preflight refuses %s before allocation',async failure=>{
  const parent=new Scope('floor.parent'),scope=parent.child('floor.entered'),root=new THREE.Group(),system=vi.fn<ShardContext['system']>();
  type Runtime=NonNullable<ShardContext['game']['runtime']>;
  const runtime=legacyDouble<Runtime>({world:legacyDouble<NonNullable<Runtime['world']>>({})});
  let finish:(bytes:Uint8Array)=>void=()=>{throw new Error('Missing floor read');};
  const read=vi.fn((name:string)=>name==='bad.bin'?Promise.resolve(new Uint8Array(0)):new Promise<Uint8Array>(resolve=>{finish=resolve;}));
  const ctx=legacyDouble<ShardContext>({scope,root,system,product:legacyDouble<ShardContext['product']>({file:read,hasFile:()=>true}),game:legacyDouble<ShardContext['game']>({runtime})});
  const rows={name:'floor',catalogues:[],packs:{},geometry:{shape:{kind:'file',file:'floor.bin',row:{attrs:[['position','f32',1,false]],count:4,index:null,indexCount:0,box:false,expand:false}}},materials:{paint:{kind:'painterly',rim:.2,bands:.5}},layers:[],animations:[],
    staticModels:[{model:{id:'orchard/floor',name:'Floor',file:'fixture.ts',category:'nature',pipeline:'code',defaults:{}},geometry:'shape',material:'paint'}],
    statics:[{name:'surface',recipe:{version:1,root:'root',materials:[],nodes:[{kind:'group',id:'root',children:[]}]},geometry:{},materials:{},tris:0,
      members:[{model:'orchard/floor',draw:'merged',placements:[],boxes:[],contacts:[],floors:[{x:0,z:0,size:2,res:2,file:'floor.bin'},...(failure==='length'?[{x:0,z:0,size:2,res:2,file:'bad.bin'}]:[])]}]}]};
  const owned=vi.spyOn(scope,'own');
  try{
    const pending=SceneDressing.install(ctx,rows);expect(read).toHaveBeenCalledTimes(1);expect(owned).not.toHaveBeenCalled();
    if(failure==='world')runtime.world=legacyDouble<NonNullable<Runtime['world']>>({});
    const retiring=failure==='retire'?parent.disposeSteps():undefined;retiring?.next();finish(new Uint8Array(16));
    await expect(pending).rejects.toThrow(failure==='length'?'byte count':failure==='retire'?'retired':'owner changed');
    expect(owned).not.toHaveBeenCalled();expect(system).not.toHaveBeenCalled();expect(root.children).toEqual([]);
    if(retiring!==undefined)for(const _ of retiring){/* finish the original teardown */}
  }finally{parent.dispose();owned.mockRestore();}
});
