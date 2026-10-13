import { BoxGeometry, Color, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceBake } from '@wildshard/sdk/bake/kinds';
import { bakeSkyPiece, SkyPiece } from './piece';
import { LECTERN } from '../data/bookStand';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/book-stand.glb` +
 * `data/bookStand.json`; the client (`world/bookStand.ts`) draws the bake in each stand's own frame.
 *
 * The keeper's book stand's code parts (E399, mockup B): the open book on the modelled lectern's desk (`desk-wood`: the
 * leather boards and the ribbon, `desk-paper`: the pages, softly self-lit so they read).
 */

function tint(g: BufferGeometry, hex: number, jitter = 0.06, seed = 1): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g, n = geo.getAttribute('position').count, c = new Color(hex), out: number[] = [];
  for (let i = 0; i < n; i += 3) {
    const h = (((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1) + 1) % 1, k = 1 - jitter + 2 * jitter * h;
    for (let v = 0; v < 3; v++) out.push(c.r * k, c.g * k, c.b * k);
  }
  geo.setAttribute('color', new Float32BufferAttribute(out, 3)); geo.deleteAttribute('uv'); return geo;
}

/** The open book (dark red leather boards, two page blocks fanned up from the spine, a ribbon): the pages' centre at (0, `y`, `z`), tilted `tilt` about x. */
function book(y: number, z: number, tilt: number): { leather: BufferGeometry[]; paper: BufferGeometry[] } {
  const leather: BufferGeometry[] = [], paper: BufferGeometry[] = [];
  const cover = new BoxGeometry(0.62, 0.02, 0.42); cover.rotateX(tilt); cover.translate(0, y - 0.03, z + 0.005); leather.push(tint(cover, 0x6b2a22, 0.04, 7));
  for (const side of [-1, 1]) {
    const pages = new BoxGeometry(0.29, 0.045, 0.39); pages.rotateZ(side * 0.1); pages.rotateX(tilt); pages.translate(side * 0.15, y, z); paper.push(tint(pages, 0xf4ecd8, 0.03, 8 + side));
  }
  // the ribbon lies on the pages, down the slope toward the reader
  const ribbon = new BoxGeometry(0.02, 0.005, 0.24).translate(0.01, 0.025, 0.2); ribbon.rotateX(tilt); ribbon.translate(0, y, z); leather.push(tint(ribbon, 0x9a2a1e, 0, 9));
  return { leather, paper };
}

const one = (geometry: BufferGeometry, material: MeshStandardMaterial, at = new Matrix4()): InstancedMesh => { const mesh = new InstancedMesh(geometry, material, 1); mesh.setMatrixAt(0, at); return mesh; };

/** The wood (and leather) as one flat-shaded vertex-coloured mesh; the pages a second, softly self-lit so they read. */
function bookMeshes(wood: BufferGeometry[], paper: BufferGeometry[]): readonly [InstancedMesh, InstancedMesh] {
  const woodMesh = one(mergeGeometries(wood), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true }));
  const paperMesh = one(mergeGeometries(paper), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: 0x4a4030 }));
  for (const g of [...wood, ...paper]) g.dispose();
  return [woodMesh, paperMesh];
}

/** The stand's code parts as named kinds, in the stand's own frame (its foot at the origin, the reader toward +z). */
export function buildBookStandSet(): (readonly [string, InstancedMesh])[] {
  // the carved lectern carries the open book on its desk (readable pages, the quest's notes)
  const desk = book(LECTERN.desk.y + 0.04, LECTERN.desk.z, LECTERN.desk.tilt), [deskWood, deskPaper] = bookMeshes(desk.leather, desk.paper);
  return [['desk-wood', deskWood], ['desk-paper', deskPaper]];
}

/** The book stand's code parts baked (no colliders: world/build.ts gives each stand its box). */
export const skyBookStandPiece = (): SkyPiece => new SkyPiece('far.book-stand', buildBookStandSet(), [], {}, {});
export function bakeSkyBookStand(): PieceBake { return bakeSkyPiece(skyBookStandPiece()); }
