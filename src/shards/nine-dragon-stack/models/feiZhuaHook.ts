/**
 * The Fei Zhua dragon hook (E306 / E315 M4): the lab's cast-brass dragon (public/assets/nine-dragon/lab/grapple/
 * dragon-hook.glb, a TRELLIS.2 sculpt, ~18 k triangles) hung over the procedural brass brackets of the three Well hooks
 * nearest the square (the brackets and their collision-free ring anchors are the world's; the grapple aims at the ring).
 * In the cast's own space as the file has it, its node's transform baked in; a placement puts its ring (FEI_ZHUA_RING)
 * on the mount's ring at FEI_ZHUA_SCALE. One instanced draw, E283's meshoptimizer copies from 15 m and 40 m. Its back
 * is the flat wall plate, so the Model Explorer turns it round to face the first view (E289).
 */
import { specimens } from '../boot/metadata.generated.json' with { type: 'json' };
import { type BufferGeometry, Box3, Sphere, Vector3, type Material, Matrix4 } from 'three';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { defineModel, type ModelContext, type ModelLod, type ModelPart } from '@wildshard/engine/models/model';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { loadCastLods } from '../world/casts';
import { type NdLook, ndLook, need } from '../world/modelLook';

const rows = specimens.hook;

/** the cast's scale on a Well hook */
export const FEI_ZHUA_SCALE = rows.scale;
/** the ring the claw bites, in the cast's own space */
const RING = rows.ring;

/** a copy hung on a mount: its ring on the mount's ring, turned to face out from the wall along `out` */
export function feiZhuaAt(ring: Vector3, out: Vector3): Matrix4 {
  return new Matrix4().makeTranslation(ring.x, ring.y, ring.z)
    .multiply(new Matrix4().makeRotationY(Math.atan2(out.x, out.z)))
    .multiply(new Matrix4().makeScale(FEI_ZHUA_SCALE, FEI_ZHUA_SCALE, FEI_ZHUA_SCALE))
    .multiply(new Matrix4().makeTranslation(-RING.x, -RING.y, -RING.z));
}

/**
 * Load the cast into the look: its first mesh's geometry with the node's matrix baked in and its brass (from the file's
 * own material, warmed). The cast is quantized (KHR_mesh_quantization: int16-normalised position / normal / tangent,
 * the node's matrix restoring the scale); baking the matrix into int16 storage clamped every coordinate to ±1 and
 * flattened the dragon into a card (E289), so the transformed attributes are widened to float first.
 */
export async function loadFeiZhuaHook(look: NdLook, scenes: SceneHandles): Promise<void> {
  await scenes.assemble('casts');
  const geo = scenes.geometry('casts.dragon-hook');
  geo.boundingBox = new Box3(new Vector3().fromArray(rows.bounds.box.min), new Vector3().fromArray(rows.bounds.box.max));
  geo.boundingSphere = new Sphere(new Vector3().fromArray(rows.bounds.sphere.center), rows.bounds.sphere.radius);
  const mat = scenes.standard('casts.hook-brass');
  // (E264) the sculpt's decoded maps (two 1024² bitmaps, 4 MB each) are on the GPU after the first draw
  for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.emissiveMap]) if (t !== null) gpuOnlyTexture(t, 'the Fei Zhua sculpt maps (GPU only)');
  look.geo.set('dragon-hook', geo);
  loadCastLods(look.geo, 'dragon-hook', geo, rows.lods, scenes);
  look.hookMat = mat;
}

const cast = (ctx: ModelContext): BufferGeometry => need(ndLook(ctx).geo.get('dragon-hook'), 'the Fei Zhua cast');
const brass = (ctx: ModelContext): Material => need(ndLook(ctx).hookMat, 'the Fei Zhua brass');
const parts = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: brass(ctx) }];

/** a meshoptimizer copy from `d` m, its error measured at the cast's placed scale; loaded from the admitted author output */
const sculptLod = (d: number): ModelLod<object> => ({
  from: d,
  build: (ctx) => parts(ctx, need(ndLook(ctx).geo.get(`dragon-hook:mid${d}`), 'the prepared hook LOD')),
});

export const feiZhuaHook = defineModel({
  ...rows.model, category: 'props', pipeline: 'trellis',
  build: (ctx) => parts(ctx, cast(ctx)),
  lods: rows.lods.map(sculptLod),
  specimenYaw: rows.specimenYaw,
});
