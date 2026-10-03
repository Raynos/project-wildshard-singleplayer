import { BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The keeper's book stand (E399, mockup B: beside the bridge-keeper a carved wooden lectern holds an open book, a lit
 * lantern at its foot): a turned post on a cross foot, a slanted reading board with a lip, the open book (leather boards,
 * two fanned page blocks, a ribbon), and an iron ground lantern whose glass burns amber. The notes lectern on the
 * keeper's isle (quest step 1) is the same stand. Vertex-coloured, three meshes; `footprint` is its collider half-size.
 */
export const BOOK_STAND = { height: 1.12, footprint: 0.3 } as const;

function tint(g: BufferGeometry, hex: number, jitter = 0.06, seed = 1): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g, n = geo.getAttribute('position').count, c = new Color(hex), out: number[] = [];
  for (let i = 0; i < n; i += 3) {
    const h = (((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1) + 1) % 1, k = 1 - jitter + 2 * jitter * h;
    for (let v = 0; v < 3; v++) out.push(c.r * k, c.g * k, c.b * k);
  }
  geo.setAttribute('color', new Float32BufferAttribute(out, 3)); geo.deleteAttribute('uv'); return geo;
}

export function bookStand(withLantern: boolean): Group {
  const group = new Group(); group.name = 'far.book-stand';
  const wood: BufferGeometry[] = [], paper: BufferGeometry[] = [];
  // E399 round 6 (the seats, mockup B: 'a red-brown bar post, its book a sliver, the lantern on the ground'; the mockup's
  // is a stout carved lectern on a box plinth, a big open book, a lantern hung at its side): a plinth of two stacked
  // boards, a square post with collars, a deep reading box tilted to the reader with a lip, and a large open book
  wood.push(tint(new BoxGeometry(0.56, 0.16, 0.44).translate(0, 0.08, 0), 0x5b3d27));
  wood.push(tint(new BoxGeometry(0.48, 0.14, 0.38).translate(0, 0.23, 0), 0x6a4630, 0.06, 2));
  wood.push(tint(new BoxGeometry(0.17, 0.62, 0.17).translate(0, 0.61, 0), 0x6a4630, 0.08, 3));
  for (const [y, w] of [[0.33, 0.22], [0.88, 0.21]] as const) wood.push(tint(new BoxGeometry(w, 0.05, w).translate(0, y, 0), 0x4d3220, 0.05, 4));
  const box = new BoxGeometry(0.66, 0.12, 0.5); box.rotateX(-0.42); box.translate(0, 0.98, 0); wood.push(tint(box, 0x6e4a32, 0.05, 5));
  const lip = new BoxGeometry(0.66, 0.07, 0.04); lip.rotateX(-0.42); lip.translate(0, 0.95, 0.24); wood.push(tint(lip, 0x4d3220, 0.04, 6));
  // the open book: dark red leather boards, two page blocks fanned up from the spine, a ribbon
  const cover = new BoxGeometry(0.62, 0.02, 0.42); cover.rotateX(-0.42); cover.translate(0, 1.05, 0.005); wood.push(tint(cover, 0x6b2a22, 0.04, 7));
  for (const side of [-1, 1]) {
    const pages = new BoxGeometry(0.29, 0.045, 0.39); pages.rotateZ(side * 0.1); pages.rotateX(-0.42); pages.translate(side * 0.15, 1.08, 0.0); paper.push(tint(pages, 0xf4ecd8, 0.03, 8 + side));
  }
  const ribbon = new BoxGeometry(0.02, 0.005, 0.24); ribbon.rotateX(-0.42); ribbon.translate(0.01, 1.105, 0.2); wood.push(tint(ribbon, 0x9a2a1e, 0, 9));
  // the lantern's arm: a bracket out of the post's side, a hook at its end
  wood.push(tint(new BoxGeometry(0.3, 0.035, 0.035).translate(0.22, 0.8, 0.02), 0x4d3220, 0.04, 13));
  const woodMesh = new Mesh(mergeGeometries(wood), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true }));
  const paperMesh = new Mesh(mergeGeometries(paper), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, emissive: 0x4a4030 }));
  group.add(woodMesh, paperMesh);
  for (const g of [...wood, ...paper]) g.dispose();
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
