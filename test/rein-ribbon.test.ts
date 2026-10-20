import type { Animal } from '../src/engine/entities/AnimalView';
import { legacyDouble } from './fake/FakeGame';
import { expect, test } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3,Bone,BufferAttribute,InterleavedBufferAttribute,BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,SkinnedMesh,MeshBasicMaterial,Skeleton } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import type { ReinRibbonFrame, ReinRibbonRows } from '@wildshard/format/riding';
import { MountedReins,ReinRibbon, buildReinsRibbon, fillRein } from '@wildshard/game/riding/reins';
import rows from '../src/shards/nalati-grasslands/data/reins.json' with { type: 'json' };

const orchard: ReinRibbonRows = { span: 3, halfWidth: .014, heldRate: 4, droppedSag: .09,
  hand: { x: .3, y: -1.2, depth: .7 }, neck: { down: .02, out: .13 }, jowl: { down: .08, out: .2 },
  bit: { back: .2, out: .1 }, colour: [.12, .2, .3], edge: [.3, .4, .6], paint: { rim: .2, bands: .4, shade: .9 } };
const frame: ReinRibbonFrame = { yaw: Math.PI, drop: false, withers: [0, -.5, -.7], crest: [0, -.5, -1.05], head: [0, -.55, -1.75], muzzle: [0, -1, -2.1] };

function centre(geometry: unknown, index: number): Vector3 {
  if (!(geometry instanceof BufferGeometry)) throw new Error('Missing strap geometry');
  const positions: unknown = geometry.getAttribute('position');
  if (!(positions instanceof BufferAttribute || positions instanceof InterleavedBufferAttribute)) throw new Error('Missing strap positions');
  return new Vector3().fromBufferAttribute(positions, index).add(new Vector3().fromBufferAttribute(positions, index + 1)).multiplyScalar(.5);
}

test.each([['steppe', rows], ['orchard mule', orchard]] as const)('%s rows draw camera-attached straps, drop and release', (_name, profile) => {
  const scope = new Scope('rein-fixture'), camera = new PerspectiveCamera(70, 9 / 19.5), ribbon = new ReinRibbon(camera, profile, scope);
  const child = ribbon.group.children[0];
  if (!(child instanceof Mesh)) throw new Error('Missing rein mesh');
  const mesh = child as Mesh;
  let geometryDisposed = false, materialDisposed = false;
  mesh.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  material?.addEventListener('dispose', () => { materialDisposed = true; });
  try {
    expect(ribbon.group.visible).toBe(false);
    ribbon.update(1 / 30, frame);
    expect(mesh.geometry.getAttribute('position').count).toBe(4 * (profile.span * 3 + 1));
    const tan = Math.tan(70 * Math.PI / 360), hand = new Vector3(-profile.hand.x * profile.hand.depth * tan * camera.aspect, profile.hand.y * profile.hand.depth * tan, -profile.hand.depth);
    expect(centre(mesh.geometry, 0).distanceTo(hand)).toBeLessThan(1e-6);
    const bit = new Vector3(...frame.muzzle).lerp(new Vector3(...frame.head), profile.bit.back).add(new Vector3(-profile.bit.out, 0, 0));
    expect(centre(mesh.geometry, profile.span * 6).distanceTo(bit)).toBeLessThan(1e-6);
    ribbon.update(1, { ...frame, drop: true });
    expect(centre(mesh.geometry, 0).distanceTo(new Vector3(...frame.withers))).toBeLessThan(1e-6);
    camera.position.set(2, 1, 0); camera.rotation.y = .3;
    ribbon.update(1 / 30, { ...frame, drop: true });
    const expected = new Vector3(...frame.withers).applyMatrix4(camera.matrixWorldInverse);
    expect(centre(mesh.geometry, 0).distanceTo(expected)).toBeLessThan(1e-6);
    expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    ribbon.update(0, null);
    expect(ribbon.group.visible).toBe(false);
    ribbon.update(0, frame);
    expect(centre(mesh.geometry, 0).distanceTo(hand)).toBeLessThan(1e-6);
  } finally { scope.dispose(); }
  expect(ribbon.group.parent).toBe(null);
  expect(geometryDisposed).toBe(true); expect(materialDisposed).toBe(true);
});

test('the strap follows all three Catmull-Rom spans and keeps its authored width', () => {
  const built = buildReinsRibbon(orchard), points = [new Vector3(-.1, -.6, -.1), new Vector3(-.2, -.7, -.4), new Vector3(-.4, -.4, -1), new Vector3(-.3, -.6, -1.5), new Vector3(-.2, -.8, -2), new Vector3(-.1, -1, -2.5)];
  try {
    fillRein(built.pos, 0, points, orchard);
    for (let span = 0; span < 4; span++) {
      const point = points[span + 1];
      expect(centre(built.mesh.geometry, span * orchard.span * 2).distanceTo(point ?? new Vector3())).toBeLessThan(1e-6);
    }
    const left = new Vector3().fromArray(built.pos), right = new Vector3().fromArray(built.pos, 3);
    expect(left.distanceTo(right)).toBeCloseTo(orchard.halfWidth * 2, 6);
  } finally { built.mesh.geometry.dispose(); for (const material of Array.isArray(built.mesh.material) ? built.mesh.material : [built.mesh.material]) material.dispose(); }
  expect(() => buildReinsRibbon({ ...orchard, span: 0 })).toThrow('Invalid rein dimensions');
});


test('orchard mount rows sample their own skeleton and weighted muzzle without a view hook',()=>{
  const scope=new Scope('orchard.reins'),camera=new PerspectiveCamera(70,9/19.5),geometry=new BufferGeometry(),material=new MeshBasicMaterial();
  geometry.setAttribute('position',new Float32BufferAttribute([0,-.2,-2,.1,0,-1.8,-.1,0,-1.8],3));
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute([2,0,0,0,2,0,0,0,2,0,0,0],4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const rump=new Bone(),shoulder=new Bone(),mouth=new Bone();rump.name='rump';shoulder.name='shoulder';mouth.name='mouth';
  rump.position.z=-.7;shoulder.position.z=-.3;mouth.position.z=-.7;rump.add(shoulder);shoulder.add(mouth);
  const mesh=new SkinnedMesh(geometry,material);mesh.add(rump);mesh.bind(new Skeleton([rump,shoulder,mouth]));
  const actor=legacyDouble<Animal>({mesh,yaw:Math.PI}),profile={...orchard,anchors:{head:'mouth',crest:'shoulder',body:'rump',withers:[0,0,0],minWeight:.5}};
  const reins=new MountedReins(camera,profile,scope),strap=reins.group.children[0];if(!(strap instanceof Mesh))throw new Error('Missing native strap');
  const strapGeometry:unknown=strap.geometry;if(!(strapGeometry instanceof BufferGeometry))throw new Error('Missing strap geometry');
  try{
    reins.update(.1,actor,true,false);expect(reins.group.visible).toBe(true);
    const bit=new Vector3(-orchard.bit.out,-.2*(1-orchard.bit.back),-2+.3*orchard.bit.back);
    expect(centre(strapGeometry,orchard.span*6).distanceTo(bit)).toBeLessThan(1e-6);
    mouth.position.y=-.1;reins.update(.1,actor,true,false);bit.y-=.1;
    expect(centre(strapGeometry,orchard.span*6).distanceTo(bit)).toBeLessThan(1e-6);
    reins.update(.1,actor,false,false);expect(reins.group.visible).toBe(false);
    expect(()=>new MountedReins(camera,{...profile,sample:()=>null},scope)).toThrow();
  }finally{scope.dispose();geometry.dispose();material.dispose();mesh.skeleton.dispose();}
  expect(reins.group.parent).toBeNull();
});
