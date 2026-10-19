import { nativeSpecimen, type NdLook } from '../world/modelLook';
import { loadCast, loadCastLods } from '../world/casts';
import boot from '../boot/metadata.generated.json' with { type: 'json' };

export const brassDragonHook = nativeSpecimen('brassDragonHook');
export const drumStool = nativeSpecimen('drumStool');
export const mahjongTableModel = nativeSpecimen('mahjongTableModel');
export const parkedScooter = nativeSpecimen('parkedScooter');
export const lampPostModel = nativeSpecimen('lampPostModel');
export const lotusPostModel = nativeSpecimen('lotusPostModel');
export const lotusFinial = nativeSpecimen('lotusFinial');
export const wellBalustrade = nativeSpecimen('wellBalustrade');
export const landingPlanterModel = nativeSpecimen('landingPlanterModel');
export const airConBox = nativeSpecimen('airConBox');
export const galleryPlant = nativeSpecimen('galleryPlant');
export const balustradePanel = nativeSpecimen('balustradePanel');
export const laundryLineModel = nativeSpecimen('laundryLineModel');
export const paifang = nativeSpecimen('paifang');
export const hawkerStallModel = nativeSpecimen('hawkerStallModel');
export const noodleStallModel = nativeSpecimen('noodleStallModel');

export const FACADE_MODELS = Object.fromEntries(boot.explorerModels.facade.filter(row => !row.baked).map(row => [row.piece, nativeSpecimen(row.key)]));
export const FACADE_BAKED = Object.fromEntries(boot.explorerModels.facade.filter(row => row.baked).map(row => [row.piece, nativeSpecimen(row.key)]));

export const marketBooth = nativeSpecimen('marketBooth');
export const parasolTable = nativeSpecimen('parasolTable');
export const diningPavilion = nativeSpecimen('diningPavilion');
export const guardianLion = nativeSpecimen('guardianLion');

/** Load the declared cast and its authored LODs before synchronous placement. */
export async function loadLion(look: NdLook): Promise<void> {
  const geometry = await loadCast('lion'); look.geo.set('lion', geometry);
  await loadCastLods(look.geo, 'lion', geometry, [10, 30]);
}
