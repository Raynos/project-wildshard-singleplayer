import { AdditiveBlending, BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, type BufferGeometry, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { fit, hdMaterial, skyHd } from './meshes';

/**
 * The keeper's book stand (E399, mockup B: beside the bridge-keeper a carved wooden lectern holds an open book, a lit
 * lantern hung at its side). Since E410 row 8 the support is the modelled lectern (a carved post on an iron-strapped
 * plinth, a slanted desk, an iron arm) with its modelled lantern on the arm's hook; the code stand below (a turned post on
 * a plinth, a reading box, an iron ground lantern) stays the fallback. Both carry the same code-built open book, so its
 * pages stay readable. The notes lectern on the keeper's isle (quest step 1) is the same stand without the lantern.
 * `footprint` is its collider half-size.
 */
export const BOOK_STAND = { height: 1.12, footprint: 0.3 } as const;
/** The reading box's tilt (radians about x): its reader's (+z) edge low, so the open pages face the reader (round 8: at -0.42
 * the reader's edge stood high and mockup B's view saw the book's back). */
const BOOK_TILT = 0.42;

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

/** The wood (and leather) as one flat-shaded vertex-coloured mesh; the pages a second, softly self-lit so they read. */
function bookMeshes(wood: BufferGeometry[], paper: BufferGeometry[]): Mesh[] {
  const woodMesh = new Mesh(mergeGeometries(wood), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true }));
  const paperMesh = new Mesh(mergeGeometries(paper), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: 0x4a4030 }));
  for (const g of [...wood, ...paper]) g.dispose();
  return [woodMesh, paperMesh];
}

/**
 * The modelled lectern and lantern (E410 row 8, mockup B; `art/far-reach/round-33-keeper/`, Hunyuan3D-2 from codex refs):
 * metres once fitted to `height`, front (the desk's low lip) toward +z. Measured on the fitted model: the desk's top at
 * its centre (`desk` y, z) and its slope (`tilt`, radians about x, front edge low), and the tip of the iron arm's hook
 * (`hook`) the lantern hangs from; the lantern is `lantern` m tall, its ring on the hook (mockup B: the lantern is 0.38 of
 * the lectern's height, 65 of 170 px), its glass's middle at `glass` of its height.
 */
export const LECTERN = { height: 1.12, desk: { y: 1.006, z: 0.025, tilt: 0.56 }, hook: [0.39, 0.67, 0] as const, lantern: 0.42, glass: 0.42 } as const;

/** The lantern's warm glass: the paint's bright amber texels burn (emissive); the iron and brass stay as painted. */
function lanternMaterial(map: Texture): MeshStandardMaterial {
  const material = hdMaterial(map);
  patchShader(material, 'far.lantern-glow', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec3 c = diffuseColor.rgb; float amber = smoothstep(0.45, 0.75, c.r) * smoothstep(0.3, 0.6, c.r - c.b);
    totalEmissiveRadiance += c * vec3(1.6, 1.15, 0.7) * amber; }`);
  }, { key: (prior) => `${prior}|far.lantern-glow` });
  return material;
}

/** The modelled lectern (and its lantern on the hook), or null when a model is not loaded (the code stand stays). */
function modelled(withLantern: boolean): Group | null {
  const l = skyHd('lectern-hd'), h = withLantern ? skyHd('lantern-hd') : null;
  if (l === null || (withLantern && h === null)) return null;
  const group = new Group();
  const lectern = new Mesh(fit(l.geometry, { size: LECTERN.height, by: 'height', floor: 0, centre: 'base' }), hdMaterial(l.map)); lectern.name = 'far.lectern';
  group.add(lectern);
  if (h !== null) {
    // hung by its ring from the hook: the lantern's top at the hook's tip
    const lantern = new Mesh(fit(h.geometry, { size: LECTERN.lantern, by: 'height', floor: 0, centre: 'base' }), lanternMaterial(h.map)); lantern.name = 'far.lectern-lantern';
    const [hx, hy, hz] = LECTERN.hook; lantern.position.set(hx, hy - LECTERN.lantern, hz); group.add(lantern);
    // a small warm halo round the glass, so the light reads from the spawn (mockup B's lit lantern)
    const halo = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }));
    halo.position.set(hx, hy - LECTERN.lantern * (1 - LECTERN.glass), hz); group.add(halo);
  }
  return group;
}

export function bookStand(withLantern: boolean): Group {
  const group = new Group(); group.name = 'far.book-stand';
  const carved = modelled(withLantern);
  if (carved !== null) {
    // the carved lectern carries the same open book on its desk (readable pages, the quest's notes)
    const { leather, paper } = book(LECTERN.desk.y + 0.04, LECTERN.desk.z, LECTERN.desk.tilt);
    group.add(carved, ...bookMeshes(leather, paper));
    return group;
  }
  const wood: BufferGeometry[] = [];
  // E399 round 6 (the seats, mockup B: 'a red-brown bar post, its book a sliver, the lantern on the ground'; the mockup's
  // is a stout carved lectern on a box plinth, a big open book, a lantern hung at its side): a plinth of two stacked
  // boards, a square post with collars, a deep reading box tilted to the reader with a lip, and a large open book
  wood.push(tint(new BoxGeometry(0.56, 0.16, 0.44).translate(0, 0.08, 0), 0x5b3d27));
  wood.push(tint(new BoxGeometry(0.48, 0.14, 0.38).translate(0, 0.23, 0), 0x6a4630, 0.06, 2));
  wood.push(tint(new BoxGeometry(0.17, 0.62, 0.17).translate(0, 0.61, 0), 0x6a4630, 0.08, 3));
  for (const [y, w] of [[0.33, 0.22], [0.88, 0.21]] as const) wood.push(tint(new BoxGeometry(w, 0.05, w).translate(0, y, 0), 0x4d3220, 0.05, 4));
  const box = new BoxGeometry(0.66, 0.12, 0.5); box.rotateX(BOOK_TILT); box.translate(0, 0.98, 0); wood.push(tint(box, 0x6e4a32, 0.05, 5));
  const lip = new BoxGeometry(0.66, 0.07, 0.04); lip.rotateX(BOOK_TILT); lip.translate(0, 0.95, 0.24); wood.push(tint(lip, 0x4d3220, 0.04, 6));
  // the lantern's arm: a bracket out of the post's side, a hook at its end
  wood.push(tint(new BoxGeometry(0.3, 0.035, 0.035).translate(0.22, 0.8, 0.02), 0x4d3220, 0.04, 13));
  const { leather, paper } = book(1.08, 0, BOOK_TILT);
  group.add(...bookMeshes([...wood, ...leather], paper));
  if (withLantern) {
    // the ground lantern: an iron cage (base, four posts, a cap and a ring) round amber glass that glows
    const iron: BufferGeometry[] = [tint(new BoxGeometry(0.2, 0.03, 0.2).translate(0, 0.015, 0), 0x2c2622)];
    for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]] as const) iron.push(tint(new BoxGeometry(0.018, 0.24, 0.018).translate(x, 0.15, z), 0x2c2622, 0.04, 10));
    iron.push(tint(new OctahedronGeometry(0.13, 0).scale(1, 0.45, 1).translate(0, 0.3, 0), 0x2c2622, 0.04, 11));
    iron.push(tint(new CylinderGeometry(0.03, 0.03, 0.02, 8).rotateX(Math.PI / 2).translate(0, 0.39, 0), 0x2c2622, 0, 12));
    const cage = new Mesh(mergeGeometries(iron), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.6, flatShading: true }));
    const glass = new Mesh(new SphereGeometry(0.075, 10, 8).scale(1, 1.35, 1).translate(0, 0.15, 0), new MeshStandardMaterial({ color: 0xffc46a, emissive: 0xff9a2e, emissiveIntensity: 2.2, roughness: 0.4, metalness: 0 }));
    // hung from the bracket (the mockup), not standing in the grass where the meadow hid it
    const lantern = new Group(); lantern.add(cage, glass); lantern.position.set(0.36, 0.38, 0.02); group.add(lantern);
    for (const g of iron) g.dispose();
  }
  return group;
}
