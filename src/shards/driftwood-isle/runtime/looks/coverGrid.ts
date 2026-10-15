import * as THREE from 'three';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';

/**
 * The ground wears the cover (SHARD-PLATFORM M3, look-family rows): a shard whose ground cover is drawn only round the
 * camera leaves bare terrain past it, so plants seem to appear as you walk up to them. This is a chunk-wide grid of what
 * the cover makes the ground look like: per cell the share of the ground the plants cover seen from straight above
 * (`top`), how much they hide seen from the side (`side`: their upright blades and fronds) and their mean colour (`rgb`).
 * The author fills it from its density rules and splats the cover it placed. The page borrows that validated file. Terrains sample it per vertex (`aCover`, `flat`, like their colour) through `tintTerrain`, and
 * their graph mixes the facet towards the cover colour by how much of the ground the plants hide *from where you look*:
 * a little from above, nearly all of it at the grazing angle far ground is seen at (data/groundLook.ts `coverMix`: the
 * faceted ground's and the baked cove's terrain graphs). Each terrain declares the attributes zeroed when it builds
 * (`coverAttributes`) and `tintTerrain` fills them in place.
 *
 *   const grid = CoverGrid.create(admitted, bounds);  // full grid, no second allocation
 *   coverAttributes(geometry, count);         // as the terrain builds: its graph reads them from the first draw
 *   tintTerrain(terrain.mesh);                // after the fill: aCover per vertex
 */

/** What the grid holds at a point: mean colour (linear), and top / side packed as 1 − e^−τ. */
export interface CoverSample { r: number; g: number; b: number; top: number; side: number }
/** An empty sample to fill. */
export const coverSample = (): CoverSample => ({ r: 0, g: 0, b: 0, top: 0, side: 0 });
const W = 5;

/** A chunk-wide grid of the cover's look: r, g, b (linear, like the vertex colours), top, side (1 − e^−τ) per cell. */
export class CoverGrid {
  /** metres per cell */
  readonly step: number;
  /** cells per side */
  readonly n: number;
  /** r, g, b, top, side per cell, row by row */
  readonly data: Float32Array;
  private static current: CoverGrid | null = null;

  /** `step`: metres per cell (the chunk's whole extent is covered). */
  constructor(data: Float32Array, private readonly rect:{x:number;z:number;width:number;height:number}, step = 4) {
    this.step = step;
    this.n = Math.ceil(CHUNK_SIZE / step) + 1;
    if(![rect.x,rect.z,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.z<0||rect.width<1||rect.height<1||rect.x+rect.width>this.n||rect.z+rect.height>this.n||data.length!==rect.width*rect.height*W)throw new Error('Required full cover grid has another extent');
    this.data = data;
  }

  /** The chunk's grid (a new shard load starts a new one). */
  static create(data: Float32Array, rect:{x:number;z:number;width:number;height:number}, step = 4): CoverGrid { CoverGrid.current = new CoverGrid(data,rect,step); return CoverGrid.current; }
  /** The chunk's grid, once created. */
  static get(): CoverGrid | null { return CoverGrid.current; }

  /** Bilinear sample at (x, z) into out (the colour weighted by cover, so a bare neighbour doesn't grey it). */
  sample(x: number, z: number, out: CoverSample): CoverSample {
    const n = this.n, fx = (x + CHUNK_HALF) / this.step, fz = (z + CHUNK_HALF) / this.step;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), k = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), w = Math.min(1, Math.max(0, fz - k));
    let r = 0, g = 0, b = 0, cw = 0, top = 0, side = 0;
    // the four corners in a loop over an index, not over a literal of arrays: five arrays a call was garbage a streamed
    // cover's cells made by the thousand while running
    for (let c = 0; c < 4; c++) {
      const di = c & 1, dk = c >> 1, wt = (di === 1 ? u : 1 - u) * (dk === 1 ? w : 1 - w);
      const cx=i+di-this.rect.x,cz=k+dk-this.rect.z;
      if(cx<0||cz<0||cx>=this.rect.width||cz>=this.rect.height)continue;
      const o = (cz*this.rect.width+cx) * W, t = this.data[o + 3] ?? 0, sd = this.data[o + 4] ?? 0, ca = (t + sd) * wt;
      r += (this.data[o] ?? 0) * ca; g += (this.data[o + 1] ?? 0) * ca; b += (this.data[o + 2] ?? 0) * ca; cw += ca;
      top += t * wt; side += sd * wt;
    }
    if (cw < 1e-5) { out.r = 0; out.g = 0; out.b = 0; out.top = 0; out.side = 0; return out; }
    out.r = r / cw; out.g = g / cw; out.b = b / cw; out.top = top; out.side = side;
    return out;
  }

  /**
   * The grid as a graph's texture (half floats, linear): per cell r, g, b × (top + side) and top + side, a ring of empty
   * cells round it, so a bilinear sample's rgb over its alpha is `sample`'s colour and its alpha `top + side`. `rect`: the
   * uv of a world (x, z) is (x, z) × [2, 3] + [0, 1].
   */
  texture(): { texture: THREE.DataTexture; rect: [number, number, number, number] } {
    const w = this.rect.width + 2, h = this.rect.height + 2, out = new Uint16Array(w * h * 4), half = (v: number): number => THREE.DataUtils.toHalfFloat(v);
    for (let z = 0; z < Math.min(this.rect.height, 4096); z++) for (let x = 0; x < Math.min(this.rect.width, 4096); x++) {
      const o = (z * this.rect.width + x) * W, a = (this.data[o + 3] ?? 0) + (this.data[o + 4] ?? 0), t = ((z + 1) * w + x + 1) * 4;
      out[t] = half((this.data[o] ?? 0) * a); out[t + 1] = half((this.data[o + 1] ?? 0) * a); out[t + 2] = half((this.data[o + 2] ?? 0) * a); out[t + 3] = half(a);
    }
    const texture = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
    const k = CHUNK_HALF / this.step;
    return { texture, rect: [(k - this.rect.x + 1.5) / w, (k - this.rect.z + 1.5) / h, 1 / (this.step * w), 1 / (this.step * h)] };
  }

}

/** ×0.88 … ×1.12 per point, a hash of where it is (the facets of covered ground keep their light / dark mosaic). */
export const coverJitter = (x: number, z: number): number => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return 0.88 + (h - Math.floor(h)) * 0.24; };

/**
 * Give a low-poly terrain mesh the cover's look: fill its `aCover` / `aCoverSide` attributes (declared by
 * `coverAttributes` as it built; the grid sampled at each vertex's world position, read `flat` like the facet colour: a
 * facet takes its provoking vertex's). `matrixWorld`: the mesh's (meshopt tiles keep their dequantisation there).
 */
export function tintTerrain(mesh: THREE.Mesh, matrixWorld = mesh.matrixWorld): void {
  const grid = CoverGrid.get();
  if (!grid) return;
  const geo = mesh.geometry, pos = geo.getAttribute('position');
  const own = ownCover(geo, pos.count);
  if (own === null) throw new Error('tintTerrain: the terrain declares no cover attributes (coverAttributes as it builds)');
  const { cover, side } = own;
  const p = new THREE.Vector3(), s = coverSample(), byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrixWorld);
    grid.sample(p.x, p.z, s);
    // the facet jitter the terrain's own colour has, so the covered ground still reads as facets
    const j = coverJitter(p.x, p.z);
    cover[i * 4] = byte(s.r * j); cover[i * 4 + 1] = byte(s.g * j); cover[i * 4 + 2] = byte(s.b * j); cover[i * 4 + 3] = byte(s.top);
    side[i] = byte(s.side);
  }
  own.coverAttr.needsUpdate = true; own.sideAttr.needsUpdate = true;
}

/** A graph terrain's cover attributes, zeroed (no tint until `tintTerrain` fills them in place): `aCover` (rgb, top) and
 *  `aCoverSide`, normalized bytes, so its program reads them from its first draw and the fill allocates nothing more. */
export function coverAttributes(geo: THREE.BufferGeometry, count: number): void {
  geo.setAttribute('aCover', new THREE.BufferAttribute(new Uint8Array(count * 4), 4, true));
  geo.setAttribute('aCoverSide', new THREE.BufferAttribute(new Uint8Array(count), 1, true));
}

function ownCover(geo: THREE.BufferGeometry, count: number): { cover: Uint8Array; side: Uint8Array; coverAttr: THREE.BufferAttribute; sideAttr: THREE.BufferAttribute } | null {
  const coverAttr = geo.getAttribute('aCover'), sideAttr = geo.getAttribute('aCoverSide');
  if (!(coverAttr instanceof THREE.BufferAttribute) || !(sideAttr instanceof THREE.BufferAttribute)) return null;
  const cover = coverAttr.array, side = sideAttr.array;
  if (!(cover instanceof Uint8Array) || !(side instanceof Uint8Array) || cover.length !== count * 4 || side.length !== count) return null;
  return { cover, side, coverAttr, sideAttr };
}
