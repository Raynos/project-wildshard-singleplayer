import { Color } from 'three';
import { CHUNK_HALF, CHUNK_SIZE } from '@wildshard/engine/core/config';
import { HUT, LOOKOUT, SHRINE, WRECK } from '../world/sites';
import authoredLayout from '../data/layout.json' with { type: 'json' };
import { islandCoveSpec } from './coveLayout';
import COVER_LOOK from '../data/coverLook.json' with { type: 'json' };
import authoredCoverLook from '../data/groundCover.json' with { type: 'json' };
import { DENSITY, type Site } from './coverSites';

const { ISLAND } = authoredLayout;
const { GROUND_COVER } = authoredCoverLook;

/** What the grid holds at a point: mean colour (linear), and top / side packed as 1 − e^−τ. */
export interface CoverSample { r: number; g: number; b: number; top: number; side: number }
const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const KIND_DENSITY = GROUND_COVER.kinds.map(k => DENSITY[k.name] ?? (() => 0));
/** Build-only mutable lattice; runtime borrows its already completed file. */
export class AuthorCoverGrid {
  readonly step = 4;
  readonly n = Math.ceil(CHUNK_SIZE / this.step) + 1;
  readonly data = new Float32Array(this.n * this.n * 5);
  private ix(at: number): number { return Math.max(0, Math.min(this.n - 1, Math.round((at + CHUNK_HALF) / this.step))); }
  blockLength(x0: number, x1: number, z0: number, z1: number): number { return (this.ix(x1) - this.ix(x0) + 1) * (this.ix(z1) - this.ix(z0) + 1) * 5; }
  fill(at: (x: number, z: number, out: CoverSample) => void, x0: number, x1: number, z0: number, z1: number): void {
    const v: CoverSample = {r:0,g:0,b:0,top:0,side:0};
    for(let k=this.ix(z0);k<=this.ix(z1);k++) for(let i=this.ix(x0);i<=this.ix(x1);i++) {
      v.r=0;v.g=0;v.b=0;v.top=0;v.side=0;at(-CHUNK_HALF+i*this.step,-CHUNK_HALF+k*this.step,v);
      this.data.set([v.r,v.g,v.b,v.top,v.side],(k*this.n+i)*5);
    }
  }
  /** Losslessly omit the all-zero perimeter; samples outside these bounds remain zero. */
  crop():{data:Float32Array;rect:{x:number;z:number;width:number;height:number}} {
    let x0=this.n,z0=this.n,x1=-1,z1=-1;
    for(let z=0;z<this.n;z++)for(let x=0;x<this.n;x++){
      const o=(z*this.n+x)*5;if(this.data.subarray(o,o+5).some(v=>v!==0)){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}
    }
    if(x1<x0||z1<z0)throw new Error('Authored full cover grid is empty');
    const width=x1-x0+1,height=z1-z0+1,data=new Float32Array(width*height*5);
    for(let z=z0;z<=z1;z++)data.set(this.data.subarray((z*this.n+x0)*5,(z*this.n+x1+1)*5),(z-z0)*width*5);
    return{data,rect:{x:x0,z:z0,width,height}};
  }
  /** Bilinear sample at (x, z) into out (the colour weighted by cover, so a bare neighbour doesn't grey it). */
  sample(x: number, z: number, out: CoverSample): CoverSample {
    const n = this.n, fx = (x + CHUNK_HALF) / this.step, fz = (z + CHUNK_HALF) / this.step;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), k = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), w = Math.min(1, Math.max(0, fz - k));
    let r = 0, g = 0, b = 0, cw = 0, top = 0, side = 0;
    for (let c = 0; c < 4; c++) {
      const di = c & 1, dk = c >> 1, wt = (di === 1 ? u : 1 - u) * (dk === 1 ? w : 1 - w);
      const o = ((k + dk) * n + i + di) * 5, t = this.data[o + 3] ?? 0, sd = this.data[o + 4] ?? 0, ca = (t + sd) * wt;
      r += (this.data[o] ?? 0) * ca; g += (this.data[o + 1] ?? 0) * ca; b += (this.data[o + 2] ?? 0) * ca; cw += ca;
      top += t * wt; side += sd * wt;
    }
    if (cw < 1e-5) { out.r = 0; out.g = 0; out.b = 0; out.top = 0; out.side = 0; return out; }
    out.r = r / cw; out.g = g / cw; out.b = b / cw; out.top = top; out.side = side;
    return out;
  }
  writeBlock(block: Float32Array, x0:number,x1:number,z0:number,z1:number): void {
    if(block.length!==this.blockLength(x0,x1,z0,z1))throw new Error('Author cover overlay differs');
    const i0=this.ix(x0),i1=this.ix(x1),k0=this.ix(z0),k1=this.ix(z1),row=(i1-i0+1)*5;
    for(let k=k0;k<=k1;k++)this.data.set(block.subarray((k-k0)*row,(k-k0+1)*row),(k*this.n+i0)*5);
  }
}
function nearPalm(palms: readonly { x: number; z: number }[], x: number, z: number): number {
    let best = 0;
    for (const p of palms) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 3.5) best = Math.max(best, 1 - smooth(1.0, 3.5, d));
    }
    return best;
  }


/** Where the cover places nothing: the named places' footprints, the cave mouth and the pier's landing; and the shrine
 *  (the jungle's centre). */
export function coverAvoid(): { avoid: { x: number; z: number; r: number }[]; shrine: { x: number; z: number } } {
 const cave=islandCoveSpec().cave;
 return { avoid: [{x:HUT.x,z:HUT.z,r:9},{x:LOOKOUT.x,z:LOOKOUT.z,r:8},{x:SHRINE.x,z:SHRINE.z,r:9.5},{x:WRECK.x,z:WRECK.z,r:13},{x:cave.x,z:cave.z+cave.depth/2,r:8},{x:0,z:-151,r:3.2}], shrine: { x: SHRINE.x, z: SHRINE.z } };
}

/** The native cover estimate outside the Blender splat, compiled once per tier. */
export function baseCoverGrid(palms: readonly {x:number;z:number}[], heightAt:(x:number,z:number)=>number, normalAt:(x:number,z:number,eps:number)=>[number,number,number], trailDistance:(x:number,z:number)=>number): AuthorCoverGrid {
 const { avoid } = coverAvoid();
    const sea = 0, grid = new AuthorCoverGrid(), per = GROUND_COVER.candidates / (GROUND_COVER.cell * GROUND_COVER.cell), col = new Color();
    const site: Site = { h: 0, slope: 0, nx: 0, ny: 1, nz: 0, td: 0, sd: 0, palm: 0 };
    grid.fill((x, z, out) => {
      if (avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) return;
      const h = heightAt(x, z) - sea;
      if (h < 0.4) return;
      const [, ny] = normalAt(x, z, 0.6), slope = 1 - ny;
      if (slope > 0.3) return;
      site.h = h; site.slope = slope; site.td = trailDistance(x, z); site.sd = Math.hypot(x - SHRINE.x, z - SHRINE.z); site.palm = nearPalm(palms, x, z);
      let top = 0, side = 0;
      col.setRGB(0, 0, 0);
      for (const [ki, k] of GROUND_COVER.kinds.entries()) {
        const look = COVER_LOOK[k.name];
        const n = per * Math.min(1, Math.max(0, (KIND_DENSITY[ki] ?? (() => 0))(site)) / 2), s = (k.scale[0] + k.scale[1]) / 2, ns = n * s * s;
        const t = ns * look.top, sd2 = ns * look.side, wt = t + sd2;
        top += t; side += sd2; col.r += look.r * wt; col.g += look.g * wt; col.b += look.b * wt;
      }
      const w = top + side;
      if (w > 0) { out.r = col.r / w; out.g = col.g / w; out.b = col.b / w; out.top = 1 - Math.exp(-top); out.side = 1 - Math.exp(-side); }
    }, ISLAND.x - ISLAND.r - 40, ISLAND.x + ISLAND.r + 40, ISLAND.z - ISLAND.r - 40, ISLAND.z + ISLAND.r + 40);
    return grid;
}
