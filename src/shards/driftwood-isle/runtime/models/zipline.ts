import { driftwoodRows } from '../boot/rows';
/** Immutable authored zipline draws; the live driver, materials and colliders remain with the world owner. */
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { CableLayout } from '@wildshard/engine/sim/cableTraversal';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { readDriftwoodBlob } from '../boot/blobAssets';

const world = modelGeometry('draw:zipline:world'), specimen = modelGeometry('draw:zipline:specimen');
const trolley = modelGeometry('draw:zipline:trolley'), parked = modelGeometry('draw:zipline:parked');
export async function loadZiplineGeometry(): Promise<void> {
  await Promise.all([
    readDriftwoodBlob(driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.world).then(bytes => world.load(bytes)),
    readDriftwoodBlob(driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.trolley).then(bytes => trolley.load(bytes)),
    readDriftwoodBlob(driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.specimen).then(bytes => specimen.load(bytes)),
    readDriftwoodBlob(driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.parked).then(bytes => parked.load(bytes)),
  ]);
}

export function ziplineGeometry(lay: CableLayout): { rig: ReturnType<typeof world.copy>; trolley: ReturnType<typeof trolley.copy> } {
  if (['top', 'bottom'].some(key => {
    const actual = key === 'top' ? lay.spec.top : lay.spec.bottom, expected = key === 'top' ? driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.layout.top : driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.layout.bottom;
    return (actual.x - expected.x) ** 2 + (actual.y - expected.y) ** 2 + (actual.z - expected.z) ** 2 > 1e-12;
  }) || (lay.spec.sag ?? 1.6) !== driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.layout.sag) throw new Error('Unsupported baked zipline layout');
  return { rig: world.copy(), trolley: trolley.copy() };
}

interface Point { x: number; y: number; z: number }
export interface ZiplineParams { top: Point; bottom: Point }
export const zipline = defineModel<ZiplineParams>({
  id: 'driftwood-isle/zipline', name: 'Zipline', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/zipline.ts', surface: 'planks',
  defaults: { top: { x: 0, y: 0, z: 0 }, bottom: { x: 13, y: -5, z: 3 } },
  prepare: loadZiplineGeometry,
  build: (ctx, p) => {
    if (['top', 'bottom'].some(key => {
      const actual = key === 'top' ? p.top : p.bottom, expected = key === 'top' ? driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.specimenLayout.top : driftwoodRows('custom/fixedLayouts').nativeView.ZIPLINE_ROWS.specimenLayout.bottom;
      return actual.x !== expected.x || actual.y !== expected.y || actual.z !== expected.z;
    })) throw new Error('Unsupported zipline specimen layout');
    const mat = lowPolyLookMaterial(ctx.sky, 'still');
    return [{ geometry: specimen.copy(), material: mat, castShadow: true, receiveShadow: true }, { geometry: parked.copy(), material: mat, castShadow: true }];
  },
});
