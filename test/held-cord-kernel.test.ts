// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Hashes the exact original raw presentation geometry.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { type BufferGeometry, Mesh, MeshBasicMaterial, BufferAttribute } from 'three';
import { ClientChannels } from '../src/sdk/clientChannels';
import { createClientChannels, createClientChannelView } from '../src/game/plugin/ui';
import { cordGeometry } from '../src/shards/sunscar-dunes/generators/lash';
import { LashCord } from '../src/shards/sunscar-dunes/runtime/items/lashView';
import { LASH_CORD } from '../src/shards/sunscar-dunes/data/whip';

function declared() {
 const g=new ClientChannels('cord');
 g.deformTube({kind:'tubeCurve',target:'cord',segments:30,radial:6,
  from:[g.read('from.x'),g.read('from.y'),g.read('from.z')],to:[g.read('to.x'),g.read('to.y'),g.read('to.z')],
  extent:g.read('extent'),wave:g.read('wave'),bend:[Math.PI,.7],ripple:[9,40,.25],drop:[3.1,.05],radius:[.0045,2.5,.0022,.93,.002]});
 return g.build();
}
function isAttribute(value: unknown): value is BufferAttribute { return value instanceof BufferAttribute; }
function rawAttribute(geometry: BufferGeometry, name: string): BufferAttribute {
 const attribute: unknown = geometry.getAttribute(name);
 if (!isAttribute(attribute) || !(attribute.array instanceof Float32Array)) throw new Error('Expected original Float32 attribute');
 return attribute;
}
it('keeps the exact original 120-frame position and normal bytes with stable private storage',()=>{
 const kernelCord=new LashCord(LASH_CORD,cordGeometry(LASH_CORD)), mesh=kernelCord.mesh, program=declared();
 const lane=createClientChannelView(program,new Map([['cord',mesh]]),new Map([['cord',(row,object)=>kernelCord.bindCurve(row,object)]]));
 if(program.geometry===undefined)throw new Error('Missing declared geometry');
 program.geometry.radius[0]=99; // Admission and binding detach the author row.
 const values=[.03,-.05,.06,-.155,.194,-7,0,0],observation={time:0,delta:1/60,values},hash=createHash('sha256');
 const position=rawAttribute(mesh.geometry,'position');let normal: BufferAttribute | undefined;
 for(let i=0;i<120;i++){
  values[6]=(i%31)/30;values[7]=.05+(i%7)*.1;observation.time=i/60;lane.evaluate(observation);
  if(i===0)normal=rawAttribute(mesh.geometry,'normal');
  expect(rawAttribute(mesh.geometry,'position')).toBe(position);expect(rawAttribute(mesh.geometry,'normal')).toBe(normal);
  for(const attribute of [position,normal]){
   if(attribute===undefined)throw new Error('Original normal layout missing');
   hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
 }
 // Parent 4dbf79594 LashCord.shape, 186 vertices, original normal recomputation.
 expect(hash.digest('hex')).toBe('391b0bd0476664dfbdd9c3fb2c720b772ffe3ee633d6052ac9723f91f247277f');
 mesh.geometry.dispose();mesh.material.dispose();
});
it('refuses excess layouts, absent nodes, mutated input, non-private targets and crossed geometry before mutation',()=>{
 const program=declared();
 for(const geometry of [{...program.geometry,segments:1024,radial:64},{...program.geometry,radial:2},{...program.geometry,extent:127},{...program.geometry,radius:[0,-1,0,0,0]}])expect(()=>createClientChannels({...program,geometry})).toThrow();
 expect(()=>createClientChannels({id:'empty',reads:[],nodes:[{op:'constant',value:0}],channels:[]})).toThrow();
 expect(()=>createClientChannelView(program,new Map([['cord',{}]]))).toThrow();
 const missing=new Mesh(cordGeometry(LASH_CORD),new MeshBasicMaterial());expect(()=>createClientChannelView(program,new Map([['cord',missing]]))).toThrow('Missing trusted private geometry kernel');missing.geometry.dispose();missing.material.dispose();
 const emptyCord=new LashCord(LASH_CORD,null), empty=emptyCord.mesh;
 const inactive=createClientChannelView(program,new Map([['cord',empty]]),new Map([['cord',(row,object)=>emptyCord.bindCurve(row,object)]]));inactive.evaluate({time:0,delta:0,values:[0,0,0,0,0,0,0,0]});
 expect(empty.geometry.attributes).toEqual({});empty.geometry.dispose();empty.material.dispose();
 const badCord=new LashCord({...LASH_CORD,segments:29},cordGeometry({...LASH_CORD,segments:29})), bad=badCord.mesh;expect(()=>createClientChannelView(program,new Map([['cord',bad]]),new Map([['cord',(row,object)=>badCord.bindCurve(row,object)]]))).toThrow();bad.geometry.dispose();bad.material.dispose();
 const kernelCord=new LashCord(LASH_CORD,cordGeometry(LASH_CORD)), mesh=kernelCord.mesh;const lane=createClientChannelView(program,new Map([['cord',mesh]]),new Map([['cord',(row,object)=>kernelCord.bindCurve(row,object)]]));const prior=rawAttribute(mesh.geometry,'position').array.slice();
 for(const ext of [-1,2])expect(()=>lane.evaluate({time:0,delta:0,values:[0,0,0,0,0,-7,ext,.1]})).toThrow();
 expect(rawAttribute(mesh.geometry,'position').array).toEqual(prior);
 expect(()=>lane.evaluate({time:0,delta:0,values:[0,0,0,0,0,Number.NaN,1,.1]})).toThrow();
 expect(rawAttribute(mesh.geometry,'position').array).toEqual(prior);
 mesh.geometry.dispose();mesh.material.dispose();
});
