/**
 * Lantern Square's two food stalls (大牌檔; dome B, E169; E306 / E315 second pass): the noodle stall at the banyan's foot
 * and the hawker stall at the spawn's right. Each is drawn into the square cluster's kit ('paifang': one merged mesh,
 * the neon spill baked in), so it costs no draw of its own; its builder (../world/stalls.ts) records where it stands —
 * its footprint's centre — and build.ts registers it there (`place` with `drawnInto`, ../world/inKit.ts). Built here in
 * its own space (the footprint centred on the origin, the counter facing +z) for the Model Explorer:
 *  - the noodle stall: a green steel frame under an oxblood canvas roof, the striped scalloped awning, the lit back wall
 *    with its menu strips and jars, three stockpots and a wok on a glowing burner, the counter crowded with bowls, roast
 *    ducks on a rail, bulbs, bar stools and two folding tables, gas bottles and crates, its two cooks;
 *  - the hawker stall: the compact one facing the spawn — a stockpot and a wok, ladles and strainers, roast ducks in
 *    the open west end, a cook, three stools, a blue tarp and stacked crates at its back.
 * Their signs (the 麵 banners, the menu strips, the name board and its neon), lanterns, steam and customers are the sign,
 * paper-lantern and crowd copies placed beside them. Each collides as a box of its footprint.
 */
import { HAWKER, STALL } from '../layout';
import { Ctx } from '../world/ctx';
import { merge } from '../world/hero/kitx';
import { NoSigns, ndLook, need } from '../world/modelLook';
import { type StallRect, centred, hawkerStall, noodleStall } from '../world/stalls';
import { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

const FILE = 'src/shards/nine-dragon-stack/models/stalls.ts';

/** a stall built alone at the origin (its own throwaway build context: the signs, lanterns and sitters go nowhere) */
function stall(ctx: ModelContext, key: string, draw: (c: Ctx) => void): readonly ModelPart[] {
  const look = ndLook(ctx);
  const geometry = ctx.once(`nds:stall:${key}`, () => {
    const c = new Ctx(new NoSigns(need(look.neon, 'the sign atlas').atlas));
    draw(c);
    const k = c.kits.get('paifang'), x = c.kitxs.get('paifang');
    if (k === undefined || x === undefined) throw new Error(`nine-dragon: the ${key} stall drew nothing`);
    return merge([k.build(), x.build()]);
  });
  return [{ geometry, material: need(look.mat, 'the Jiehua program') }];
}

/** a box from `y` 0 to `h` over a footprint in own space (x0 … x1, z0 … z1) */
function footprint(r: StallRect, h: number, front = 0): ColliderDesc {
  return { kind: 'box', x: (r.x0 + r.x1) / 2, y: h / 2, z: (r.z0 + r.z1 + front) / 2, hx: Math.abs(r.x1 - r.x0) / 2, hy: h / 2, hz: Math.abs(r.z1 + front - r.z0) / 2, surface: 'wood' };
}

const NOODLE = centred(STALL), HAWK = centred(HAWKER);

export const noodleStallModel = defineModel({
  id: 'nine-dragon-stack/noodle-stall', name: 'Noodle stall (大牌檔)', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => stall(ctx, 'noodle', (c) => { noodleStall(c, new Rng(301), NOODLE, 0); }),
  specimenYaw: Math.PI, // (the Explorer's camera looks down +z: turned, its counter faces it)
  // the frame, the counter and the stools in front: 3.2 m up, 0.6 m past the counter
  colliders: () => [footprint(NOODLE, 3.2, 0.6)],
});

export const hawkerStallModel = defineModel({
  id: 'nine-dragon-stack/hawker-stall', name: 'Hawker stall', category: 'buildings', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => stall(ctx, 'hawker', (c) => { hawkerStall(c, new Rng(302), HAWK, 0); }),
  specimenYaw: Math.PI,
  colliders: () => [footprint(HAWK, 2.4)],
});
