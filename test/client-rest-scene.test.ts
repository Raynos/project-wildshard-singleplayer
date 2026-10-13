// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clientSceneGlb } from '../src/sdk/bake/glb';
import { createModelLibrary } from '../src/game/plugin/geometry';
import { createClientScene } from '../src/game/plugin/ui';
import { winchRest, hoverRest } from '../src/shards/far-reach/generators/restScene';
import { wellRest, oilRest } from '../src/shards/sunscar-dunes/generators/restScene';
import { namedSceneExample } from '../scripts/docs/authoring/named-nodes';
import { WELL_RIG, HD } from '../src/shards/sunscar-dunes/data/places';

const files = new Map<string, Uint8Array>();
vi.stubGlobal('fetch', (input: string | URL | Request) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const name = new URL(url, location.href).pathname.slice(1), bytes = files.get(name);
  if (bytes === undefined) throw new Error(`Missing fixture pool ${name}`);
  return Promise.resolve(new Response(bytes.slice().buffer));
});

function meshNode(value: Object3D): value is Mesh { return value instanceof Mesh; }
function channels(actual: BufferGeometry, original: BufferGeometry): void {
  expect(Object.keys(actual.attributes)).toEqual(Object.keys(original.attributes));
  for (const name of Object.keys(original.attributes)) {
    const a = actual.getAttribute(name), b = original.getAttribute(name);
    expect([a.itemSize, a.normalized, a.array.constructor.name]).toEqual([b.itemSize, b.normalized, b.array.constructor.name]);
    expect(a.array).toEqual(b.array);
  }
  expect(actual.index?.array ?? null).toEqual(original.index?.array ?? null);
  expect(actual.index?.array.constructor.name).toEqual(original.index?.array.constructor.name);
  expect(actual.groups).toEqual(original.groups); expect(actual.boundingBox).toEqual(original.boundingBox); expect(actual.boundingSphere).toEqual(original.boundingSphere);
}
async function restore(made: ReturnType<typeof clientSceneGlb>, materials: ReadonlyMap<string, MeshStandardMaterial>) {
  const url = `fixture-${files.size}.glb`; files.set(url, made.glb);
  const parts = made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []);
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1, geometryPools: [{ url, parts }] }, '[rest fixture]');
  await library.preload();
  return { library, scene: createClientScene(made.scene, { geometry: library.geometry, materials }) };
}

it('restores the released winch, bucket and oil channels without normal fitting or wider index words', async () => {
  // Released native primitives from shapes.ts/places.ts before this deletion, in original allocation order.
  const rope = new CylinderGeometry(.02,.02,WELL_RIG.drop,4); rope.translate(0,WELL_RIG.drop/2,0);
  const cases: readonly [ReturnType<typeof clientSceneGlb>, readonly BufferGeometry[]][] = [
    [winchRest(), [new BoxGeometry(.2,1.2,.2),new BoxGeometry(.2,1.2,.2),new CylinderGeometry(.32,.32,1.2,8),new BoxGeometry(.1,.6,.1)]],
    [wellRest(), [rope,new CylinderGeometry(.26,.2,.36,8,1,true),new SphereGeometry(.17,8,6)]],
    [oilRest(), [new CylinderGeometry(.33,.33,.04,8)]],
  ];
  const nativeMaterials = [
    [[0x5a3f2e,.95,true,0],[0x5a3f2e,.95,true,0],[0x6a5c4a,.95,true,0],[0x5a3f2e,.95,true,0]],
    [[0x6b5236,.92,true,0],[0xa07656,.92,true,2],[0x7a3a22,.92,true,0]],
    [[0x1a120c,.2,false,0]],
  ];
  for (const [caseIndex,[made, originals]] of cases.entries()) {
    const materials = new Map(made.scene.materials.map(row => [row.id,new MeshStandardMaterial()]));
    const { library, scene } = await restore(made,materials), meshes: Mesh[] = [];
    scene.root.traverse(node => { if (meshNode(node)) meshes.push(node); }); expect(meshes).toHaveLength(originals.length);
    for (const [index,node] of meshes.entries()) {
      const original = originals[index]; if (original === undefined) throw new Error('Missing released primitive');
      channels(node.geometry,original);
      if (!(node.material instanceof MeshStandardMaterial)) throw new Error('Missing native PBR material');
      expect([node.material.color.getHex(),node.material.roughness,node.material.flatShading,node.material.side]).toEqual(nativeMaterials[caseIndex]?.[index]);
      const id = [...scene.parts].find(([,part]) => part === node)?.[0];
      const declaration = made.scene.nodes.find(part => part.id === id);
      if (declaration?.kind !== 'mesh') throw new Error('Missing scene mesh declaration');
      const materialRow = made.scene.materials.find(row => row.id === declaration.material);
      if (materialRow?.kind === 'port') expect(node.material).toBe(materials.get(declaration.material));
      else {
        if (!(node.material instanceof MeshStandardMaterial) || materialRow?.kind !== 'standard') throw new Error('Missing original standard material');
        const { normalScale, ...properties } = materialRow.properties, originalMaterial = new MeshStandardMaterial(properties);
        if (normalScale !== undefined) originalMaterial.normalScale.set(...normalScale);
        expect([node.material.color.toArray(),node.material.roughness,node.material.metalness,node.material.flatShading,node.material.side,node.material.opacity,node.material.depthWrite]).toEqual([originalMaterial.color.toArray(),originalMaterial.roughness,originalMaterial.metalness,originalMaterial.flatShading,originalMaterial.side,originalMaterial.opacity,originalMaterial.depthWrite]); originalMaterial.dispose();
      }
      const copy = library.geometry(declaration.geometry); if (copy === null) throw new Error('Missing loaded rest geometry');
      copy.scale(2,3,4); copy.dispose(); const untouched = library.geometry(declaration.geometry);
      if (untouched === null) throw new Error('Disposed loan lost its backing'); channels(untouched,original); untouched.dispose();
    }
    if (scene.group('bucket') !== null) { expect(scene.group('bucket')?.position.y).toBe(WELL_RIG.axleY-WELL_RIG.drop); expect(scene.mesh('jar')?.scale.toArray()).toEqual([1,1.3,1]); }
    if (scene.mesh('oil') !== null) { expect(scene.mesh('oil')?.visible).toBe(false); expect(scene.mesh('oil')?.position.y).toBe(HD.brazier*HD.bowlAt); }
    const disposals = [...materials.values()].map(material => vi.spyOn(material,'dispose')), owned = [...scene.materials.values()].map(material => vi.spyOn(material,'dispose')); scene.dispose(); scene.dispose(); expect(disposals.every(spy => spy.mock.calls.length === 0)).toBe(true); expect(owned.every(spy => spy.mock.calls.length === 1)).toBe(true);
    for (const geometry of originals) geometry.dispose(); for (const material of materials.values()) material.dispose();
  }
});

it('keeps the hover glass first, end/pylon order, shared frame and renderOrder across independent pool copies', async () => {
  const made = hoverRest(13.25,2.6,'hover'), glass = new MeshStandardMaterial({ transparent:true,opacity:.16,depthWrite:false }), frame = new MeshStandardMaterial();
  const { scene } = await restore(made,new Map([['glass',glass],['frame',frame]]));
  const ids = ['hover-slab','hover-bar-0','hover-bar-1','hover-end-0','hover-pylon-0-0','hover-pylon-0-1','hover-end-1','hover-pylon-1-0','hover-pylon-1-1'];
  expect(scene.root.children).toEqual(ids.map(id => scene.parts.get(id)));
  const slab = scene.mesh(ids[0] ?? ''); if (slab === null) throw new Error('Missing glass slab');
  channels(slab.geometry,new BoxGeometry(2.6-.16,.05,13.25-.16)); expect(slab.material).toBe(glass); expect(slab.renderOrder).toBe(4);
  for (const id of ids.slice(1)) expect(scene.mesh(id)?.material).toBe(frame);
  expect(slab.position.toArray()).toEqual([0,-.05,-13.25/2]); scene.dispose(); glass.dispose(); frame.dispose();
});

it('refuses custom/normalized channels, nonordinary owners and ambiguous materials before baking', () => {
  const root = new Group(), material = new MeshStandardMaterial(), geometry = new BoxGeometry(), mesh = new Mesh(geometry,material); root.name='root'; mesh.name='body'; root.add(mesh);
  const ports = new Map([[material,'paint']]);
  geometry.setAttribute('custom',new BufferAttribute(new Float32Array(geometry.getAttribute('position').count),1)); expect(()=>clientSceneGlb(root,ports)).toThrow('supported Float32'); geometry.deleteAttribute('custom');
  geometry.getAttribute('normal').normalized=true; expect(()=>clientSceneGlb(root,ports)).toThrow('supported Float32'); geometry.getAttribute('normal').normalized=false;
  mesh.matrixAutoUpdate=false; expect(()=>clientSceneGlb(root,ports)).toThrow('ordinary transform'); mesh.matrixAutoUpdate=true;
  const other = new MeshStandardMaterial(), second = new Mesh(geometry,other); second.name='other';root.add(second); ports.set(other,'paint'); expect(()=>clientSceneGlb(root,ports)).toThrow('aliases distinct owners'); geometry.dispose();material.dispose();other.dispose();
});

it('refuses a damaged original-group extent before publishing any geometry in the pool', async () => {
  const made=winchRest(), gltf=await new GLTFLoader().parseAsync(made.glb.slice().buffer,'');
  const mesh=gltf.scene.children[0]; if (!(mesh instanceof Mesh)) throw new Error('Missing damaged fixture mesh');
  // Mutate the real JSON chunk, not a trusted admission callback.
  const bytes=made.glb, view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), length=view.getUint32(12,true);
  const document: unknown=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));
  if (typeof document !== 'object' || document === null || !('nodes' in document) || !Array.isArray(document.nodes)) throw new Error('Missing fixture nodes');
  const node: unknown = document.nodes[0];
  if (typeof node !== 'object' || node === null || !('extras' in node) || typeof node.extras !== 'object' || node.extras === null || !('restGroups' in node.extras) || !Array.isArray(node.extras.restGroups)) throw new Error('Missing fixture groups');
  const group: unknown = node.extras.restGroups[0]; if (!Array.isArray(group)) throw new Error('Missing fixture group'); group[1]=999999;
  const text=new TextEncoder().encode(JSON.stringify(document)), padded=Math.ceil(text.length/4)*4, changed=new Uint8Array(bytes.length-length+padded), output=new DataView(changed.buffer);
  changed.set(bytes.subarray(0,20));output.setUint32(8,changed.length,true);output.setUint32(12,padded,true);changed.fill(32,20,20+padded);changed.set(text,20);changed.set(bytes.subarray(20+length),20+padded);
  const error=vi.spyOn(console,'error').mockImplementation(()=>undefined), url='damaged-rest.glb';files.set(url,changed);
  const library=createModelLibrary<never,never>({meshes:[],meshUrls:{},hd:[],hdUrls:{},hdLooks:{},aoFloor:1,geometryPools:[{url,parts:made.scene.nodes.flatMap(part=>part.kind==='mesh'?[part.geometry]:[])}]},'[damaged]');
  await library.preload(); expect(error).toHaveBeenCalled();expect(library.geometry('winch-post-0')).toBeNull();error.mockRestore();
});

it('executes the published named scene example through the same admitted pool and assembler', async () => {
  const made = namedSceneExample(), stone = new MeshStandardMaterial(), { scene } = await restore(made,new Map([['stone',stone]]));
  expect(scene.root.children).toHaveLength(1); expect(scene.mesh('tower')?.material).toBe(stone); expect(scene.mesh('tower')?.geometry.index?.array).toBeInstanceOf(Uint16Array); scene.dispose(); stone.dispose();
});

it('admits only boolean flat shading and retains the original absent false default', () => {
  const geometry=new BoxGeometry();
  const row={version:1,root:'root',nodes:[{kind:'mesh',id:'root',geometry:'body',material:'paint',missing:'empty'}],materials:[{kind:'standard',id:'paint',properties:{}}]};
  for(const flat of [undefined,false,true]) { const input={...row,materials:[{kind:'standard',id:'paint',properties:flat===undefined?{}:{flatShading:flat}}]};const scene=createClientScene(input,{geometry:()=>geometry});expect(scene.standardMaterial('paint')?.flatShading).toBe(flat??false);scene.dispose(); }
  for(const flat of [null,0,'true',()=>true])expect(()=>createClientScene({...row,materials:[{kind:'standard',id:'paint',properties:{flatShading:flat}}]},{geometry:()=>geometry})).toThrow();geometry.dispose();
});
