/**
 * The Well's balustrade (E281; E346): the heavy stone balustrade along Lantern Square's and its street's edge over the
 * Yamen Well — a plinth, chunky posts under square cap slabs, the panel wall, a top rail (../world/squareParts.ts
 * `balustrade`, its two runs `WELL_RUNS`). It is placed once, drawn into the square cluster's kit (one merged mesh, the
 * neon spill baked in), so it costs no draw of its own; the world records the copy where it stands and build.ts
 * registers it there (`place` with `drawnInto`). Its carved panel faces, its lotus-bud finials and its guardian lions
 * are models of their own. Built here alone for the Model Explorer: its own space is the corner where the square's run
 * meets the street's (the square's west edge on x = 0, the runs along z, its foot on y = 0).
 *
 * It owns the fragment's edge over the Well (it was the world piece `nds-edges`, world/colliders.ts): ONE stone box the
 * length of both runs, 1.12 m up (a single box, so the walk along it has no seam: splitting it per bay would change the
 * collider), and over it the invisible parapet to PARAPET m, above any jump — except over the Well's south rim ledge,
 * where a hop over the stone lands on the rim, and from GUARD_Z0 to the rim, where the grapple guard stands instead
 * (a kinematic piece that opens for one committed Fei Zhua crossing: world/colliders.ts `fragmentGrappleGuard`).
 */
import { defineModel } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { PLAZA, WELL, Y0 } from '../layout';
import { Kit } from '../world/kit';
import { WELL_BALUSTRADE_AT, WELL_RUNS, balustrade } from '../world/squareParts';
import { RIM } from '../world/wellBounds';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/wellBalustrade.ts';

/** the invisible parapets over the Well reach this high above the floor (out of reach of every jump, on foot or board) */
export const PARAPET = 12;
/** where the square's invisible parapet over the Well joins the grapple guard (E286: the rim → square crossing to the
 *  (−3.2, −13) mast's hook comes in over the balustrade at z ≈ −12) */
export const GUARD_Z0 = -18;

const O = WELL_BALUSTRADE_AT;
/** a box from world extents (min / max corners), in the balustrade's own space */
function span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): ColliderDesc {
  const a = { x: x0 - O.x, y: y0 - O.y, z: z0 - O.z }, b = { x: x1 - O.x, y: y1 - O.y, z: z1 - O.z };
  return { kind: 'box', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, hx: Math.abs(b.x - a.x) / 2, hy: Math.abs(b.y - a.y) / 2, hz: Math.abs(b.z - a.z) / 2, surface: 'stone' };
}

/**
 * Its collision (the extents as the fragment's plan gives them, world/colliders.ts before E346): the stone the length of
 * both runs, x −0.1 … 0.5 (the runs' plinths stand in it), and the parapet over it on the square's and the street's
 * edge, north of the grapple guard and south of the rim ledge
 */
export const WELL_BALUSTRADE_COLLIDERS: readonly ColliderDesc[] = [
  span(PLAZA.x0 - 0.1, Y0, WELL.z0, PLAZA.x0 + 0.5, Y0 + 1.12, PLAZA.z1 + 0.6),
  span(PLAZA.x0 - 0.1, Y0 + 1.12, WELL.z0, PLAZA.x0 + 0.1, Y0 + PARAPET, GUARD_Z0),
  span(PLAZA.x0 - 0.1, Y0 + 1.12, RIM.z1, PLAZA.x0 + 0.1, Y0 + PARAPET, PLAZA.z1 + 0.6),
];

export const wellBalustrade = defineModel({
  id: 'nine-dragon-stack/well-balustrade', name: 'The Well\'s balustrade', category: 'buildings', pipeline: 'code', file: FILE, defaults: {}, surface: 'stone',
  build: (ctx) => [{
    geometry: ctx.once('nds:well-balustrade', () => {
      const k = new Kit();
      for (const r of WELL_RUNS) balustrade(k, r.at - O.x, r.a0 - O.z, r.a1 - O.z, 0, false, false, undefined, undefined, false);
      return k.build();
    }),
    material: need(ndLook(ctx).mat, 'the Jiehua program'),
  }],
  colliders: () => WELL_BALUSTRADE_COLLIDERS,
});
