// G508: renderer-free map painting. Coordinates and coverage come from the
// actual admitted triangles, never map-only silhouettes or collider proxies.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshGPUInstancing, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';

const identity = new Matrix4();
const byte = value => Math.max(0, Math.min(255, Math.round(value)));
const srgb = value => byte(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
const hex = colour => [1, 3, 5].map(at => Number.parseInt(colour.slice(at, at + 2), 16));

/** The same frame as bake-maps and Minimap: +Z north, -X east. */
export function mapPixel(x, z, size = 1000) { return [(250 - x) * size / 500, (250 - z) * size / 500]; }

/** Integer subpixel edges keep inclusion independent of CPU floating-point
 * contraction. Heights and colours are quantized only after interpolation. */
export class MapRaster {
  constructor(size = 1000, clip = {}) {
    this.size = size; this.clip = clip;
    this.height = new Int32Array(size * size).fill(-2147483648);
    this.colour = new Uint8Array(size * size * 3);
    this.triangles = 0;
  }
  triangle(points, colours) {
    this.triangles++;
    const p = points.map(point => { const [x, y] = mapPixel(point[0], point[2], this.size); return [Math.round(x * 1024), Math.round(y * 1024)]; });
    const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const area = edge(p[0], p[1], ...p[2]);
    if (area === 0) return;
    const minX = Math.max(0, Math.floor(Math.min(...p.map(q => q[0])) / 1024));
    const maxX = Math.min(this.size - 1, Math.ceil(Math.max(...p.map(q => q[0])) / 1024));
    const minY = Math.max(0, Math.floor(Math.min(...p.map(q => q[1])) / 1024));
    const maxY = Math.min(this.size - 1, Math.ceil(Math.max(...p.map(q => q[1])) / 1024));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const sx = x * 1024 + 512, sy = y * 1024 + 512;
      const a = edge(p[1], p[2], sx, sy) / area, b = edge(p[2], p[0], sx, sy) / area, c = 1 - a - b;
      if (a < 0 || b < 0 || c < -1e-12) continue;
      const h = a * points[0][1] + b * points[1][1] + c * points[2][1];
      if (h < (this.clip.clipBelow ?? -Infinity) || h > (this.clip.clipAbove ?? Infinity)) continue;
      const at = y * this.size + x, fixed = Math.round(h * 65536);
      if (fixed <= this.height[at]) continue;
      this.height[at] = fixed;
      for (let k = 0; k < 3; k++) this.colour[at * 3 + k] = byte(a * colours[0][k] + b * colours[1][k] + c * colours[2][k]);
    }
  }
  /** Original row-major rendered lattice, including vertex ground colours. */
  terrain(tile) {
    const r = tile.resolution, at = (x, z) => z * r + x;
    const point = (x, z) => [tile.x + x * tile.size / (r - 1), tile.heights[at(x, z)], tile.z + z * tile.size / (r - 1)];
    const colour = (x, z) => [0, 1, 2].map(k => srgb(tile.colours?.[at(x, z) * 3 + k] ?? 0.5));
    for (let z = 0; z < r - 1; z++) for (let x = 0; x < r - 1; x++) {
      for (const indices of [[[x, z], [x, z + 1], [x + 1, z]], [[x + 1, z + 1], [x + 1, z], [x, z + 1]]])
        this.triangle(indices.map(q => point(...q)), indices.map(q => colour(...q)));
    }
  }
  /** CPU projection of ordinary admitted GLBs, including instanced copies. */
  async glb(file, placement, select) {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions([EXTMeshGPUInstancing, EXTMeshoptCompression, KHRMeshQuantization])
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.readBinary(new Uint8Array(readFileSync(file)));
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (mesh === null || select !== undefined && !select(node)) continue;
      const world = new Matrix4().multiplyMatrices(placement ?? identity, new Matrix4().fromArray(node.getWorldMatrix()));
      const instances = node.getExtension('EXT_mesh_gpu_instancing');
      const translation = instances?.getAttribute('TRANSLATION'), rotation = instances?.getAttribute('ROTATION'), scale = instances?.getAttribute('SCALE');
      const count = instances === null ? 1 : instances.listAttributes()[0]?.getCount() ?? 0;
      for (let copy = 0; copy < count; copy++) {
        const matrix = world.clone();
        if (instances !== null) matrix.multiply(new Matrix4().compose(
          new Vector3().fromArray(translation?.getElement(copy, []) ?? [0, 0, 0]),
          new Quaternion().fromArray(rotation?.getElement(copy, []) ?? [0, 0, 0, 1]),
          new Vector3().fromArray(scale?.getElement(copy, []) ?? [1, 1, 1])));
        for (const primitive of mesh.listPrimitives()) {
          if (primitive.getMode() !== 4) throw new Error(`${file}: map requires triangles`);
          const position = primitive.getAttribute('POSITION'), colour = primitive.getAttribute('COLOR_0'), indices = primitive.getIndices();
          if (position === null) throw new Error(`${file}: missing positions`);
          const base = primitive.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1];
          if (base[3] === 0) continue;
          const points = [], colours = [];
          for (let i = 0; i < position.getCount(); i++) {
            points.push(new Vector3().fromArray(position.getElement(i, [])).applyMatrix4(matrix).toArray());
            const c = colour?.getElement(i, []) ?? [1, 1, 1];
            colours.push([0, 1, 2].map(k => srgb(base[k] * c[k])));
          }
          for (let i = 0; i < (indices?.getCount() ?? position.getCount()); i += 3) {
            const ids = [0, 1, 2].map(k => indices?.getScalar(i + k) ?? i + k);
            this.triangle(ids.map(id => points[id]), ids.map(id => colours[id]));
          }
        }
      }
    }
  }
}

/** Palette matching, relief and ink use integer arithmetic. No image model,
 * SIMD filtering, stochastic texture or platform-dependent lighting is involved.
 * Ground coverage is never eroded, dilated or smoothed away. */
export function stylizeMap(raster, style) {
  const { size, height, colour } = raster, out = Buffer.alloc(size * size * 4);
  const nearest = (rgb, rows) => rows.reduce((best, row) => {
    const match = hex(row.match), distance = match.reduce((sum, c, k) => sum + (c - rgb[k]) ** 2, 0);
    return distance < best.distance ? { row, distance } : best;
  }, { row: rows[0], distance: Infinity }).row;
  const valid = at => at >= 0 && at < height.length && height[at] !== -2147483648;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = y * size + x, h = height[at] / 65536, rgb = colour.subarray(at * 3, at * 3 + 3);
    const neighbours = [x > 0 ? at - 1 : -1, x + 1 < size ? at + 1 : -1, y > 0 ? at - size : -1, y + 1 < size ? at + size : -1];
    const border = neighbours.some(other => !valid(other));
    const clear = style.void === 'transparent';
    if (!valid(at)) {
      if (!clear) { const bg = hex(style.void ?? style.sea ?? style.classes?.[0]?.fill ?? '#282e33'); for (let k = 0; k < 3; k++) out[at * 4 + k] = bg[k]; out[at * 4 + 3] = 255; }
      continue;
    }
    let fill;
    if (style.kind === 'void') {
      const band = style.stoneBands.filter(b => h >= b).length;
      fill = hex(rgb[1] > rgb[0] && rgb[1] > rgb[2] * 1.15 ? style.grass : style.stone[band]);
      if (border) fill = hex(style.rim);
    } else if (style.kind === 'isle') {
      fill = hex(h < style.deepBelow ? style.sea : h < style.waterBelow ? style.shallow : style.grass[style.grassBands.filter(b => h >= b).length]);
    } else {
      const row = nearest(rgb, style.classes); fill = hex(row.fill);
      if (style.water !== undefined && h < style.water.below) {
        const w = style.water.within, wx = 250 - (x + 0.5) * 500 / size, wz = 250 - (y + 0.5) * 500 / size;
        if (w === undefined || wx >= w.x0 && wx <= w.x1 && wz >= w.z0 && wz <= w.z1) fill = hex(style.water.fill);
      }
      if (border && style.rim !== undefined) fill = hex(style.rim);
      else if (row.edge !== undefined && neighbours.some(other => valid(other) && nearest(colour.subarray(other * 3, other * 3 + 3), style.classes) !== row)) fill = hex(row.edge);
    }
    const left = valid(at - 1) && x > 0 ? height[at - 1] : height[at], top = valid(at - size) ? height[at - size] : height[at];
    const relief = Math.max(-28, Math.min(28, Math.trunc((left + top - height[at] * 2) / 32768)));
    const shade = 256 + Math.trunc(relief * (style.shade ?? 0.5));
    for (let k = 0; k < 3; k++) out[at * 4 + k] = byte(Math.trunc(fill[k] * shade / 256));
    out[at * 4 + 3] = 255;
  }
  return out;
}
