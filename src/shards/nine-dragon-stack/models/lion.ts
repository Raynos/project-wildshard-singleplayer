/**
 * The guardian lion (石獅; dome B, E169; E306 / E315 M4): a TRELLIS.2 cast from the organic lab
 * (public/assets/nine-dragon/lab/organic/lion.glb, ~8 k triangles, 0.62 m tall on its post), loaded through glb.ts —
 * smooth normals, the baked AO, colour-RAMPED to the balustrade's wet granite — and drawn by the Jiehua program as one
 * InstancedMesh over every post that carries one (../world/props3d.ts places them; the Well rim queues its own). E283's
 * distance LODs: meshoptimizer copies from 10 m and 30 m whose surface stays under SCULPT_PX of a pixel where they start.
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelLod, type ModelPart } from '@wildshard/engine/models/model';
import { loadGlb } from '../world/hero/glb';
import { K } from '../world/kit';
import { PX_PER_M, simplifiedCopy } from '@wildshard/sdk/cull/meshLod';
import { SCULPT_PX } from '../data/lod';
import { type NdLook, ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/lion.ts';

/** the wet granite of the balustrade, dark to light (the lab's ramp) */
const STONE_RAMP = [0x2f2f33, 0x45454a, 0x5b5b60, 0x6e6e73, 0x808086, 0x94949a];

/** load the cast into the look (the fragment awaits it before placing: `place` is synchronous) */
export async function loadLion(look: NdLook): Promise<void> {
  look.geo.set('lion', await loadGlb('/assets/nine-dragon/lab/organic/lion.glb', { kind: K.stone, line: 0, ao: 0.85, ramp: STONE_RAMP, hues: {} }));
}

const cast = (ctx: ModelContext): BufferGeometry => need(ndLook(ctx).geo.get('lion'), 'the lion cast');
const parts = (ctx: ModelContext, geometry: BufferGeometry): readonly ModelPart[] => [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];

/** a meshoptimizer copy from `d` m (placed at scale 1); the cast itself when the simplifier could not load */
const sculptLod = (d: number): ModelLod<object> => ({
  from: d,
  build: (ctx) => parts(ctx, ctx.once(`nds:lion:lod${d}`, () => (ndLook(ctx).canLod ? simplifiedCopy(cast(ctx), d * PX_PER_M * SCULPT_PX) : cast(ctx)))),
});

export const guardianLion = defineModel({
  id: 'nine-dragon-stack/guardian-lion', name: 'Guardian lion', category: 'props', pipeline: 'trellis', file: FILE, defaults: {},
  build: (ctx) => parts(ctx, cast(ctx)),
  lods: [sculptLod(10), sculptLod(30)],
});
