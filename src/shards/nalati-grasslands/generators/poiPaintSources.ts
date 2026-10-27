import { Box3, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { Board } from './campParams';
import { riderGeometry } from './ghostFigure';
import { shepherdBody, shepherdArm } from './shepherd';
import { letteringGeometry } from './signLettering';
import { nalatiRoadSignposts } from './roadSigns';
import { boardSpots } from './painted';
import { snoutGeometry, snoutAt } from './glacierSnout';
import { fitRock } from './fittedRock';
import { writeGeometry, join } from './geometryWriter';

/** Original authored rock inventory, in the defining paint publication order. */
export const POI_PAINT_MODELS: readonly string[] = ['phone', 'desktop'].flatMap(tier =>
  ['boulder-1', 'boulder-2', 'boulder-3'].map(file => `${file}${tier === 'phone' ? '.phone' : ''}.glb`));

function isMesh(child: Object3D): child is Mesh { return child instanceof Mesh; }

/** Construct fourteen owned paint lanes from explicit native terrain and painted models.
 * Contact metadata is authored separately: construction never recomputes physics or reads files.
 * The returned maps and geometries are owned by this call; supplied byte views stay borrowed. */
export async function nalatiPoiPaintSources(native: Uint8Array, boards: readonly Board[],
  models: ReadonlyMap<string, Uint8Array>, retained: { readonly contacts: unknown; readonly sources: unknown }): Promise<ReadonlyMap<string, Uint8Array>> {
  if (models.size !== POI_PAINT_MODELS.length || POI_PAINT_MODELS.some(name => !models.has(name))) {
    throw new Error('Nalati POI paint model inventory differs');
  }
  const ground = readNativeTerrain(native).heightAt, glacierSnout = snoutAt(ground);
  const posts = nalatiRoadSignposts(ground).map(sign => ({ spots: boardSpots(sign.x, sign.z, sign.y, sign.boards), boards: sign.boards }));
  const glacier = snoutGeometry(ground), glacierSpecimen = glacier.clone();
  glacierSpecimen.translate(-glacierSnout.x, -glacierSnout.y, -glacierSnout.z);
  glacierSpecimen.computeBoundingSphere(); glacierSpecimen.computeBoundingBox();
  const meshes: [string, BufferGeometry][] = [
    ['ghost-rider', riderGeometry()], ['ghost-captain', riderGeometry(true)],
    ['shepherd-body', shepherdBody()], ['shepherd-arm', shepherdArm()],
    ['sign-labels:roads', letteringGeometry(posts)],
    ['sign-labels:specimen', letteringGeometry([{ spots: boardSpots(0, 0, 0, boards), boards }])],
    ['glacier-snout:world', glacier], ['glacier-snout:specimen', glacierSpecimen],
  ];
  try {
    for (const tier of ['phone', 'desktop']) {
      for (const [name, file, half] of [
        ['boulder', 'boulder-1', [1, 0.74, 1]],
        ['boulder-tall', 'boulder-2', [0.9, 0.95, 0.9]],
        ['slab', 'boulder-3', [1.45, 0.5, 0.95]],
      ] as const) {
        const key = `${file}${tier === 'phone' ? '.phone' : ''}.glb`, bytes = models.get(key);
        if (bytes === undefined || bytes.length === 0) throw new Error(`Missing prepared rock ${key}`);
        const source = await readSourceModel(bytes);
        try {
          const mesh = source.gltf.scene.children.find(isMesh);
          if (mesh === undefined) throw new Error(`Missing prepared rock ${key}`);
          mesh.geometry.deleteAttribute('_paint_clone'); mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox === null) throw new Error(`Missing prepared rock bounds ${key}`);
          meshes.push([`dressing:${tier}:${name}`, fitRock({ geometry: mesh.geometry, box: mesh.geometry.boundingBox }, half)]);
        } finally {
          source.gltf.scene.traverse(child => {
            if (isMesh(child)) {
              child.geometry.dispose();
              for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
            }
          });
        }
      }
    }
    const files = new Map<string, Uint8Array>(), lanes: Uint8Array[] = [];
    const rows = meshes.map(([key, geometry], index) => {
      const blocks: Uint8Array[] = [], row = writeGeometry(geometry, blocks, key), bytes = join(blocks);
      lanes.push(bytes);
      const file = `data/poi-shape-${String(index)}.bin`;
      files.set(file, bytes);
      let bounds: number[] | undefined;
      if (key === 'glacier-snout:world') {
        const positions = row.attrs[0];
        if (positions?.[0] !== 'position' || positions[1] !== 'f32' || positions[2] !== 3 || positions[3]) {
          throw new Error('Glacier bounds require its first float32 position channel');
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), box = new Box3(), point = new Vector3();
        for (let i = 0; i < row.count; i++) box.expandByPoint(point.set(view.getFloat32(i * 12, true), view.getFloat32(i * 12 + 4, true), view.getFloat32(i * 12 + 8, true)));
        bounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
      }
      return { key, geometry: row, file, name: `models/shapes/paint-${String(index)}.bin`, ...(bounds === undefined ? {} : { bounds }) };
    });
    const document = new TextEncoder().encode(`${JSON.stringify({ bin: hashImmutableBytes(join(lanes)),
      bytes: lanes.reduce((sum, bytes) => sum + bytes.length, 0), rows, glacierSnout,
      contacts: retained.contacts, sources: retained.sources }, null, 2)}\n`);
    files.set('boot/poiPaint.json', document);
    files.set('data/poiPaint.json', document.slice());
    return files;
  } finally { for (const [, geometry] of meshes) geometry.dispose(); }
}
