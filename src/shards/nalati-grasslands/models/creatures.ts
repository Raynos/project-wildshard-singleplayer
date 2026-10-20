/**
 * Nalati Grasslands' creatures (E306 / E315 M5). The species on the rigs (src/engine/entities/species/) wear the shard's
 * generated hulls when Debug ▸ Creatures = Models (the default): a TRELLIS.2 or Hunyuan3D-2 mesh baked onto the species'
 * code skeleton (scripts/nalati-rig-bake.mjs, src/engine/entities/glbCreatures.ts HULL), painterly; the code mesh stands in
 * until a hull loads. The island's systems spawn and drive every copy, never placed:
 *   src/engine/entities/Wildlife.ts   the horse herd on the plains, the camp horses at the rail, the wolf pack, the collie, the
 *                              sheep flock (one instanced draw) and the marmot colonies (one instanced draw)
 *   src/shards/nalati-grasslands/elites.ts       the named elites: Aqbars, Kokbori (and her pack), Qyran, Qara Batyr, Argymaq
 *   src/shards/nalati-grasslands/ghostRiders.ts  the night's ghost riders;  src/shards/nalati-grasslands/balbalWarriors.ts  the dusk's balbal warriors
 *   src/shards/nalati-grasslands/kurganBoss.ts   the Golden King (and his balbal adds);  src/shards/nalati-grasslands/stormTitan.ts  Jel Ata, the Storm Titan
 *   src/shards/nalati-grasslands/sheepRaid.ts    the raiding pack and the shepherd's horse;  src/shards/nalati-grasslands/ride/Taming.ts  Tulpar, your horse
 * The flock, the marmots and the Titan are not on the species rigs: each card is its own builder's one copy, in its own
 * space.
 */
import * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { CrowdBody as FlockBody } from '@wildshard/game/ambient/crowdDraw';
import { createNativeFlocks, readFlockBody } from '../runtime/flockDeclared';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { productRiggedHulls } from '@wildshard/sdk/looks/riggedHulls';
import { titanCloud, titanPose } from '../combat/stormTitan';

const FILE = 'src/shards/nalati-grasslands/models/creatures.ts';

// Argymaq's kind is registered by the elite as he spawns (src/shards/nalati-grasslands/elites.ts); the roster lists him from boot

/** the flock's seed for the card's sheep: its first draws make a cream sheep standing, head up */
const SHEEP_SEED = 3;
let sheepBody: FlockBody | null = null;

/**
 * the fat-tailed sheep: one of the camp's flock (src/engine/entities/Flock.ts — ~40 as ONE InstancedMesh, legs, head and the
 * death roll posed in its vertex shader; the TRELLIS.2 sheep baked onto the flock's parts, the code sheep until it loads).
 * The card is a flock of one, moved to its own origin
 */
export const sheep: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/sheep', name: 'Fat-tailed sheep', category: 'creatures', pipeline: ['trellis', 'code'], file: FILE, surface: 'flesh',
  defaults: {},
  prepare: async () => { sheepBody ??= await readFlockBody(await loadFirstPartyProduct('nalati-grasslands')); },
  build: (ctx) => {
    if (sheepBody === null) throw new Error('Sheep model requires its prepared body');
    const options = { x: 0, z: 0, count: 1, seed: SHEEP_SEED };
    const flock = createNativeFlocks(ctx.sky, SHEEP_SEED, sheepBody, 'specimen');
    const mesh = flock.factory(options, 0).mesh;
    mesh.setMatrixAt(0, new THREE.Matrix4());   // the flock stood it on the terrain near (0, 0): its own space instead
    mesh.instanceMatrix.needsUpdate = true;
    const fit = (): void => { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); };
    fit();
    {
      // the flock swaps in the generated sheep when its rig lands (the same cached load): refit, and show it
      productRiggedHulls('nalati-grasslands').load('sheep').then(() => {
        fit();
        if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: 'nalati-grasslands/sheep' } }));
        return null;
      }).catch((cause: unknown) => { throw new Error('Nalati sheep specimen rig failed', { cause }); });
    }
    return mesh;
  },
});

/**
 * Jel Ata, the Storm Titan (combat/stormTitan.ts `titanCloud`): the second boss, a ~110 m giant of ~340 churning cloud
 * puffs (and their buds) on seven code bones, one InstancedMesh, the lightning heart and eyes; the fight stands him in the
 * cloud sea beyond the south rim. The card is his body risen and at rest, his waist over the origin, the foot of his cloud
 * skirt on y = 0
 */
export const stormTitan: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/storm-titan', name: 'Jel Ata, the Storm Titan', category: 'creatures', pipeline: 'code', file: FILE,
  defaults: {},
  build: () => {
    const scratch = new THREE.Scene();   // the body adds its parts to the scene it is given
    const pose = titanPose(); pose.rise = 1;
    const body = titanCloud(scratch, pose);
    body.setVisible(true);
    body.update(0, new THREE.PerspectiveCamera());
    const own = new THREE.Group();
    for (const o of scratch.children.slice()) own.add(o);   // (a copy: add() moves each out of the list)
    body.puffs.computeBoundingBox();
    const root = body.part('root'), low = body.puffs.boundingBox?.min.y ?? root.position.y;
    own.position.set(-root.position.x, -low, -root.position.z);
    // his cloud lights the heart's glow from the heart's world position: keep it on the specimen's heart, wherever it stands
    body.puffs.onBeforeRender = (): void => { body.focusWorld(body.focusPoint); body.syncLook(); };
    const g = new THREE.Group();
    g.name = 'storm-titan';
    g.add(own);
    return g;
  },
});
