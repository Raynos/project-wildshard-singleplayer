/**
 * Pine Hollow's running water (PINE-HOLLOW-REMASTER PH-L9): the creek from the beaver dam to the slab's south edge, the
 * waterfall off the Ridge into the pond, the plunge-pool foam where it lands and a spray of mist at the foot.
 *
 *   const streams = await new PineStreams(sky).build();   // Pine Hollow only (its bake: ../generators/streams.ts)
 *   scene.add(streams.group);                        // nothing to update: it all runs on wind.ts's clock
 *
 * Two draws, no extra render pass, no per-frame CPU:
 *   · `water`: one mesh for the creek ribbon, the waterfall sheet and the plunge ring, in the pond's photoreal water
 *     (../data/waterLook.ts — the creek look: the clock's sky, Fresnel, depth tint, flow-scrolled ripples, foam, the wet line
 *     on the banks). The creek follows the layout's polyline and `creekSurfaceAt` (the bed + 0.45 m, a thin sheet over the
 *     dam's crest), its uv.y is travel time so the ripples ride the flow and stretch where it is fast; the dam's face is
 *     white (`creekFoamAt`). The waterfall is a curved sheet down the Ridge's face (standing off the rock where it is
 *     steep, bulged at its middle), quickening with the drop, white all the way, ending on the pond's surface in a foam
 *     ring that spreads outward.
 *   · `spray`: a few soft puffs (their graph, ../data/streamLook.ts) rising and fading at the foot of the fall's face and
 *     where it hits the pond, tinted by the fog / sun colours so they follow the clock.
 */
import * as THREE from 'three';
import { SPRAY_LOOK, SPRAY_PUFFS as SPRAY } from '../const';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import { loadSiteTimbers } from './timberSites';
import { pineModels } from './context';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineWaterSurface } from '../../world/water';

/** the most mist puffs the waterfall draws (../data/sprayPuffs.json bakes 11) */
const MAX_SPRAY = 64;

export class PineStreams {
  readonly group = new THREE.Group();
  /** the creek, the waterfall sheet and the plunge ring (one draw; null when its bake did not load) */
  water: THREE.Mesh | null = null;
  /** the mist puffs at the fall's foot and where it meets the pond (one draw) */
  spray!: THREE.InstancedMesh;

  constructor(private sky: Sky) {}

  /** the water from its bake (a bake that fails to load is a page fault, `console.error`: the spray stands alone), the spray */
  async build(): Promise<this> {
    const geometry = await loadSiteTimbers(pineModels(this.sky)).then(views => {
      const original = views.get('pine-streams')?.geometry;
      if (original === undefined) throw new Error('[streams] original water draw missing from admitted world');
      return original;
    }).catch((error: unknown) => { console.error('[pine-hollow] the baked streams did not load:', error); return null; });
    // the creek's water look (../data/waterLook.ts): drawn after the pond, so the plunge ring lies on it
    if (geometry !== null) this.group.add(this.water = pineWaterSurface('creek', geometry));
    this.spray = this.buildSpray();
    this.group.add(this.spray);
    return this;
  }

  /** mist puffs: each rises and swells over its own few-second cycle, drifting downwind (posed by its graph, ../data/streamLook.ts;
   *  their origins and seeds baked offline, ../generators/sprayPuffs.ts) */
  private buildSpray(): THREE.InstancedMesh {
    const total = SPRAY.at.length / 3, geo = new THREE.PlaneGeometry(1, 1), m = new THREE.Matrix4();
    const mesh = new THREE.InstancedMesh(geo, lentLook(SPRAY_LOOK), total);
    if (total > MAX_SPRAY) throw new Error('[streams] more spray puffs than the waterfall draws');
    for (let i = 0; i < Math.min(total, MAX_SPRAY); i++) mesh.setMatrixAt(i, m.makeTranslation(SPRAY.at[i * 3] ?? 0, SPRAY.at[i * 3 + 1] ?? 0, SPRAY.at[i * 3 + 2] ?? 0));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(SPRAY.seed), 4));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(Float32Array.from(SPRAY.size), 3));
    mesh.renderOrder = 7;
    mesh.name = 'waterfall-spray';
    mesh.frustumCulled = false; // the puffs are posed in the vertex stage, metres off their anchors
    return mesh;
  }
}
