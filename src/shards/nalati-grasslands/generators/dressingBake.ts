/** Nine dressing models, thirteen tier variants, authored as named three.js meshes. */
import { BufferGeometry, Mesh, Scene } from 'three';
import { PainterlyMaterial } from '@wildshard/sdk/materials';
import { readScene } from '@wildshard/sdk/scene';
import { DRESSING_GEOS } from './dressingGeos';
import { join, writeGeometry, type PlaceGeometryRow } from './geometryWriter';

/** Build the native dressing variants at the same origin, scale and recipe seeds. */
export function dressingScene(): Scene {
  const scene = new Scene(); scene.name = 'nalati-dressing';
  const rock = new PainterlyMaterial({ rim: 0.3, bands: 0.8 });
  const shrub = new PainterlyMaterial({ rim: 0.5, bands: 0.7, sway: 0.05 });
  const flower = new PainterlyMaterial({ rim: 0.45, bands: 0.6, sway: 0.3 });
  const reed = new PainterlyMaterial({ rim: 0.5, bands: 0.6, sway: 0.1 });
  for (const [key, build] of DRESSING_GEOS) {
    const material = /^(boulder|slab|stone)/u.test(key) ? rock : /^(juniper|rose|willow)/u.test(key) ? shrub : key === 'reed' ? reed : flower;
    const mesh = new Mesh(build(), material); mesh.name = key;
    scene.add(mesh);
  }
  return scene;
}

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }

/** Emit the exact binary read by the native page and its Model Explorer. */
export function bakeDressing(): { readonly rows: readonly { readonly key: string; readonly geometry: PlaceGeometryRow }[]; readonly bin: Uint8Array } {
  const blocks: Uint8Array[] = [], scene = dressingScene();
  const rows = scene.children.map(child => {
    if (!(child instanceof Mesh)) throw new Error('Nalati dressing must be named Mesh declarations');
    const geometry: unknown = child.geometry;
    if (!isGeometry(geometry)) throw new Error('Nalati dressing requires BufferGeometry');
    return { key: child.name, geometry: writeGeometry(geometry, blocks, `dressing ${child.name}`) };
  });
  return { rows, bin: join(blocks) };
}

/** The same named geometry and material declarations in the standard scene.json format. */
export function dressingDescription(): ReturnType<typeof readScene> { return readScene(dressingScene()); }
