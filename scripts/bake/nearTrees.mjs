// G342: a forest's trees for the near placeholder. A shard whose own tree model draws its forest has no tree meshes in
// Node, but its baked placements are real: each kept tree becomes a low-LOD stand-in (a unit-high stem and crown of
// 8-23 triangles, by species and tint band) at its own placement, thinned evenly to its own triangle budget, the kept
// ones widened to cover the thinned ones' crowns. The output is the SDK producer's prototype shape.
// G348: the stand-in shapes are the shard's own data (its manifest's placeholder.trees, @wildshard/format/placeholderSource);
// a shard that declares none gets the one generic conifer below. No species table lives here.
import * as THREE from 'three';

/** the forest's triangle budget inside the near placeholder (on top of the props' own content budget) */
export const NEAR_TREE_TRIANGLES = 30_000;

const srgb = ([r, g, b]) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
/** the generic stand-in: a stemless two-ring conifer */
const GENERIC = { species: 'tree', stem: null, rings: [[0.06, 0.24], [0.45, 0.15]], crown: [76, 112, 66] };
/** A declared row (sRGB 0..255) as the builder's shape. */
const shapeFrom = (row) => ({ stem: row.stem === null ? null : [row.stem[0], row.stem[1], srgb(row.stem[2])], rings: row.rings, crown: srgb(row.crown) });
const trianglesOf = (shape) => (shape.stem === null ? 0 : 8) + Math.max(0, shape.rings.length - 1) * 10 + (shape.rings.length > 0 ? 5 : 0);

function prototype(shape, shade, widen) {
  const pos = [], col = [], idx = [];
  const ring = (y, r, n, c) => { const b = pos.length / 3; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(c.r, c.g, c.b); } return b; };
  const side = (a, b, n) => { for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; idx.push(a + k, b + k, b + k1, a + k, b + k1, a + k1); } };
  if (shape.stem !== null) { const [top, r, c] = shape.stem, a = ring(0, r, 4, c), b = ring(top, r, 4, c); side(a, b, 4); }
  if (shape.rings.length > 0) {
    const dark = shape.crown.clone().multiplyScalar(0.8 * shade), lit = shape.crown.clone().multiplyScalar(shade);
    let prev = -1;
    for (const [i, [y, r]] of shape.rings.entries()) { const b = ring(y, r * widen, 5, i === 0 ? dark : lit); if (prev >= 0) side(prev, b, 5); prev = b; }
    const apex = pos.length / 3; pos.push(0, 1, 0); col.push(lit.r, lit.g, lit.b);
    for (let k = 0; k < 5; k++) idx.push(prev + k, apex, prev + (k + 1) % 5);
  }
  return { positions: Float32Array.from(pos), colours: Float32Array.from(col), index: Uint32Array.from(idx) };
}

/**
 * The forest's kept trees as prototypes with their placed copies (cell-local), deterministic for the same placements.
 * `trees`: { x, y, z, rot, height, scale, species, tint (lightness) }; `stands`: the shard's declared stand-in rows
 * (`placeholder.trees`), absent for the generic conifer.
 */
export function nearTreePrototypes(trees, half, stands, budget = NEAR_TREE_TRIANGLES) {
  const rows = Array.isArray(stands) && stands.length > 0 ? stands : [GENERIC], shapes = new Map(rows.map(row => [row.species, shapeFrom(row)]));
  const fallback = rows[0]?.species ?? GENERIC.species, speciesOf = (t) => shapes.has(t.species) ? t.species : fallback;
  const shapeOf = (species) => shapes.get(species) ?? shapeFrom(GENERIC);
  const inside = trees.filter(t => Math.abs(t.x) < half - 1 && Math.abs(t.z) < half - 1);
  const total = inside.reduce((sum, t) => sum + trianglesOf(shapeOf(speciesOf(t))), 0), keep = Math.min(1, budget / Math.max(1, total));
  // a hash of each placement picks the kept share evenly across the cell
  const picked = inside.filter((t, i) => { const h = Math.sin(i * 12.9898 + t.x * 78.233 + t.z * 37.719) * 43758.5453; return h - Math.floor(h) < keep; });
  const widen = Math.min(1.7, Math.sqrt(1 / keep)), groups = new Map();
  for (const t of picked) {
    const key = `${speciesOf(t)}:${t.tint < 0.45 ? 0 : t.tint < 0.55 ? 1 : 2}`;
    const group = groups.get(key) ?? []; group.push(t); groups.set(key, group);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), prototypes = [];
  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    const [species, band] = key.split(':'), shape = shapeOf(species), proto = prototype(shape, [0.82, 1, 1.18][Number(band)], shape.rings.length === 0 ? 1 : widen);
    const transforms = groups.get(key).map((t) => {
      const h = t.height > 0 ? t.height : 20 * t.scale;
      return Array.from(m.compose(new THREE.Vector3(t.x, t.y, t.z), q.setFromAxisAngle(up, t.rot), new THREE.Vector3(h, h, h)).elements);
    });
    prototypes.push({ name: `tree-${key}`, ...proto, transforms });
  }
  return { prototypes, report: { placed: trees.length, inside: inside.length, kept: picked.length, widen: Number(widen.toFixed(2)) } };
}
