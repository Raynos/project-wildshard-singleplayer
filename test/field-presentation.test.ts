import { expect, it } from 'vitest';
import * as THREE from 'three';
import { zlibSync } from 'fflate';
import { parse } from 'valibot';
import { GrassPresentationSchema, StaticCaptureSchema } from '../src/format/fieldPresentation';
import { GrassPresentationProfile } from '../src/game/looks/grassPresentation';
import { staticCaptureUniforms } from '../src/game/looks/staticCapture';
import { scatterLayer, captureScatterSource, instanceBoxes } from '../src/engine/render/scatterInstances';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';
import { AmbientWingField } from '../src/game/ambient/wingField';
import cover from '../src/shards/nalati-grasslands/boot/cover.generated.json' with { type: 'json' };
import view from '../src/shards/nalati-grasslands/data/grassView.json' with { type: 'json' };
import capture from '../src/shards/nalati-grasslands/data/staticCapture.json' with { type: 'json' };

const encoded = (array: Uint8Array): string => btoa(String.fromCodePoint(...zlibSync(array)));
const raster = encoded(new Uint8Array(2*2*4));
const scene = encoded(new TextEncoder().encode(JSON.stringify({version:1,buffers:[],attributes:[],geometries:[],draws:[]})));
const tier = { rings:[{T:2,G:2}],flowers:{T:3,G:2},cards:{T:1,s:.4},near:[1,2],per:2,scenes:{blades:scene,flowers:scene,cards:scene} };
function orchard() { return { height:encoded(new Uint8Array(8)),mask:raster,field:raster,ground:raster,phone:tier,desktop:tier,
  view:{ ...view,looks:['orchard-blades','orchard-petals','orchard-clover'],half:1,heightSize:2,heightOrigin:-1,lattice:2,gain:.7,gainFalloff:[.1,.2,.3],saturationFalloff:[0,0,0],tintNight:[0,0,0],tintStorm:[0,0,0] } }; }
it('gives an unrelated orchard its own field, mood and texture lifetime',()=>{
  const profile=new GrassPresentationProfile(orchard());profile.mood(1,0,0);
  expect(profile.uniforms.uGrassGain.value).toBeCloseTo(.56);expect(profile.uniforms.uGrassTint.value.toArray()).toEqual([1,1,1]);
  const texture=profile.heightTexture();expect(texture.image.width).toBe(2);expect(profile.heightTexture()).toBe(texture);
  texture.dispose();expect(profile.heightTexture()).not.toBe(texture);profile.heightTexture().dispose();
  const meadow=new GrassPresentationProfile({...orchard(),view});meadow.mood(1,0,0);expect(meadow.uniforms.uGrassGain.value).toBe(.9);
});
it('refuses unbounded field draws and invalid capture bounds before allocating',()=>{
  const row=orchard();row.phone.rings[0]={T:2,G:100};expect(()=>parse(GrassPresentationSchema,row)).toThrow();
  expect(()=>parse(StaticCaptureSchema,{...capture,half:Infinity})).toThrow();
});
it('keeps static capture uniforms independent for differently sized worlds',()=>{
  const small=staticCaptureUniforms({...capture,half:20,contact:.2}),large=staticCaptureUniforms(capture);
  expect(small.uContactXf.value.toArray()).toEqual([-20,-20,.025,0]);
  small.uBakeInfo.value.x=1;expect(large.uBakeInfo.value.x).toBe(0);
});
const pose={x:0,y:0,z:0,yaw:0,sx:1,sy:2,sz:1,far:30,r:.8,g:.6,b:.4};
it('draws orchard scatter with the same range fade and immutable source inventory',()=>{
  const geometry=new THREE.BoxGeometry(2,2,2),material=new THREE.MeshBasicMaterial();
  const layer=scatterLayer('orchard-crates',geometry,material,[pose,{...pose,x:50}],1);
  const camera=new THREE.PerspectiveCamera(90,1,.1,100);camera.position.set(0,2,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  layer.cull(frustum,new THREE.Vector3());expect(layer.visible).toBe(1);expect(layer.mesh.name).toBe('orchard-crates');
  const source=captureScatterSource(layer.mesh);expect(source?.count).toBe(2);if(source===undefined)throw new Error('Missing source');source.matrices[12]=123;
  expect(captureScatterSource(layer.mesh)?.matrices[12]).toBe(0);
  layer.cull(frustum,new THREE.Vector3(0,0,29));expect(layer.mesh.instanceMatrix.array[0]).toBeGreaterThan(0);expect(layer.mesh.instanceMatrix.array[0]).toBeLessThan(1);
  expect([...instanceBoxes(geometry,[pose])]).toEqual([-1,-2,-1,1,2,1]);geometry.dispose();material.dispose();
});
it('rejects malformed scatter poses before allocating meshes',()=>{
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();expect(()=>scatterLayer('broken',geometry,material,[{...pose,far:Infinity}],1)).toThrow('Invalid scatter');geometry.dispose();material.dispose();
});
it('projects two row-selected wing layers without knowing a species',()=>{
  setTerrainHeight(()=>0);
  const shape=new THREE.PlaneGeometry(),material=new THREE.MeshBasicMaterial(),row=cover.phone.life[0];if(row===undefined)throw new Error('Missing flight row');
  const field=new AmbientWingField({layers:[{id:'orchard-moth',capacity:20,palette:['#efe0c0'],flap:[8,.3,.1]}],groups:[{kind:'orchard-moth',row:{...row.row,wheeling:null,seed:19,count:2},perches:row.perches}]},new Map([['orchard-moth',shape]]),new Map([['orchard-moth',material]]));
  field.update(.05,new THREE.Vector3());field.update(.05,new THREE.Vector3());
  const mesh=field.group.children[0];expect(mesh).toBeInstanceOf(THREE.InstancedMesh);if(!(mesh instanceof THREE.InstancedMesh))throw new Error('Missing wing mesh');expect(mesh.count).toBeLessThanOrEqual(4);expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);shape.dispose();material.dispose();
});
