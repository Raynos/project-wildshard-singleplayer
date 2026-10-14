/**
 * Pine Hollow's running water (PINE-HOLLOW-REMASTER PH-L9): the creek from the beaver dam to the slab's south edge, the
 * waterfall off the Ridge into the pond, the plunge-pool foam where it lands and a spray of mist at the foot.
 *
 *   const streams = await new PineStreams(sky).build();   // Pine Hollow only (its bake: ../generators/streams.ts)
 *   scene.add(streams.group);                        // nothing to update: it all runs on wind.ts's clock
 *
 * Two draws, no extra render pass, no per-frame CPU:
 *   · `water`: one mesh for the creek ribbon, the waterfall sheet and the plunge ring, in the pond's photoreal water
 *     (waterSurface.ts — the same program: the clock's sky, Fresnel, depth tint, flow-scrolled ripples, foam, the wet line
 *     on the banks). The creek follows the layout's polyline and `creekSurfaceAt` (the bed + 0.45 m, a thin sheet over the
 *     dam's crest), its uv.y is travel time so the ripples ride the flow and stretch where it is fast; the dam's face is
 *     white (`creekFoamAt`). The waterfall is a curved sheet down the Ridge's face (standing off the rock where it is
 *     steep, bulged at its middle), quickening with the drop, white all the way, ending on the pond's surface in a foam
 *     ring that spreads outward.
 *   · `spray`: a few soft puffs (their graph, ../data/streamLook.ts) rising and fading at the foot of the fall's face and
 *     where it hits the pond, tinted by the fog / sun colours so they follow the clock.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import streamJson from '../data/streams.json' with { type: 'json' };
import { SPRAY_ANCHORS, SPRAY_LOOK } from '../data/streamLook';
import { pineLook } from '../runtime/looks/graphLooks';
import { loadSiteTimbers } from './timberSites';
import { pineModels } from './context';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createWaterMaterial } from '@wildshard/engine/world/waterSurface';

const num = v.pipe(v.number(), v.finite()), xyz = v.tuple([num, num, num]);
/** ../data/streams.json: the water mesh's counts and index width, the fall's plunge and face-foot anchors */
const StreamRows = v.strictObject({ bin: v.string(), bytes: num, vertices: num, indices: num, wide: v.boolean(), plunge: xyz, faceFoot: xyz });
/** the bake's rows, parsed strictly once */
export const STREAM_ROWS = v.parse(StreamRows, streamJson);

export class PineStreams {
  readonly group = new THREE.Group();
  /** the creek, the waterfall sheet and the plunge ring (one draw; null when its bake did not load) */
  water: THREE.Mesh | null = null;
  /** the mist puffs at the fall's foot and where it meets the pond (one draw) */
  spray!: THREE.InstancedMesh;
  /** where the fall's sheet meets the pond, and the foot of its steep face (the spray's anchors, the sound's) */
  readonly plunge = new THREE.Vector3(...STREAM_ROWS.plunge);
  readonly faceFoot = new THREE.Vector3(...STREAM_ROWS.faceFoot);

  constructor(private sky: Sky) {}

  /** the water from its bake (a bake that fails to load is a page fault, `console.error`: the spray stands alone), the spray */
  async build(): Promise<this> {
    const geometry = await loadSiteTimbers(pineModels(this.sky)).then(views => {
      const original = views.get('pine-streams')?.geometry;
      if (original === undefined) throw new Error('[streams] original water draw missing from admitted world');
      return original;
    }).catch((error: unknown) => { console.error('[pine-hollow] the baked streams did not load:', error); return null; });
    if (geometry !== null) {
      // the gully's banks and the forest over them fill the low reflections (sin 0.3 ≈ 17°)
      const { material } = createWaterMaterial(this.sky, { skyline: null, forestSinEl: 0.3 });
      const water = this.water = new THREE.Mesh(geometry, material);
      water.name = 'creek-waterfall';
      water.receiveShadow = true;
      water.renderOrder = 6; // after the pond: the plunge ring lies on it
      this.group.add(water);
    }
    this.spray = this.buildSpray();
    this.group.add(this.spray);
    return this;
  }

  /** mist puffs: each rises and swells over its own few-second cycle, drifting downwind (posed by its graph, ../data/streamLook.ts) */
  private buildSpray(): THREE.InstancedMesh {
    const anchors: { p: THREE.Vector3; n: number; size: number; rise: number }[] = [
      { p: this.faceFoot, ...SPRAY_ANCHORS.faceFoot },
      { p: new THREE.Vector3(this.plunge.x, this.plunge.y + SPRAY_ANCHORS.plunge.lift, this.plunge.z), ...SPRAY_ANCHORS.plunge },
    ];
    const total = anchors.reduce((a, x) => a + x.n, 0);
    const geo = new THREE.PlaneGeometry(1, 1);
    const seed = new Float32Array(total * 4), size = new Float32Array(total * 3), m = new THREE.Matrix4();
    const mesh = new THREE.InstancedMesh(geo, pineLook(SPRAY_LOOK), total);
    let i = 0;
    for (const a of anchors) for (let k = 0; k < a.n; k++, i++) {
      const j = (i * 0.618034) % 1;
      size.set([a.size * (0.8 + 0.4 * j), a.size * (0.8 + 0.4 * ((j * 7.3) % 1)), a.rise], i * 3);
      mesh.setMatrixAt(i, m.makeTranslation(a.p.x + Math.cos(i * 2.4) * 1.2, a.p.y, a.p.z + Math.sin(i * 2.4) * 1.2));
      seed[i * 4] = j; seed[i * 4 + 1] = 2.6 + 1.6 * ((j * 3.7) % 1); seed[i * 4 + 2] = (j * 5.1) % 1 - 0.5; seed[i * 4 + 3] = 0.8 + 0.4 * ((j * 11.3) % 1);
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
    mesh.renderOrder = 7;
    mesh.name = 'waterfall-spray';
    mesh.frustumCulled = false; // the puffs are posed in the vertex stage, metres off their anchors
    return mesh;
  }
}
