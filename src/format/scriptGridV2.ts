/** ABI-v2 height-grid transport. Sim/projection callers supply the native world
 * owner's lattice; there is no renderer or implicit active-terrain fallback. */
import type { V2Layout } from './scriptWireV2';

export interface V2HeightGrid {
  readonly originX: number; readonly originZ: number; readonly cellX: number; readonly cellZ: number;
  readonly cols: number; readonly rows: number; readonly waterY: number; readonly heights: Float32Array;
}
/** Validate arithmetic and copy all bytes before touching the guest. Returning
 * a writer lets the same native snapshot survive a rejected call/re-step. */
export function prepareV2HeightGrid(layout: V2Layout,grid: V2HeightGrid | null): { readonly count: number; readonly write: (view: DataView) => void } {
  const region = layout.regions[13];if (region === undefined) throw new Error('Missing v2 height-grid region');
  let bytes = new Uint8Array();
  if (grid !== null) {
    const { originX,originZ,cellX,cellZ,cols,rows,waterY,heights } = grid;
    if (![originX,originZ,cellX,cellZ,waterY].every(Number.isFinite) || cellX <= 0 || cellZ <= 0
      || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || region.capacity < 64
      || cols > Math.floor((region.capacity-64)/4/rows)) throw new Error('Invalid or oversized v2 height grid');
    if (heights.length !== cols*rows || !heights.every(Number.isFinite)
      || !Number.isFinite(originX+(cols-1)*cellX) || !Number.isFinite(originZ+(rows-1)*cellZ)) throw new Error('Invalid v2 height-grid samples');
    bytes = new Uint8Array(64+heights.length*4);const view = new DataView(bytes.buffer);
    [originX,originZ,cellX,cellZ].forEach((value,i) => view.setFloat64(i*8,value,true));
    view.setUint32(32,cols,true);view.setUint32(36,rows,true);view.setUint32(40,region.offset+64,true);view.setFloat64(48,waterY,true);view.setUint32(56,1,true);
    heights.forEach((value,i) => view.setFloat32(64+i*4,value,true));
  }
  return { count: bytes.length,write: view => {
    if (view.byteLength !== layout.pages*65536) throw new Error('Wrong v2 height-grid memory');
    const target = new Uint8Array(view.buffer,view.byteOffset+layout.io+region.offset,region.capacity);
    if (bytes.length === 0) target.subarray(0,64).fill(0);else target.set(bytes);
  } };
}
