/**
 * Pine Hollow's gear (E306 / E315 M5, `gear`): what the Hollow's player holds (src/main.ts) — the hunting crossbow it hands
 * out, the lever-action in the rifle slot (the Hollow's, not the AR-15: LeverRifle.ts), the Warden's longbow (the Antler
 * King's reward) and the skinning knife the skinning beat raises (./skinningKnife.ts). The viewmodels keep drawing the held
 * ones; each card is a separate build by the weapon's own builder on its own materials (src/models/gear.ts says why).
 */
import * as THREE from 'three';
import { defineModel, type ModelDef } from '../../../models/model';
import { loadingSpecimen, skinVariants, wearSkin, type GearSkinParams } from '../../../models/gear';
import { live, type RosterEntry } from '../../../models/live';
import { buildCrossbow, isMesh, whiteColors } from '../../../player/Crossbow';
import { crossbowDisplayModel } from '../../../player/Skins';
import { leverSpecimen, preloadLeverModel } from '../../../player/LeverRifle';
import { longbowSpecimen } from '../../../player/Longbow';
import { skinningKnife } from './skinningKnife';

const FILE = 'src/chunks/pine-hollow/models/gear.ts';

/**
 * The hunting crossbow: `buildCrossbow` — the walnut stock, the iron and brass furniture, the steel prod, the string, the
 * leather grip and the loaded bolt; its textures drawn in code (viewmodelTextures.ts) — built once per shard into a group
 * of its own, then made a world copy as the floor drop is (Skins.crossbowDisplayModel: the string posed at rest, its own
 * clones of the materials). The rear peep only shows sighted: left out. Variants: the crossbow skins.
 */
export const crossbow: ModelDef<GearSkinParams> = defineModel<GearSkinParams>({
  id: 'pine-hollow/crossbow', name: 'Hunting crossbow', category: 'gear', pipeline: 'code', file: FILE,
  defaults: { skin: null }, variants: skinVariants('crossbow'),
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
    return wearSkin(crossbowDisplayModel({ model }, ctx.sky), p, ctx.sky);
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
  defaults: { skin: null }, variants: skinVariants('rifle'),
  build: (ctx, p) => {
    const made = ctx.once('gear:lever-action', async () => leverSpecimen(ctx.sky, await preloadLeverModel()));
    return loadingSpecimen('pine-hollow/lever-action', [0.05, 0.16, 1.02], async () => wearSkin((await made).clone(), p, ctx.sky));
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

/** the Hollow's kit (src/main.ts): the crossbow (1), the lever-action (2, the cabin pickup), the longbow (3, the King's
 *  reward); and the skinning beat's knife */
export const GEAR: readonly RosterEntry[] = [
  live(crossbow, { copies: 1 }),
  live(leverAction, { copies: 1 }),
  live(wardensLongbow, { copies: 1 }),
  live(skinningKnife, { copies: 1 }),
];
