import { Float32BufferAttribute, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { hdGeometry, fitModel } from './modelIntake';
import { MILL_COURSES, MILL_TOWER, MODELLED } from '../data/millShape';
import { HD_URLS } from '../data/files';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): the windmill's modelled tower and rock foot (E410; world/mill.ts
 * draws them), fitted from their generated GLBs as the page used to fit them on load, baked by `bake-sky-world.mjs` into
 * `baked/mill-model.bin` (a deflated `@wildshard/sdk/kit/geometryPack`) + `data/millModel.json`: the tower turned so its
 * windshaft stub faces +z and scaled so the stub sits at the code hub's height, the painted stone's course UVs on it; the
 * foot squashed, sunk and its lip flattened past the walk; and the hub's place on the stub. The page keeps the GLBs' maps.
 */

/** The mill model's rows: the pack's, the tower's and the foot's geometry and the hub's place on the stub. */
export interface MillModelRows extends PackedGeometryRows { tower: number; foot: number; hubAt: { y: number; z: number } }

/** The front stub of a fitted tower: the farthest-out vertices above 72 % of its height (the centroid of the outer 8 %). */
function stubOf(g: BufferGeometry): { a: number; r: number; y: number } {
  const p = g.getAttribute('position'); g.computeBoundingBox();
  const top = (g.boundingBox?.max.y ?? 1) * 0.72;
  let far = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top) far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i)));
  let x = 0, y = 0, z = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top && Math.hypot(p.getX(i), p.getZ(i)) > far * 0.92) { x += p.getX(i); y += p.getY(i); z += p.getZ(i); n++; }
  return { a: Math.atan2(x / Math.max(1, n), z / Math.max(1, n)), r: far, y: y / Math.max(1, n) };
}
/**
 * The painted stone's courses on the modelled wall (the model's own paint is soft at the h2 close-up's 18 m): a second UV
 * set wrapped round the axis as the code tower's (`MILL_COURSES.around` repeats, `MILL_COURSES.tile` m a course sheet), seam-free (each triangle
 * that straddles the back's wrap is unwrapped on its own), constant above the wall's top `wallTop` (the curb and cap keep
 * their paint). The stone then drives the bump and a light multiply of the paint (`towerMaterial`).
 */
function stoneCourses(src: BufferGeometry, wallTop: number): BufferGeometry {
  const g = src.index === null ? src : src.toNonIndexed(), p = g.getAttribute('position'), uv1 = new Float32Array(p.count * 2);
  for (let t = 0; t + 2 < p.count; t += 3) {
    const us = [0, 1, 2].map((v) => ((Math.atan2(p.getX(t + v), p.getZ(t + v)) / (Math.PI * 2)) + 0.5) * MILL_COURSES.around);
    const hi = Math.max(...us);
    for (let v = 0; v < 3; v++) {
      const y = p.getY(t + v), u = us[v] ?? 0;
      uv1[(t + v) * 2] = y > wallTop ? 0.5 : hi - u > MILL_COURSES.around / 2 ? u + MILL_COURSES.around : u;
      uv1[(t + v) * 2 + 1] = y > wallTop ? 0.5 : y / MILL_COURSES.tile;
    }
  }
  g.setAttribute('uv1', new Float32BufferAttribute(uv1, 2));
  if (g !== src) src.dispose();
  return g;
}
/** The fitted tower and foot from the two models' textured meshes (as `world/meshes.ts` loads them). */
export function millModel(tower: BufferGeometry, footSource: BufferGeometry): { tower: BufferGeometry; foot: BufferGeometry; hubAt: { y: number; z: number } } {
  // the tower: unit height first, its stub found and turned to +z, then scaled so the stub sits at the code hub's height
  const g = fitModel(tower, { size: 1, by: 'height', floor: 0, centre: 'base' });
  const s0 = stubOf(g); g.rotateY(-s0.a);
  const k = MODELLED.hub / s0.y; g.scale(k, k, k);
  // the footing's mean radius to the code tower's (the collider's box and the meadow's hole are sized on it)
  const p = g.getAttribute('position'); let rs = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.4) { rs += Math.hypot(p.getX(i), p.getZ(i)); n++; }
  const kr = Math.min(1.2, Math.max(0.8, MODELLED.baseR / Math.max(0.1, rs / Math.max(1, n)))); g.scale(kr, 1, kr);
  const s = stubOf(g);
  // the sails' lowest sweep passes the wall's front 7.4 m under the hub: keep the hub clear of it by 0.55 m
  let wall = 0;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > s.y - MILL_TOWER.sail - 0.2 && y < s.y - 1.5 && Math.abs(p.getX(i)) < 1.2 && p.getZ(i) > 0) wall = Math.max(wall, p.getZ(i));
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  const courses = stoneCourses(g, s.y - 1.2);
  // the rock foot: fitted to its span, squashed, sunk into the deck
  const fg = fitModel(footSource, { size: MODELLED.foot.span, by: 'span', floor: 0, centre: 'box' }); fg.computeBoundingBox();
  const fh = fg.boundingBox ? fg.boundingBox.max.y : 1; fg.scale(1, MODELLED.foot.h / Math.max(1e-3, fh), 1); fg.rotateY(0.7);
  fg.translate(0, -MODELLED.foot.sink, 0);
  // past the walk ring, nothing stands more than the lip proud of the deck (a smooth fall-off, no cliff)
  const fp = fg.getAttribute('position');
  for (let i = 0; i < fp.count; i++) {
    const d = Math.hypot(fp.getX(i), fp.getZ(i)), y = fp.getY(i);
    if (d > MODELLED.foot.walk && y > MODELLED.foot.lip) {
      const w = Math.min(1, (d - MODELLED.foot.walk) / 0.3);
      fp.setY(i, y + (MODELLED.foot.lip + (y - MODELLED.foot.lip) * 0.25 - y) * w);
    }
  }
  fg.computeVertexNormals(); fg.computeBoundingBox(); fg.computeBoundingSphere();
  return { tower: courses, foot: fg, hubAt: { y: s.y, z: Math.max(s.r + 0.1, wall + 0.55) } };
}

/** The mill model from its two GLBs (`read` returns a public file's bytes): the binary (uncompressed; the script deflates it) and its rows. */
export async function bakeSkyMillModel(read: (url: string) => Uint8Array): Promise<{ bin: Uint8Array; rows: MillModelRows }> {
  const textured = async (url: string): Promise<BufferGeometry> => {
    const source = await readSourceModel(read(url)), hd = hdGeometry(source.gltf.scene, (material) => source.texture(material) !== null);
    if (hd === null) throw new Error(`far-reach mill model: ${url} has no textured mesh`);
    return hd.geometry;
  };
  const made = millModel(await textured(HD_URLS['mill-tower']), await textured(HD_URLS['mill-foot']));
  const pack = new GeometryPackWriter('far-reach mill model'), tower = pack.add(made.tower), foot = pack.add(made.foot);
  return { bin: pack.bytes(), rows: { ...pack.rows(), tower, foot, hubAt: made.hubAt } };
}
