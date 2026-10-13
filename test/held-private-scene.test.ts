// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { parsePrivateScene } from '../src/format/clientChannels';
import { createClientScene } from '../src/game/plugin/ui';

const row = { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: ['second', 'hero', 'first'] },
  { kind: 'mesh', id: 'first', geometry: 'body', material: 'paint', missing: 'empty', position: [1, 2, 3] },
  { kind: 'mesh', id: 'second', geometry: 'body', material: 'paint', missing: 'empty' },
  { kind: 'object', id: 'hero', source: 'hero', missing: 'omit', position: [4, 5, 6] },
  { kind: 'anchor', id: 'joint', source: 'hero', path: [0, 0], missing: 'omit', children: ['leaf'] },
  { kind: 'mesh', id: 'leaf', geometry: 'body', material: 'silk', missing: 'empty' },
], materials: [
  { kind: 'standard', id: 'paint', properties: { color: 0x123456, roughness: .78, metalness: 0 }, maps: {map: 'paint'}, userData: { held: true } },
  { kind: 'port', id: 'silk', source: 'silk' },
] };

it('assembles the declared draw order and original imported anchor without duplicating or disposing ports', () => {
  const hero = new Group(), holder = new Group(), joint = new Group(), existing = new Group();
  hero.add(holder); holder.add(joint); joint.add(existing);
  const geometry = new BoxGeometry(), silk = new MeshStandardMaterial(), texture = new Texture();
  const ports = {geometry: () => geometry, objects: new Map([['hero', hero]]), materials: new Map([['silk', silk]]), textures: new Map([['paint', texture]])};
  const scene = createClientScene(row, ports), first = scene.parts.get('first'), second = scene.parts.get('second'), leaf = scene.parts.get('leaf');
  if (!(first instanceof Mesh) || !(second instanceof Mesh) || !(first.material instanceof MeshStandardMaterial)) throw new Error('Missing declared mesh');
  expect(scene.root.children).toEqual([second, hero, first]);
  expect(joint.children).toEqual([existing, leaf]); expect(hero.position.toArray()).toEqual([4,5,6]);
  expect(first.geometry).toBe(geometry); expect(second.geometry).toBe(geometry); expect(first.material).toBe(second.material);
  expect(first.material.map).toBe(texture); expect(first.material.roughness).toBe(.78); expect(first.material.color.getHex()).toBe(0x123456);
  const owned = vi.spyOn(first.material, 'dispose'), borrowed = vi.spyOn(silk, 'dispose'), backing = vi.spyOn(geometry, 'dispose');
  scene.dispose(); scene.dispose(); expect(owned).toHaveBeenCalledTimes(1); expect(borrowed).not.toHaveBeenCalled(); expect(backing).not.toHaveBeenCalled();
  geometry.dispose(); silk.dispose(); texture.dispose();
});

it('drops absent optional subtrees before decoding geometry or requiring their materials', () => {
  const geometry = new BoxGeometry(), decode = vi.fn(() => geometry), texture = new Texture();
  const scene = createClientScene(row, { geometry: decode, objects: new Map([['hero',null]]), textures: new Map([['paint',texture]]) });
  expect(decode).toHaveBeenCalledTimes(2); expect(scene.parts.has('leaf')).toBe(false); expect(scene.parts.has('joint')).toBe(false);
  expect(scene.root.children).toHaveLength(2); scene.dispose(); geometry.dispose(); texture.dispose();
});

it('refuses cycles, crossed identities, unknown fields and absent required anchors before changing owned assets', () => {
  const hero = new Group(), before = hero.position.clone(), geometry = new BoxGeometry(), texture = new Texture();
  const ports = {geometry: () => geometry, objects: new Map([['hero',hero]]), textures: new Map([['paint',texture]])};
  for (const input of [
    {...row, extra:true}, {...row, nodes:[...row.nodes,row.nodes[0]]},
    {...row,nodes:row.nodes.map(node => node.id==='first'?{...node,children:['root']}:node)},
    {...row,nodes:row.nodes.map(node => node.id==='first'?{...node,material:'unknown'}:node)},
  ]) expect(() => parsePrivateScene(input)).toThrow();
  const required = structuredClone(row), anchor = required.nodes.find(node => node.id === 'joint');
  if (anchor === undefined) throw new Error('Missing fixture anchor'); anchor.missing = 'refuse';
  expect(() => createClientScene(required,ports)).toThrow('Required private anchor unavailable');
  expect(hero.position.equals(before)).toBe(true); expect(hero.children).toEqual([]);
  geometry.dispose(); texture.dispose();
});

it('decodes declared RGBA planes with exact sampler values and one owned material decorator', () => {
  const wire = Uint8Array.from([1,2,3,4,5,6,7,8]), geometry = new BoxGeometry(), repeat: [number,number] = [3.25,1];
  const decorate = vi.fn((material: MeshStandardMaterial) => { material.userData['decorated'] = true; });
  const input = {version:1,root:'root',nodes:[{kind:'group',id:'root',children:['leaf']},{kind:'mesh',id:'leaf',geometry:'body',material:'paint',missing:'empty'}],
    materials:[{kind:'standard',id:'paint',properties:{roughness:1,metalness:0,fog:false},maps:{map:'tile'},decorate:'paint'}],
    textures:[{kind:'rgba',id:'tile',source:'wire',width:1,height:1,offset:4,bytes:8,colorSpace:'srgb',repeat:{port:'repeat'},wrapS:1000,wrapT:1000,magFilter:1006,minFilter:1008,mipmaps:true,anisotropy:4}]};
  const scene = createClientScene(input,{geometry:()=>geometry,textures:new Map([['wire',wire]]),textureRepeat:new Map([['repeat',repeat]]),decorators:new Map([['paint',decorate]])});
  const material = scene.standardMaterial('paint');
  if (material?.map === null || material?.map === undefined) throw new Error('Declared texture missing');
  expect(material.map.repeat.toArray()).toEqual([3.25,1]); repeat[0]=99; expect(material.map.repeat.toArray()).toEqual([3.25,1]);
  expect([material.map.wrapS,material.map.wrapT,material.map.magFilter,material.map.minFilter,material.map.anisotropy,material.map.colorSpace,material.map.generateMipmaps]).toEqual([1000,1000,1006,1008,4,'srgb',true]);
  expect(decorate).toHaveBeenCalledTimes(1); expect(material.userData['decorated']).toBe(true);
  const disposed=vi.spyOn(material.map,'dispose');scene.dispose();scene.dispose();expect(disposed).toHaveBeenCalledTimes(1);
  expect(()=>createClientScene(input,{geometry:()=>geometry,textures:new Map([['wire',new Uint8Array(4)]]),textureRepeat:new Map([['repeat',[1,1]]]),decorators:new Map([['paint',decorate]])})).toThrow('Private RGBA byte extent differs');
  geometry.dispose();
});
