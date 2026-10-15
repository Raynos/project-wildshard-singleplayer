import { afterEach, expect, it, vi } from 'vitest';
import { BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { createModelLibrary, type ModelGeometryPool } from '../src/game/plugin/geometry';

afterEach(() => { vi.restoreAllMocks(); });
const empty = {meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1};
function primitive(name: string): Mesh {
  const geometry = new PlaneGeometry(1, 2); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshStandardMaterial()); mesh.name = name;
  mesh.userData['restGroups'] = []; mesh.userData['restBox'] = [-0.5,-1,0,0.5,1,0]; mesh.userData['restSphere'] = [0,0,0,Math.sqrt(1.25)];
  return mesh;
}
it('borrows exact declared channels with a strict per-part subset and no vertex copy', async () => {
  const a = primitive('a'), b = primitive('b'), scene = new Group(); scene.add(a,b);
  const wind = new BufferAttribute(new Float32Array([0,-0,0.5,1]),1), bark = new BufferAttribute(new Float32Array([0,1,2,3]),1);
  a.geometry.setAttribute('_wind',wind); b.geometry.setAttribute('_wind',wind); a.geometry.setAttribute('_bark',bark);
  const library = createModelLibrary<never,never>({...empty,geometryPools:[{url:'pool',parts:['a','b'],channels:[
    {name:'aWind',source:'_wind',width:1},{name:'aBark',source:'_bark',width:1,parts:['a']},
  ]}]},'test',{},()=>Promise.resolve({scene}));
  await library.preload();
  expect(library.geometry('a',{borrow:true})?.getAttribute('aWind')).toBe(wind);
  expect(library.geometry('a',{borrow:true})?.getAttribute('aBark')).toBe(bark);
  expect(library.geometry('b',{borrow:true})?.hasAttribute('aBark')).toBe(false);
  expect(library.geometry('a',{borrow:true})?.hasAttribute('_wind')).toBe(false);
  expect(Object.is(wind.getX(1),-0)).toBe(true);
});
it('refuses malformed declarations, missing channels and undeclared extra attributes', async () => {
  const pool:ModelGeometryPool={url:'pool',parts:['a'],channels:[{name:'aWind',source:'_wind',width:1}]};
  for(const channels of [[{name:'aWind',source:'_wind',width:5}],[{name:'position',source:'_wind',width:1}],[{name:'aWind',source:'_wind',width:1,parts:['missing']}],[{name:'aWind',source:'__proto__',width:1}]]) {
    expect(()=>createModelLibrary<never,never>({...empty,geometryPools:[{...pool,channels}]},'test')).toThrow();
  }
  const error=vi.spyOn(console,'error').mockImplementation(()=>undefined);
  for(const extra of [false,true]){
    const mesh=primitive('a'),scene=new Group();scene.add(mesh);
    if(extra){mesh.geometry.setAttribute('_wind',new BufferAttribute(new Float32Array(4),1));mesh.geometry.setAttribute('_unlisted',new BufferAttribute(new Float32Array(4),1));}
    const library=createModelLibrary<never,never>({...empty,geometryPools:[pool]},'test',{},()=>Promise.resolve({scene}));
    await library.preload();expect(library.geometry('a')).toBeNull();
  }
  expect(error).toHaveBeenCalledTimes(2);
});
