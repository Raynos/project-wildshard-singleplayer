/** Immutable authored zipline draws; the live driver, materials and colliders remain with the world owner. */
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { CableLayout } from '@wildshard/sdk/movers';
import { modelGeometry } from '../runtime/boot/modelGeometry';
import rows from '../data/zipline.generated.json';

const world = modelGeometry(rows.world), specimen = modelGeometry(rows.specimen);
const trolley = modelGeometry(rows.trolley), parked = modelGeometry(rows.parked);
export async function loadZiplineGeometry(): Promise<void> { await Promise.all([world.load(), trolley.load(), specimen.load(), parked.load()]); }

export function ziplineGeometry(lay: CableLayout): { rig: ReturnType<typeof world.copy>; trolley: ReturnType<typeof trolley.copy> } {
  if (['top', 'bottom'].some(key => {
    const actual = key === 'top' ? lay.spec.top : lay.spec.bottom, expected = key === 'top' ? rows.layout.top : rows.layout.bottom;
    return (actual.x - expected.x) ** 2 + (actual.y - expected.y) ** 2 + (actual.z - expected.z) ** 2 > 1e-12;
  }) || (lay.spec.sag ?? 1.6) !== rows.layout.sag) throw new Error('Unsupported baked zipline layout');
  return { rig: world.copy(), trolley: trolley.copy() };
}

export type ZiplineParams = typeof rows.specimenLayout;
export const zipline = defineModel<ZiplineParams>({
  id: 'driftwood-isle/zipline', name: 'Zipline', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/zipline.ts', surface: 'planks',
  defaults: { top: { x: 0, y: 0, z: 0 }, bottom: { x: 13, y: -5, z: 3 } },
  prepare: loadZiplineGeometry,
  build: (ctx, p) => {
    if (['top', 'bottom'].some(key => {
      const actual = key === 'top' ? p.top : p.bottom, expected = key === 'top' ? rows.specimenLayout.top : rows.specimenLayout.bottom;
      return actual.x !== expected.x || actual.y !== expected.y || actual.z !== expected.z;
    })) throw new Error('Unsupported zipline specimen layout');
    const mat = lowPolyLookMaterial(ctx.sky, 'still');
    return [{ geometry: specimen.copy(), material: mat, castShadow: true, receiveShadow: true }, { geometry: parked.copy(), material: mat, castShadow: true }];
  },
});
