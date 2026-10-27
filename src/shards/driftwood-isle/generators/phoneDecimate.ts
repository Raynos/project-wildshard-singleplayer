import { BufferAttribute, BufferGeometry } from 'three';
import { simplifyWithin } from '@wildshard/sdk/bake/simplifier';

/**
 * L18.3e (G769 on the recommended option; board art/driftwood-isle/round-20-phone-decimation): the phone tier's flat
 * low-poly batch with fewer triangles. Corners are welded by position only and simplified within `error` metres
 * (meshoptimizer, borders free so separate pieces still keep their own outline); the result is a flat triangle soup
 * again. Each new triangle takes the colour of the original triangle nearest its centroid (the toon faces keep their
 * flat colours) and each corner the other channels (sway) of a source corner at its position; normals, when the batch
 * has them, are the new faces' own. Desktop batches are never passed here.
 */
export function decimateFlatBatch(source: BufferGeometry, error: number): BufferGeometry {
  if (source.getIndex() !== null) throw new Error('Phone decimation expects a flat triangle soup');
  const position = source.getAttribute('position'), count = position.count, colour = source.getAttribute('color');
  const welded = new Map<string, number>(), remap = new Uint32Array(count), points: number[] = [], firstCorner: number[] = [];
  for (let i = 0; i < count; i++) {
    const key = `${String(position.getX(i))},${String(position.getY(i))},${String(position.getZ(i))}`;
    let at = welded.get(key);
    if (at === undefined) { at = firstCorner.length; welded.set(key, at); points.push(position.getX(i), position.getY(i), position.getZ(i)); firstCorner.push(i); }
    remap[i] = at;
  }
  const positions = Float32Array.from(points), kept = simplifyWithin(remap, positions, error);
  // nearest original triangle by centroid, on a 1 m hash grid (the toon faces' flat colours)
  const cell = (v: number): number => Math.floor(v);
  const grid = new Map<string, number[]>(), centroid = (corner: (k: number) => number, axis: number): number => (corner(0 * 3 + axis) + corner(1 * 3 + axis) + corner(2 * 3 + axis)) / 3;
  const sourceCentre = (t: number, axis: number): number => centroid(k => position.getComponent(t * 3 + Math.floor(k / 3), k % 3), axis);
  for (let t = 0; t < count / 3; t++) {
    const key = `${String(cell(sourceCentre(t, 0)))},${String(cell(sourceCentre(t, 1)))},${String(cell(sourceCentre(t, 2)))}`;
    const list = grid.get(key); if (list === undefined) grid.set(key, [t]); else list.push(t);
  }
  const nearest = (x: number, y: number, z: number): number => {
    let best = 0, distance = Infinity;
    for (let reach = 1; reach <= 4 && distance === Infinity; reach++) {
      for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) for (let dz = -reach; dz <= reach; dz++) {
        for (const t of grid.get(`${String(cell(x) + dx)},${String(cell(y) + dy)},${String(cell(z) + dz)}`) ?? []) {
          const d = (sourceCentre(t, 0) - x) ** 2 + (sourceCentre(t, 1) - y) ** 2 + (sourceCentre(t, 2) - z) ** 2;
          if (d < distance) { distance = d; best = t; }
        }
      }
    }
    return best;
  };
  const out = new BufferGeometry(), triangles = kept.length / 3;
  for (const name of Object.keys(source.attributes)) {
    if (name === 'normal') continue;
    const attribute = source.getAttribute(name), width = attribute.itemSize, values = new Float32Array(triangles * 3 * width);
    for (let t = 0; t < triangles; t++) {
      const corners = [0, 1, 2].map(k => kept[t * 3 + k] ?? 0);
      const at = (axis: number): number => corners.reduce((sum, v) => sum + (positions[v * 3 + axis] ?? 0), 0) / 3;
      const face = name === 'color' ? nearest(at(0), at(1), at(2)) : -1;
      for (let k = 0; k < 3; k++) for (let c = 0; c < width; c++) {
        const from = face >= 0 ? face * 3 : firstCorner[corners[k] ?? 0] ?? 0;
        values[(t * 3 + k) * width + c] = attribute.getComponent(from, c);
      }
    }
    out.setAttribute(name, new BufferAttribute(values, width));
  }
  if (colour === undefined && out.getAttribute('color') !== undefined) throw new Error('Phone decimation colour mismatch');
  if (source.getAttribute('normal') !== undefined) out.computeVertexNormals();
  return out;
}
