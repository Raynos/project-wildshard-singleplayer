import { BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeKinds, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { BOOK_STAND, LECTERN } from '../data/bookStand';

/**
 * Build-time only (SHARD-PLATFORM SF72): baked by `scripts/bake-sky-world.mjs` into `baked/book-stand.glb` +
 * `data/bookStand.json`; the client (`world/bookStand.ts`) draws the bake in each stand's own frame.
 *
 * The keeper's book stand's code parts (E399, mockup B): the open book on the modelled lectern's desk (`desk-wood`: the
 * leather boards and the ribbon, `desk-paper`: the pages, softly self-lit so they read), and the code stand the modelled
 * one replaces where it did not load (`stand-wood`: the plinth, the post, the reading box and the bracket with the book's
 * leather, `stand-paper`, and the iron lantern's `cage` round its amber `glass`, hung from the bracket).
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
  // the carved lectern carries the same open book on its desk (readable pages, the quest's notes)
  const desk = book(LECTERN.desk.y + 0.04, LECTERN.desk.z, LECTERN.desk.tilt), [deskWood, deskPaper] = bookMeshes(desk.leather, desk.paper);
  const wood: BufferGeometry[] = [];
  // E399 round 6 (the seats, mockup B: 'a red-brown bar post, its book a sliver, the lantern on the ground'; the mockup's
  // is a stout carved lectern on a box plinth, a big open book, a lantern hung at its side): a plinth of two stacked
  // boards, a square post with collars, a deep reading box tilted to the reader with a lip, and a large open book
  wood.push(tint(new BoxGeometry(0.56, 0.16, 0.44).translate(0, 0.08, 0), 0x5b3d27));
  wood.push(tint(new BoxGeometry(0.48, 0.14, 0.38).translate(0, 0.23, 0), 0x6a4630, 0.06, 2));
  wood.push(tint(new BoxGeometry(0.17, 0.62, 0.17).translate(0, 0.61, 0), 0x6a4630, 0.08, 3));
  for (const [y, w] of [[0.33, 0.22], [0.88, 0.21]] as const) wood.push(tint(new BoxGeometry(w, 0.05, w).translate(0, y, 0), 0x4d3220, 0.05, 4));
  const box = new BoxGeometry(0.66, 0.12, 0.5); box.rotateX(BOOK_STAND.bookTilt); box.translate(0, 0.98, 0); wood.push(tint(box, 0x6e4a32, 0.05, 5));
  const lip = new BoxGeometry(0.66, 0.07, 0.04); lip.rotateX(BOOK_STAND.bookTilt); lip.translate(0, 0.95, 0.24); wood.push(tint(lip, 0x4d3220, 0.04, 6));
  // the lantern's arm: a bracket out of the post's side, a hook at its end
  wood.push(tint(new BoxGeometry(0.3, 0.035, 0.035).translate(0.22, 0.8, 0.02), 0x4d3220, 0.04, 13));
  const { leather, paper } = book(1.08, 0, BOOK_STAND.bookTilt), [standWood, standPaper] = bookMeshes([...wood, ...leather], paper);
  // the lantern: an iron cage (base, four posts, a cap and a ring) round amber glass that glows, hung from the bracket (the
  // mockup), not standing in the grass where the meadow hid it
  const iron: BufferGeometry[] = [tint(new BoxGeometry(0.2, 0.03, 0.2).translate(0, 0.015, 0), 0x2c2622)];
  for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]] as const) iron.push(tint(new BoxGeometry(0.018, 0.24, 0.018).translate(x, 0.15, z), 0x2c2622, 0.04, 10));
  iron.push(tint(new OctahedronGeometry(0.13, 0).scale(1, 0.45, 1).translate(0, 0.3, 0), 0x2c2622, 0.04, 11));
  iron.push(tint(new CylinderGeometry(0.03, 0.03, 0.02, 8).rotateX(Math.PI / 2).translate(0, 0.39, 0), 0x2c2622, 0, 12));
  const hung = new Matrix4().makeTranslation(0.36, 0.38, 0.02);
  const cage = one(mergeGeometries(iron), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.6, flatShading: true }), hung);
  const glass = one(new SphereGeometry(0.075, 10, 8).scale(1, 1.35, 1).translate(0, 0.15, 0), new MeshStandardMaterial({ color: 0xffc46a, emissive: 0xff9a2e, emissiveIntensity: 2.2, roughness: 0.4, metalness: 0 }), hung);
  for (const g of iron) g.dispose();
  return [['desk-wood', deskWood], ['desk-paper', deskPaper], ['stand-wood', standWood], ['stand-paper', standPaper], ['cage', cage], ['glass', glass]];
}

/** The book stand's code parts baked (no colliders: world/build.ts gives each stand its box). */
export function bakeSkyBookStand(): PieceBake { return bakeKinds('far.book-stand', buildBookStandSet(), []); }
