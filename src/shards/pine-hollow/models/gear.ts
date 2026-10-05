/**
 * Pine Hollow's gear (E306 / E315 M5, `gear`): what the Hollow's player holds (src/main.ts) — the hunting crossbow it hands
 * out, the lever-action in the rifle slot (the Hollow's, not the AR-15: LeverRifle.ts), the Warden's longbow (the Antler
 * King's reward) and the skinning knife the skinning beat raises (./skinningKnife.ts). The viewmodels keep drawing the held
 * ones; each card is a separate build by the weapon's own builder on its own materials (src/engine/models/gear.ts says why).
 */
import * as THREE from 'three';
import { buildBolt, buildCrossbow, MAX_BOLTS } from '../weapons/crossbow/Crossbow';
import { crossbowDisplayModel } from '../weapons/crossbow/display';
import { isMesh, whiteColors } from '@wildshard/engine/combat/view/ranged';
import { loadingSpecimen, skinVariants, wearSkin, type GearSkinParams } from '@wildshard/engine/models/gear';
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { PINE_FINISHES } from '../loadout/skins';
import { leverSpecimen, preloadLeverModel } from '../weapons/LeverRifle';
import { QUIVER_MAX } from '../weapons/Longbow';
import { arrowMaterial, buildArrowGeometry, longbowSpecimen } from '../weapons/longbowView';
import { skinningKnife } from './skinningKnife';

const FILE = 'src/shards/pine-hollow/models/gear.ts';

/**
 * The hunting crossbow: `buildCrossbow` — the walnut stock, the iron and brass furniture, the steel prod, the string, the
 * leather grip and the loaded bolt; its textures drawn in code (viewmodelTextures.ts) — built once per shard into a group
 * of its own, then made a world copy as the floor drop is (Skins.crossbowDisplayModel: the string posed at rest, its own
 * clones of the materials). The rear peep only shows sighted: left out. Variants: the crossbow skins.
 */
export const crossbow: ModelDef<GearSkinParams> = defineModel<GearSkinParams>({
  id: 'pine-hollow/crossbow', name: 'Hunting crossbow', category: 'gear', pipeline: 'code', file: FILE,
  defaults: { skin: null }, variants: skinVariants('crossbow', PINE_FINISHES),
  build: (ctx, p) => {
    const model = ctx.once('gear:crossbow', () => {
      const into = { model: new THREE.Group(), peep: new THREE.Group(), peepRing: new THREE.Group() };
      buildCrossbow(ctx.sky, into);
      into.model.remove(into.peep);
      into.model.traverse((m) => { // the viewmodels' program reads vertex colours
        if (isMesh(m) && (Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      });
      return into.model;
    });
    return wearSkin(crossbowDisplayModel({ model }, ctx.sky), p, ctx.sky, PINE_FINISHES);
  },
});

/**
 * The lever-action: the Blender model (scripts/blender/pine-hollow/weapons/lever_rifle.py → lever-rifle[.phone].glb) with
 * the gold bead, or the procedural build when the file does not load — `LeverRifle.leverSpecimen`: the seven parts as the
 * cabin pickup shows them, hammer down, on their own materials and their own copy of the geometry. Variants: the rifle
 * skins (Ironhide and Scarback Furnace carry the lever-action's finish too).
 */
export const leverAction: ModelDef<GearSkinParams> = defineModel<GearSkinParams>({
  id: 'pine-hollow/lever-action', name: 'Lever-action rifle', category: 'gear', pipeline: ['blender', 'code'], file: FILE,
  defaults: { skin: null }, variants: skinVariants('rifle', PINE_FINISHES),
  build: (ctx, p) => {
    const made = ctx.once('gear:lever-action', async () => leverSpecimen(ctx.sky, await preloadLeverModel()));
    return loadingSpecimen('pine-hollow/lever-action', [0.05, 0.16, 1.02], async () => wearSkin((await made).clone(), p, ctx.sky, PINE_FINISHES));
  },
});

/**
 * The Warden's longbow: a yew self-bow, horn nocks, a linen string, the grip bound with amber set in it — the braced stave
 * and the left glove on it, as `displayModel` shows it (`Longbow.longbowSpecimen`, on its own material).
 */
export const wardensLongbow: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/wardens-longbow', name: "Warden's longbow", category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => ctx.once('gear:wardens-longbow', () => longbowSpecimen(ctx.sky)).clone(),
});

/**
 * The crossbow bolt (E348): an ash shaft, a steel socket and a two-edged broadhead, three feather vanes, 0.36 m — the
 * crossbow's `buildBolt` (its atlas drawn in code, the viewmodels' program group) as its own copy, in the normal queue.
 * The loaded one rides the rail; each one in flight or stuck in the world is its own mesh (Crossbow.ts); MAX_BOLTS carried.
 */
export const crossbowBolt: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/crossbow-bolt', name: 'Crossbow bolt', category: 'gear', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
  specimenYaw: Math.PI / 2, // side on: the shaft runs across the card
  build: (ctx) => {
    const { geometry, material } = ctx.once('gear:crossbow-bolt', () => buildBolt(ctx.sky));
    return [{ geometry, material, castShadow: true, receiveShadow: true }];
  },
});

/**
 * The longbow's arrow (E348): an ash shaft, a sinew-bound bodkin head, three grey-goose feathers with a white cock
 * feather, 0.76 m — the longbow's `buildArrowGeometry` on its own copy of the arrows' material (`arrowMaterial`). Every
 * arrow loosed, flying or stuck, is one instanced draw (Projectiles.ts); the quiver holds QUIVER_MAX.
 */
export const longbowArrow: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/longbow-arrow', name: 'Longbow arrow', category: 'gear', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
  specimenYaw: Math.PI / 2,
  build: (ctx) => [{ geometry: ctx.once('gear:longbow-arrow', buildArrowGeometry), material: ctx.once('gear:longbow-arrow-material', () => arrowMaterial(ctx.sky)), castShadow: true, receiveShadow: true }],
});

/** the Hollow's kit (src/main.ts): the crossbow (1), the lever-action (2, the cabin pickup), the longbow (3, the King's
 *  reward); and the skinning beat's knife */
export const GEAR: readonly RosterEntry[] = [
  live(crossbow, { copies: 1 }),
  live(crossbowBolt, { copies: MAX_BOLTS, drawnAs: 'single' }),
  live(leverAction, { copies: 1 }),
  live(wardensLongbow, { copies: 1 }),
  live(longbowArrow, { copies: QUIVER_MAX, drawnAs: 'instanced' }),
  live(skinningKnife, { copies: 1 }),
];
