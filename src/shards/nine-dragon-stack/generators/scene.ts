import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { InstancedMesh, Mesh, MeshStandardMaterial, Scene, type BufferGeometry } from 'three';
import { bake, BakedPiece, WholeShape, type BakedScene } from '@wildshard/sdk/bake';
import { partitionWholeGeometry } from '@wildshard/sdk/bake/props';
import { nineLayoutSource } from './layout';
import { bootSpecimen, specimenRecipes } from './specimens';
import { banyanOut } from '../world/banyanPlan';

/** Channels of Nine's unchanged material fallback, retained as ordinary GLB application attributes. */
export function nineChannels(geometry: BufferGeometry): Record<string, string> {
  return Object.fromEntries(Object.keys(geometry.attributes).filter(name => !['position', 'normal', 'color', 'uv', 'tangent'].includes(name))
    .map(name => [`_${name.toUpperCase()}`, name]));
}

/** Static fabric is drawn from whole L0 nodes; local specimens are standard instanced-kind library GLBs. */
function buildNineScene(project?: string): { baked: BakedScene; layout: ReturnType<typeof nineLayoutSource>; keys: { boot: string[]; explorer: string[] }; boxes: Record<string, boolean> } {
  const layout = nineLayoutSource(), scene = new Scene(); scene.name = 'nine-dragon-stack';
  const material = new MeshStandardMaterial({ vertexColors: true });
  const local = new Set(layout.rows.sets.map(set => set.geo));
  // The skyline crown reaches +273.5 m: retain that out-of-cube backdrop as an unchanged library geometry.
  const crown = layout.rows.kits.find(kit => kit.name === 'crown')?.geo;
  if (crown !== undefined && crown !== null) local.add(crown);
  for (const [i, geometry] of layout.geometries.entries()) {
    if (local.has(i)) continue;
    const mesh = new Mesh(geometry, material); mesh.name = `layout_${i}`;
    scene.add(new WholeShape(mesh.name, mesh, { customAttributes: nineChannels(geometry), nativeAttributes: true, partition: true }));
  }
  const keys: { boot: string[]; explorer: string[] } = { boot: [], explorer: [] };
  let library = 0; const boxes: Record<string, boolean> = {};
  const part = (name: string, entries: readonly (readonly [string, BufferGeometry])[]): void => {
    for (const [key, geometry] of entries) for (const subset of partitionWholeGeometry(geometry)) {
      const mesh = new InstancedMesh(subset.geometry, material, 1), id = `${name}_${library++}`;
      const metadata = { id: key, vertices: subset.vertices, triangles: subset.triangles,
        vertexCount: geometry.getAttribute('position').count, indexCount: geometry.getIndex()?.count ?? 0,
        index: geometry.getIndex() === null ? 'none' : geometry.getIndex()?.array instanceof Uint16Array ? 'u16' : 'u32' };
      scene.add(new BakedPiece(id, [[id, mesh]], [], { attributes: nineChannels(subset.geometry), nativeAttributes: true, compactIndex: true,
        nodeExtras: () => ({ wholePartition: metadata }) }));
    }
  };
  part('layout_sets', [...local].map(index => {
    const geometry = layout.geometries[index];
    if (geometry === undefined) throw new Error(`Nine scene: missing local geometry ${index}`);
    return [`layout_${index}`, geometry] as const;
  }));
  const recipes = specimenRecipes(banyanOut.plan?.lumps ?? []);
  for (const name of ['boot', 'explorer'] as const) {
    const entries = recipes.filter(([key]) => bootSpecimen(key) === (name === 'boot')).map(([key, build]) => [key, build()] as const);
    keys[name] = entries.map(([key]) => key);
    for (const [key, geometry] of entries) boxes[key] = geometry.boundingBox !== null;
    part(`specimens_${name}`, entries);
  }
  const baked = bake(scene, { slug: 'nine-dragon-stack', name: 'Nine Dragon Stack' }, project === undefined ? {} : { project });
  return { baked, layout, keys, boxes };
}

/** Portable author math keeps the exact scene reproducible across arm64 Mac and Linux x64. */
export function nineScene(project?: string): ReturnType<typeof buildNineScene> { return withPortableMath(() => buildNineScene(project)); }
