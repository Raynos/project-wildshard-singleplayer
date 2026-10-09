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
import { creature, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { LEOPARD } from '../species/leopard';
import { KOKBORI } from '../species/kokbori';
import { EAGLE } from '../species/eagle';
import { GHOST_RIDER } from '../species/ghostRider';
import { BALBAL } from '../species/balbal';
import { GOLDEN_KING } from '../species/goldenKing';
import { ARGYMAQ, registerArgymaq } from '../combat/elites';
import { Flock } from '../creatures/flock';
import { loadCreatureRig } from '../species/hulls';
import { modelsOn } from '../world/glbPaint';
import { buildMarmotGeometry } from '../creatures/marmots';
import { painterlyAnimalMaterial } from '../look/creatureMaterial';
import { TitanBody } from '../combat/stormTitan';

const FILE = 'src/shards/nalati-grasslands/models/creatures.ts';

// Argymaq's kind is registered by the elite as he spawns (src/shards/nalati-grasslands/elites.ts); the roster lists him from boot
registerArgymaq();

/** the steppe horse: the plains herd's mares, foals and stallion (the Hunyuan3D-2 wild horse), the camp's saddled horses,
 *  the shepherd's and Tulpar, your horse (the saddled one) — one rig, every coat */
export const horse: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/horse', file: FILE, pipeline: ['hunyuan', 'code'], ...creature('horse', { name: 'Steppe horse' }) });

/** Argymaq the Unbroken: the feral black stallion of the Crags' high pasture (the horse's rig at ×1.3), once */
export const argymaq: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/argymaq', file: FILE, pipeline: ['hunyuan', 'code'], ...creature(ARGYMAQ, { name: 'Argymaq the Unbroken' }) });

/** the steppe wolf (TRELLIS.2 hull): the pack under Kokbori's den, her own pack, the raiders of the flock; Greymane leads */
export const wolf: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/wolf', file: FILE, pipeline: ['trellis', 'code'], ...creature('wolf') });

/** the camp's sheepdog: a collie (its own Hunyuan3D-2 hull) on the canid rig, herding the flock */
export const sheepdog: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/sheepdog', file: FILE, pipeline: ['hunyuan', 'code'], ...creature('sheepdog') });

/** Aqbars the Pale, the snow leopard of the Crags (TRELLIS.2 hull, re-generated for the rig) */
export const aqbars: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/aqbars', file: FILE, pipeline: ['trellis', 'code'], ...creature(LEOPARD, { name: 'Aqbars the Pale' }) });

/** Kokbori, Mother of the Pack: the giant sky-grey she-wolf (the wolf's hull at ×2.6), dusk and night */
export const kokbori: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/kokbori', file: FILE, pipeline: ['trellis', 'code'], ...creature(KOKBORI, { name: 'Kokbori, Mother of the Pack' }) });

/** Qyran the Storm-Wing: the giant golden eagle over Eagle Rock in a storm (TRELLIS.2 hull, wings spread) */
export const qyran: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/qyran', file: FILE, pipeline: ['trellis', 'code'], ...creature(EAGLE, { name: 'Qyran the Storm-Wing' }) });

/** the ghost riders' spectral war horse (Hunyuan3D-2 hull; ghostRiders.ts lays its ghost material and a rider over it),
 *  and Qara Batyr the Unburied, their captain */
export const ghostRider: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/ghost-rider', file: FILE, pipeline: ['hunyuan', 'code'], ...creature(GHOST_RIDER) });

/** the balbal warrior (lofted in code): a statue of the ring or a kurgan crown awake at dusk, and the Golden King's adds
 *  (kurganBalbal.ts's KURGAN_BALBAL is this species). The sleeping statue is ./balbal.ts */
export const balbalWarrior: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/balbal-warrior', file: FILE, pipeline: 'code', ...creature(BALBAL, { name: 'Balbal warrior' }), surface: 'stone' });

/** the Golden King, the great kurgan's boss: a Hunyuan3D-2 figure (NALATI-MERGE D1, art/nalati-grasslands/round-10-models-merge/)
 *  on his humanoid code rig (src/engine/entities/humanoidRigBake.ts), the crown and the cloak on their own bones */
export const goldenKing: ModelDef<CreatureParams> = defineModel<CreatureParams>({ id: 'nalati-grasslands/golden-king', file: FILE, pipeline: ['hunyuan', 'code'], ...creature(GOLDEN_KING) });

/** the flock's seed for the card's sheep: its first draws make a cream sheep standing, head up */
const SHEEP_SEED = 3;

/**
 * the fat-tailed sheep: one of the camp's flock (src/engine/entities/Flock.ts — ~40 as ONE InstancedMesh, legs, head and the
 * death roll posed in its vertex shader; the TRELLIS.2 sheep baked onto the flock's parts, the code sheep until it loads).
 * The card is a flock of one, moved to its own origin
 */
export const sheep: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/sheep', name: 'Fat-tailed sheep', category: 'creatures', pipeline: ['trellis', 'code'], file: FILE, surface: 'flesh',
  defaults: {},
  build: (ctx) => {
    const mesh = new Flock(ctx.sky, { x: 0, z: 0, count: 1, seed: SHEEP_SEED }).build().mesh;
    mesh.setMatrixAt(0, new THREE.Matrix4());   // the flock stood it on the terrain near (0, 0): its own space instead
    mesh.instanceMatrix.needsUpdate = true;
    const fit = (): void => { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); };
    fit();
    if (modelsOn('creatures')) {
      // the flock swaps in the generated sheep when its rig lands (the same cached load): refit, and show it
      loadCreatureRig('sheep').then(() => {
        fit();
        if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: 'nalati-grasslands/sheep' } }));
        return null;
      }).catch(() => { /* the flock keeps the code sheep, and says so */ });
    }
    return mesh;
  },
});

/** the grey marmot: the steppe's sentries round their burrows (src/engine/entities/Marmots.ts — every colony ONE InstancedMesh,
 *  stand-up and sink folded into the instance matrices); lofted in code */
export const marmot: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/marmot', name: 'Grey marmot', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: {},
  build: (ctx) => [{ geometry: buildMarmotGeometry(), material: ctx.once('nalati-marmot', () => painterlyAnimalMaterial(ctx.sky)), receiveShadow: true }],
});

/**
 * Jel Ata, the Storm Titan (src/shards/nalati-grasslands/stormTitan.ts `TitanBody`): the second boss, a ~110 m giant of ~340 churning cloud
 * puffs (and their buds) on seven code bones, one InstancedMesh, the lightning heart and eyes; the fight stands him in the
 * cloud sea beyond the south rim. The card is his body risen and at rest, his waist over the origin, the foot of his cloud
 * skirt on y = 0
 */
export const stormTitan: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/storm-titan', name: 'Jel Ata, the Storm Titan', category: 'creatures', pipeline: 'code', file: FILE,
  defaults: {},
  build: () => {
    const scratch = new THREE.Scene();   // the body adds its parts to the scene it is given
    const body = new TitanBody(scratch);
    body.rise = 1;
    body.setVisible(true);
    body.pose(0, new THREE.PerspectiveCamera());
    const own = new THREE.Group();
    for (const o of scratch.children.slice()) own.add(o);   // (a copy: add() moves each out of the list)
    body.puffs.computeBoundingBox();
    const low = body.puffs.boundingBox?.min.y ?? body.root.position.y;
    own.position.set(-body.root.position.x, -low, -body.root.position.z);
    // his cloud lights the heart's glow from the heart's world position: keep it on the specimen's heart, wherever it stands
    body.puffs.onBeforeRender = (): void => { body.heartWorld(body.uni.uHeart.value); };
    const g = new THREE.Group();
    g.name = 'storm-titan';
    g.add(own);
    return g;
  },
});
