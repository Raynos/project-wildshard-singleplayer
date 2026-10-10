/**
 * The Well galleries' own wall kit (E306 / E315 M4), older than the facade grammar's: pieces built once at the origin in
 * a wall's frame (local +z out of the wall, y up) by the Jiehua kit program, placed per region (`piece@region`: the town,
 * the Well, the deep Well, so a region's copies cull as one) as one InstancedMesh each:
 *  - the potted plant on the galleries' sills and railings (../generators/dressing.ts `PIECES.plant`: a terracotta pot, two
 *    leaf masses; the copy's scale sizes it);
 *  - the split air-con box backed against a gallery wall (../generators/props.ts `acKit`).
 * (dressing.ts's other pieces are only placed by facades.ts `buildWall`, which nothing calls: they are not models until
 * something places them.)
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { ndLook, need, specimen } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/wallKit.ts';

const parts = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];

export const galleryPlant = defineModel({
  id: 'nine-dragon-stack/gallery-plant', name: 'Potted plant (gallery)', category: 'nature', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => parts(ctx, specimen(ctx, 'kit:plant')),
});

export const airConBox = defineModel({
  id: 'nine-dragon-stack/air-con-box', name: 'Air-con box (gallery wall)', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => parts(ctx, specimen(ctx, 'kit:ac')),
});
