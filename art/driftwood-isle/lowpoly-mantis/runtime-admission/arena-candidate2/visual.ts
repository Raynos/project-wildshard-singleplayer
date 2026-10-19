/** Rest-only diagnostic, never an admitted opponent or gameplay capture. */
import { Bone, Skeleton, SkinnedMesh, Mesh, Object3D, Vector3, DoubleSide, FrontSide } from 'three';
import * as v from 'valibot';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../../src/game/plugin/geometry';
import { mergeAnimalGeometry } from '../../../../../src/engine/models/animalGeometry';
import { facetGeometry, oneMaterial } from '../../../../../src/engine/entities/lowpoly';

export async function prepare(referenceMaterial: Mesh['material'], fixture: 'original' = 'original') {
  const prefix = `/diagnostic/${fixture}`;
  const mapping = v.parse(v.array(v.object({ node: v.number(), joint: v.string(), vertexStart: v.number(), vertexCount: v.number() })), await (await fetch(`${prefix}/mesh-map.json`)).json());
  const metadata: unknown = await (await fetch(`${prefix}/metadata.json`)).json();
  const bodies = packedCreatureBodies(metadata, undefined, async () => new Uint8Array(await (await fetch(`${prefix}/payload.bin`)).arrayBuffer()));
  await bodies.preload();
  const body = bodies.copy('splinter-mantis', 'splinter-mantis');
  const partCounts = body.hardParts.map(g => g.getAttribute('position').count);
  const geometry = facetGeometry(mergeAnimalGeometry(body.furParts, body.hardParts, body.eyeParts));
  oneMaterial(geometry, null);
  const native = new SkinnedMesh(geometry, referenceMaterial);
  const bones = new Map<string, Bone>();
  for (const def of body.bones) {
    const bone = new Bone(); bone.name = def.name; bone.position.fromArray(def.pos);
    const parent = def.parent === null ? undefined : bones.get(def.parent);
    const parentDef = body.bones.find(row => row.name === def.parent);
    if (parentDef !== undefined) bone.position.sub(new Vector3(...parentDef.pos));
    if (parent !== undefined) parent.add(bone);
    bones.set(def.name, bone);
  }
  const root = bones.get('body'); if (root === undefined) throw Error('Missing root');
  native.add(root); native.updateMatrixWorld(true); native.bind(new Skeleton([...bones.values()]));
  native.castShadow = true; native.receiveShadow = true; native.frustumCulled = false;
  const gltf = await new GLTFLoader().loadAsync(`${prefix}/source.glb`);
  gltf.scene.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const nodes = new Map<number, Object3D>();
  for (const [o, association] of gltf.parser.associations) if (o instanceof Object3D && association.nodes !== undefined) nodes.set(association.nodes, o);
  const setSide = (object: Object3D, double: boolean) => object.traverse(o => {
    if (o instanceof Mesh) for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      material.side = double ? DoubleSide : FrontSide; material.needsUpdate = true;
    }
  });
  const isolate = (node: number | null) => {
    gltf.scene.traverse(o => { if (o instanceof Mesh) o.visible = node === null; });
    if (node === null) { geometry.setDrawRange(0, Infinity); return; }
    const object = nodes.get(node), row = mapping.find(m => m.node === node);
    if (object === undefined || row === undefined) throw Error('Missing diagnostic node');
    object.traverse(o => { if (o instanceof Mesh) o.visible = true; });
    const part = body.bones.findIndex(b => b.name === row.joint);
    if (part < 0) throw Error('Missing diagnostic part');
    geometry.setDrawRange(partCounts.slice(0, part).reduce((sum, n) => sum + n, 0) + row.vertexStart, row.vertexCount);
  };
  return { native, source: gltf.scene, nodes, setSide, isolate, stats: { vertices: geometry.getAttribute('position').count,
    bones: [...bones.keys()], facetJitter: .12, sourceMaterialsUntouched: true } };
}
