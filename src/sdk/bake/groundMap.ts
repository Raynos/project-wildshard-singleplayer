import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, type InstancedMesh } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import type { BakedTerrain } from './terrain';
import type { BakedProps } from './props';
import { decodeTerrainTile, type TerrainTileData } from '@wildshard/format/terrainTileBytes';

const hexColour = v.pipe(v.string(), v.regex(/^#[a-fA-F0-9]{6}$/u));
const palette = v.pipe(v.array(v.object({ match: hexColour, fill: hexColour, edge: v.exactOptional(hexColour) })), v.minLength(1), v.maxLength(256));
const styleSchema = v.object({ kind: v.literal('ground'), classes: palette, sourceGain: v.optional(v.number(), 1), shade: v.optional(v.number(), .5),
  void: v.optional(v.union([hexColour, v.literal('transparent')])), rim: v.exactOptional(hexColour),
  water: v.exactOptional(v.object({ below: v.number(), fill: hexColour, within: v.exactOptional(v.object({ x0: v.number(), x1: v.number(), z0: v.number(), z1: v.number() })) })),
  raised: v.exactOptional(v.object({ bump: v.number(), classes: palette })) });
type Style = v.InferOutput<typeof styleSchema>;
type Triple = readonly [number, number, number];
const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
const srgb = (value: number): number => byte(255 * (value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055));
function item<T>(values: ArrayLike<T>, index: number): T { const value = values[index]; if (value === undefined) throw new Error('Incomplete map geometry'); return value; }
const triple = (values: ArrayLike<number>): Triple => [item(values, 0), item(values, 1), item(values, 2)];
const hex = (value: string): Triple => [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];

class ByteMapIO extends WebIO {
  protected override readURI(uri: string, _type: 'view' | 'text'): Promise<never> {
    return Promise.reject(new Error(`Map geometry must be self-contained: ${uri}`));
  }
}

class Raster {
  readonly size = 1000;
  readonly height = new Int32Array(this.size * this.size).fill(-2147483648);
  readonly colour = new Uint8Array(this.size * this.size * 3);
  triangles = 0;
  constructor(readonly below: number, readonly above: number) {}
  triangle(points: readonly [Triple, Triple, Triple], colours: readonly [Triple, Triple, Triple]): void {
    this.triangles++;
    const p = points.map(point => [Math.round((250 - point[0]) * this.size / 500 * 1024), Math.round((250 - point[2]) * this.size / 500 * 1024)] as const);
    const edge = (a: readonly [number, number], b: readonly [number, number], x: number, y: number): number => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const area = edge(item(p, 0), item(p, 1), ...item(p, 2)); if (area === 0) return;
    const minX = Math.max(0, Math.floor(Math.min(...p.map(q => q[0])) / 1024)), maxX = Math.min(this.size - 1, Math.ceil(Math.max(...p.map(q => q[0])) / 1024));
    const minY = Math.max(0, Math.floor(Math.min(...p.map(q => q[1])) / 1024)), maxY = Math.min(this.size - 1, Math.ceil(Math.max(...p.map(q => q[1])) / 1024));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const sx = x * 1024 + 512, sy = y * 1024 + 512;
      const a = edge(item(p, 1), item(p, 2), sx, sy) / area, b = edge(item(p, 2), item(p, 0), sx, sy) / area, c = 1 - a - b;
      if (a < 0 || b < 0 || c < -1e-12) continue;
      const h = a * points[0][1] + b * points[1][1] + c * points[2][1]; if (h < this.below || h > this.above) continue;
      const at = y * this.size + x, fixed = Math.round(h * 65536); if (fixed <= item(this.height, at)) continue;
      this.height[at] = fixed;
      for (let k = 0; k < 3; k++) this.colour[at * 3 + k] = byte(a * item(colours[0], k) + b * item(colours[1], k) + c * item(colours[2], k));
    }
  }
  terrain(tile: TerrainTileData): void {
    const r = tile.resolution, at = (x: number, z: number): number => z * r + x;
    const point = (x: number, z: number): Triple => [tile.x + x * tile.size / (r - 1), item(tile.heights, at(x, z)), tile.z + z * tile.size / (r - 1)];
    const colourAt = (x: number, z: number): Triple => triple([0, 1, 2].map(k => srgb(tile.colours?.[at(x, z) * 3 + k] ?? .5)));
    for (let z = 0; z < r - 1; z++) for (let x = 0; x < r - 1; x++) for (const indices of [[[x, z], [x, z + 1], [x + 1, z]], [[x + 1, z + 1], [x + 1, z], [x, z + 1]]] as const)
      this.triangle([point(...indices[0]), point(...indices[1]), point(...indices[2])], [colourAt(...indices[0]), colourAt(...indices[1]), colourAt(...indices[2])]);
  }
  async glb(bytes: Uint8Array, io: WebIO): Promise<void> {
    const doc = await io.readBinary(bytes);
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (mesh === null) continue;
      const world = new Matrix4().multiplyMatrices(new Matrix4(), new Matrix4().fromArray(node.getWorldMatrix()));
      const instances = node.getExtension<InstancedMesh>('EXT_mesh_gpu_instancing');
      const translation = instances?.getAttribute('TRANSLATION'), rotation = instances?.getAttribute('ROTATION'), scale = instances?.getAttribute('SCALE');
      const count = instances === null ? 1 : instances.listAttributes()[0]?.getCount() ?? 0;
      for (let copy = 0; copy < count; copy++) {
        const matrix = world.clone();
        if (instances !== null) matrix.multiply(new Matrix4().compose(new Vector3().fromArray(translation?.getElement(copy, []) ?? [0, 0, 0]), new Quaternion().fromArray(rotation?.getElement(copy, []) ?? [0, 0, 0, 1]), new Vector3().fromArray(scale?.getElement(copy, []) ?? [1, 1, 1])));
        for (const primitive of mesh.listPrimitives()) {
          if (primitive.getMode() !== 4) throw new Error('Map requires triangles');
          const position = primitive.getAttribute('POSITION'), colourAt = primitive.getAttribute('COLOR_0'), indices = primitive.getIndices();
          if (position === null) throw new Error('Map needs positions');
          const base = primitive.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1]; if (base[3] === 0) continue;
          const points: Triple[] = [], colours: Triple[] = [];
          for (let i = 0; i < position.getCount(); i++) {
            points.push(triple(new Vector3().fromArray(position.getElement(i, [])).applyMatrix4(matrix).toArray()));
            const c = colourAt?.getElement(i, []) ?? [1, 1, 1]; colours.push(triple([0, 1, 2].map(k => srgb(item(base, k) * item(c, k)))));
          }
          for (let i = 0; i < (indices?.getCount() ?? position.getCount()); i += 3) {
            const ids = [0, 1, 2].map(k => indices?.getScalar(i + k) ?? i + k);
            this.triangle([item(points, item(ids, 0)), item(points, item(ids, 1)), item(points, item(ids, 2))], [item(colours, item(ids, 0)), item(colours, item(ids, 1)), item(colours, item(ids, 2))]);
          }
        }
      }
    }
  }
}

function stylize(raster: Raster, style: Style): Uint8Array {
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
  const admitted = v.parse(styleSchema, style), raster = new Raster(clip.clipBelow ?? -Infinity, clip.clipAbove ?? Infinity);
  await MeshoptDecoder.ready;
  const io = new ByteMapIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const read = (assets: ReadonlyMap<string, Uint8Array>, hash: string): Uint8Array => { const bytes = assets.get(hash); if (bytes === undefined) throw new Error('Missing map source geometry'); return bytes; };
  for (const tile of terrain.terrain.tiles) if (tile.lod === 0) raster.terrain(decodeTerrainTile(read(terrain.assets, tile.file)));
  for (const tile of props.props.tiles) if (tile.lod === 0) for (const hash of [tile.file, ...tile.additionalFiles ?? []]) await raster.glb(read(props.assets, hash), io);
  for (const panel of props.props.panels) if (panel.visible) await raster.glb(read(props.assets, panel.file), io);
  if (raster.triangles === 0) throw new Error('Data map is empty');
  return { pixels: stylize(raster, admitted), triangles: raster.triangles };
}
