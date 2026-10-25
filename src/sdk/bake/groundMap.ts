import * as v from 'valibot';
import type { BakedTerrain } from './terrain';
import type { BakedProps } from './props';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { MapRaster } from './mapRaster';

const hexColour = v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u));
const palette = v.pipe(v.array(v.object({ match: hexColour, fill: hexColour, edge: v.exactOptional(hexColour) })), v.minLength(1), v.maxLength(256));
const styleSchema = v.object({ kind: v.literal('ground'), classes: palette, sourceGain: v.optional(v.number(), 1), shade: v.optional(v.number(), .5),
  void: v.optional(v.union([hexColour, v.literal('transparent')])), rim: v.exactOptional(hexColour),
  water: v.exactOptional(v.object({ below: v.number(), fill: hexColour, within: v.exactOptional(v.object({ x0: v.number(), x1: v.number(), z0: v.number(), z1: v.number() })) })),
  raised: v.exactOptional(v.object({ bump: v.number(), classes: palette })) });
type Style = v.InferOutput<typeof styleSchema>;
type Triple = readonly [number, number, number];
const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
function item<T>(values: ArrayLike<T>, index: number): T { const value = values[index]; if (value === undefined) throw new Error('Incomplete map geometry'); return value; }
const triple = (values: ArrayLike<number>): Triple => [item(values, 0), item(values, 1), item(values, 2)];
const hex = (value: string): Triple => [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];

function stylize(raster: MapRaster, style: Style): Uint8Array {
  const { size, height, colour } = raster, out = new Uint8Array(size * size * 4);
  const nearest = (rgb: Triple, rows: Style['classes']): Style['classes'][number] => rows.reduce((best, row) => {
    const match = hex(row.match), distance = match.reduce((sum, c, k) => sum + (c - item(rgb, k)) ** 2, 0);
    return distance < best.distance ? { row, distance } : best;
  }, { row: item(rows, 0), distance: Infinity }).row;
  const valid = (at: number): boolean => at >= 0 && at < height.length && height[at] !== -2147483648;
  const sourceColour = (at: number): Triple => triple(Array.from(colour.subarray(at * 3, at * 3 + 3), c => byte(c * style.sourceGain)));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = y * size + x, h = item(height, at) / 65536, rgb = sourceColour(at);
    const neighbours = [x > 0 ? at - 1 : -1, x + 1 < size ? at + 1 : -1, y > 0 ? at - size : -1, y + 1 < size ? at + size : -1];
    const border = neighbours.some(other => !valid(other));
    if (!valid(at)) {
      if (style.void !== 'transparent') { const bg = hex(style.void ?? item(style.classes, 0).fill); for (let k = 0; k < 3; k++) out[at * 4 + k] = item(bg, k); out[at * 4 + 3] = 255; }
      continue;
    }
    const row = nearest(rgb, style.classes); let fill = hex(row.fill);
    if (style.water !== undefined && h < style.water.below) {
      const w = style.water.within, wx = 250 - (x + .5) * 500 / size, wz = 250 - (y + .5) * 500 / size;
      if (w === undefined || wx >= w.x0 && wx <= w.x1 && wz >= w.z0 && wz <= w.z1) fill = hex(style.water.fill);
    }
    if (border && style.rim !== undefined) fill = hex(style.rim);
    else if (row.edge !== undefined && neighbours.some(other => valid(other) && nearest(sourceColour(other), style.classes) !== row)) fill = hex(row.edge);
    const raisedStyle = style.raised;
    if (raisedStyle !== undefined) {
      const around: number[] = [];
      for (const dz of [-7, 0, 7]) for (const dx of [-7, 0, 7]) {
        const px = x + dx, py = y + dz, other = py * size + px;
        if (px >= 0 && px < size && py >= 0 && py < size && valid(other)) around.push(item(height, other));
      }
      around.sort((a, b) => a - b);
      const ground = around[Math.floor(around.length / 2)] ?? item(height, at);
      if (item(height, at) - ground > raisedStyle.bump * 65536) {
        const raised = nearest(rgb, raisedStyle.classes), edge = raised.edge;
        if (edge === undefined) throw new Error('Raised map palette needs edges');
        fill = hex(neighbours.some(other => valid(other) && item(height, at) - item(height, other) > raisedStyle.bump * 32768) ? edge : raised.fill);
      }
    }
    const left = valid(at - 1) && x > 0 ? item(height, at - 1) : item(height, at), top = valid(at - size) ? item(height, at - size) : item(height, at);
    const relief = Math.max(-80, Math.min(80, Math.trunc((left + top - item(height, at) * 2) / 512))), shade = 256 + Math.trunc(relief * style.shade);
    for (let k = 0; k < 3; k++) out[at * 4 + k] = byte(Math.trunc(item(fill, k) * shade / 256)); out[at * 4 + 3] = 255;
  }
  return out;
}

/** Paint the existing 500 m, +Z north/-X east ground map from actual L0 terrain and placed GLB triangles.
 * Returns RGBA8 bytes, not a file; the project writer supplies the normal lossless WebP and source identity. */
export async function rasterGroundMap(terrain: Pick<BakedTerrain, 'terrain' | 'assets'>, props: Pick<BakedProps, 'props' | 'assets'>, style: unknown, clip: { clipBelow?: number | null; clipAbove?: number | null } = {}): Promise<{ pixels: Uint8Array; triangles: number }> {
  const admitted = v.parse(styleSchema, style), raster = new MapRaster(1000, { clipBelow: clip.clipBelow ?? -Infinity, clipAbove: clip.clipAbove ?? Infinity });
  const read = (assets: ReadonlyMap<string, Uint8Array>, hash: string): Uint8Array => { const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Missing map source geometry'); return bytes; };
  for (const tile of terrain.terrain.tiles) if (tile.lod === 0) raster.terrain(decodeTerrainTile(read(terrain.assets, tile.file)));
  for (const tile of props.props.tiles) if (tile.lod === 0) for (const hash of [tile.file, ...tile.additionalFiles ?? []]) await raster.glb(read(props.assets, hash));
  for (const panel of props.props.panels) if (panel.visible) await raster.glb(read(props.assets, panel.file));
  if (raster.triangles === 0) throw new Error('Data map is empty');
  return { pixels: stylize(raster, admitted), triangles: raster.triangles };
}
