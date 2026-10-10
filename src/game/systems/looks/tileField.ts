import { BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, type Vector2, type Vector3 } from 'three';

/**
 * A camera-tiled card field as a declared row (SHARD-PLATFORM M3, look-family rows): a near meadow, a carpet of moss or
 * flowers, any ground cover drawn as many small cards round the camera with nothing uploaded per frame. One square tile of
 * `cards` seeded cards is drawn as a grid of instances (`across` × `across` tiles, the camera's in the middle), then the
 * inner 3 × 3 again `layers` more times (instance attribute `aTile` = tile x, tile z, layer), so the near field is denser
 * with no more cards in the buffer. The vertex program places each card: its `aRoot` is (x, z, r) in [0, 1) — where in the
 * tile and a per-card random — and `aShape` the card's outline vertex (across −1..1, up 0..1); `tileOrigin` snaps the
 * grid to the tile lattice under the camera. Nothing here knows a shard: the outline, the lattice and the seed are data,
 * the program is the shard's.
 */

/** A card's outline: its vertices (`[across, up]`) and its triangles (indices into them, three per triangle). */
export interface TileCardRow {
  readonly shape: readonly (readonly [number, number])[];
  readonly triangles: readonly number[];
}

/** The field's lattice: tiles across (odd), extra layers of the inner 3 × 3, the cards' seed and their outline. */
export interface TileFieldRow {
  readonly across: number;
  readonly layers: number;
  readonly seed: number;
  readonly card: TileCardRow;
}

/** The field's geometry: `cards` cards per tile (a tier knob), seeded so every load grows the same field; positions are
 *  zero (the program places every vertex from `aRoot`, `aShape` and `aTile`). */
export function tileFieldGeometry(row: TileFieldRow, cards: number): InstancedBufferGeometry {
  const per = row.card.shape.length, tris = row.card.triangles, verts = cards * per;
  const root = new Float32Array(verts * 3), shape = new Float32Array(verts * 2), index = new Uint32Array(cards * tris.length);
  let a = row.seed >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let b = 0; b < cards; b++) {
    const x = rnd(), z = rnd(), r = rnd();
    for (let v = 0; v < per; v++) {
      const i = b * per + v, s = row.card.shape[v] ?? [0, 0];
      root[i * 3] = x; root[i * 3 + 1] = z; root[i * 3 + 2] = r; shape[i * 2] = s[0]; shape[i * 2 + 1] = s[1];
    }
    const o = b * per;
    index.set(tris.map((k) => o + k), b * tris.length);
  }
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  g.setAttribute('aRoot', new BufferAttribute(root, 3)); g.setAttribute('aShape', new BufferAttribute(shape, 2));
  g.setIndex(new BufferAttribute(index, 1));
  // the tiles: every tile once (layer 0), then the inner 3 × 3 again per extra layer
  const n = row.across, half = (n - 1) / 2, count = n * n + 9 * row.layers, tiles = new Float32Array(count * 3);
  for (let i = 0; i < n * n; i++) { tiles[i * 3] = (i % n) - half; tiles[i * 3 + 1] = Math.floor(i / n) - half; }
  for (let l = 1; l <= row.layers; l++) for (let k = 0; k < 9; k++) {
    const i = n * n + (l - 1) * 9 + k; tiles[i * 3] = (k % 3) - 1; tiles[i * 3 + 1] = Math.floor(k / 3) - 1; tiles[i * 3 + 2] = l;
  }
  g.setAttribute('aTile', new InstancedBufferAttribute(tiles, 3)); g.instanceCount = count;
  return g;
}

/** The tile corner under the camera (x, z snapped down to the `tile`-metre lattice) into `out`. */
export function tileOrigin(out: Vector2, camera: Vector3, tile: number): Vector2 {
  return out.set(Math.floor(camera.x / tile) * tile, Math.floor(camera.z / tile) * tile);
}
