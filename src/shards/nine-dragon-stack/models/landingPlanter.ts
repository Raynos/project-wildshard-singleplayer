/**
 * The landing planter (dome C2; E306 / E315 second pass): a stone trough in flower against a stair-street landing's wall
 * — ashlar under a coping, three leafy bushes, a spray of one flower's colour (../world/landingPlanter.ts
 * `landingPlanter`). Eight stand on the landings, drawn into the terraces' kit (one merged mesh, the neon spill baked in),
 * so a planter costs no draw of its own; the world records where each stands and build.ts registers them there (`place`
 * with `drawnInto`). It is what the stair's walkers bump into: a box of its trough. Built here alone, its foot on the
 * origin, for the Model Explorer, its flowers from a stream of its own.
 */
import { Kit } from '../world/kit';
import { PLANTER, landingPlanter } from '../world/landingPlanter';
import { ndLook, need } from '../world/modelLook';
import { Rng } from '@wildshard/engine/core/rng';
import { defineModel } from '@wildshard/engine/models/model';

const FILE = 'src/shards/nine-dragon-stack/models/landingPlanter.ts';

export const landingPlanterModel = defineModel({
  id: 'nine-dragon-stack/landing-planter', name: 'Stone planter in flower', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{
    geometry: ctx.once('nds:landing-planter', () => { const k = new Kit(); landingPlanter(k, new Rng(23), { x: 0, y: 0, z: 0, ...PLANTER }); return k.build(); }),
    material: need(ndLook(ctx).mat, 'the Jiehua program'),
  }],
  colliders: () => [{ kind: 'box', x: 0, y: 0.29, z: 0, hx: PLANTER.w / 2 + 0.04, hy: 0.29, hz: PLANTER.d / 2 + 0.04, surface: 'stone' }],
});
