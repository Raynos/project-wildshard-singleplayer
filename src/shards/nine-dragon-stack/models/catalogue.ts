import { defineModel } from '@wildshard/engine/models/model';
import { nativeSpecimen, type NdLook } from '../world/modelLook';
import { loadCast, loadCastLods } from '../world/casts';
import boot from '../boot/metadata.generated.json' with { type: 'json' };

export const brassDragonHook = defineModel(nativeSpecimen('brassDragonHook'));
export const drumStool = defineModel(nativeSpecimen('drumStool'));
export const mahjongTableModel = defineModel(nativeSpecimen('mahjongTableModel'));
export const parkedScooter = defineModel(nativeSpecimen('parkedScooter'));
export const lampPostModel = defineModel(nativeSpecimen('lampPostModel'));
export const lotusPostModel = defineModel(nativeSpecimen('lotusPostModel'));
export const lotusFinial = defineModel(nativeSpecimen('lotusFinial'));
export const wellBalustrade = defineModel(nativeSpecimen('wellBalustrade'));
export const landingPlanterModel = defineModel(nativeSpecimen('landingPlanterModel'));
export const airConBox = defineModel(nativeSpecimen('airConBox'));
export const galleryPlant = defineModel(nativeSpecimen('galleryPlant'));
export const balustradePanel = defineModel(nativeSpecimen('balustradePanel'));
export const laundryLineModel = defineModel(nativeSpecimen('laundryLineModel'));
export const paifang = defineModel(nativeSpecimen('paifang'));
export const hawkerStallModel = defineModel(nativeSpecimen('hawkerStallModel'));
export const noodleStallModel = defineModel(nativeSpecimen('noodleStallModel'));

export const FACADE_MODELS = Object.fromEntries(boot.explorerModels.facade.filter(row => !row.baked).map(row => [row.piece, defineModel(nativeSpecimen(row.key))]));
export const FACADE_BAKED = Object.fromEntries(boot.explorerModels.facade.filter(row => row.baked).map(row => [row.piece, defineModel(nativeSpecimen(row.key))]));

export const marketBooth = defineModel(nativeSpecimen('marketBooth'));
export const parasolTable = defineModel(nativeSpecimen('parasolTable'));
export const diningPavilion = defineModel(nativeSpecimen('diningPavilion'));
export const guardianLion = defineModel(nativeSpecimen('guardianLion'));

/** Load the declared cast and its authored LODs before synchronous placement. */
export async function loadLion(look: NdLook): Promise<void> {
  const geometry = await loadCast('lion'); look.geo.set('lion', geometry);
  await loadCastLods(look.geo, 'lion', geometry, [10, 30]);
}
