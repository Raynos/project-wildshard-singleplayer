/**
 * The square's market sets (E281 round 2; E306 / E315 M4): the market booth, the parasol table and the dining pavilion —
 * each a Kit + KitX geometry in its own frame (../world/stalls.ts builds them: front on z = 0 facing +z / the table at
 * the origin), drawn by the Jiehua program as ONE InstancedMesh per set, culled per copy by the fragment's culler. What a
 * copy cannot vary — its lanterns, signs, glow, steam, diners and customers — the market row places beside it.
 *
 * The booth's cook draws from the market row's rng stream, at the first booth (so the square's other draws keep their
 * order): the square builds it there and hands the geometry over (../world/props3d.ts `placeSet`); a booth built for
 * any other reason (a tool, a test) seeds its own stream.
 */
import type { BufferGeometry } from 'three';
import { defineModel, type ModelContext, type ModelPart } from '../../../models/model';
import { boothSet, parasolSet, pavilionSet } from '../world/stalls';
import { ndLook, need } from '../world/modelLook';
import { Rng } from '../util';

const FILE = 'src/chunks/nine-dragon-stack/models/market.ts';

/** the set's geometry as the square built it (`set:<name>` in the look), else built here once */
function set(ctx: ModelContext, name: string, make: () => BufferGeometry): readonly ModelPart[] {
  const look = ndLook(ctx);
  return [{ geometry: look.geo.get(`set:${name}`) ?? ctx.once(`nds:set:${name}`, make), material: need(look.mat, 'the Jiehua program') }];
}

export const marketBooth = defineModel({
  id: 'nine-dragon-stack/market-booth', name: 'Market booth (roast ducks, steamers, a cook)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'booth', () => boothSet(new Rng(4101))),
});

export const parasolTable = defineModel({
  id: 'nine-dragon-stack/parasol-table', name: 'Parasol table', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'parasol', parasolSet),
});

export const diningPavilion = defineModel({
  id: 'nine-dragon-stack/dining-pavilion', name: 'Dining pavilion (hot pot)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => set(ctx, 'pavilion', pavilionSet),
});
