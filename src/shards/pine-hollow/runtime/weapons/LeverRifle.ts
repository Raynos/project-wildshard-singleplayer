import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { viewmodelMaterial, viewmodelRowMaterial, viewmodelTexSet, weaponDisplay, type TexSet } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { LeverFirearm as LeverFirearmWeapon, type LeverFirearmHandsKit, type LeverFirearmView } from '../items/leverFirearm';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';
import { WeaponHands, gripPose, holdDef } from '../viewmodel/gloveHands';
import { LEVER_MATERIALS } from './heldLook';
import { HANDS_MATERIAL, HUNTER_HANDS, LEVER_AUTO_RELOAD_CLOSE } from '../const';
import { AUTO_RELOAD_DELAY, LEVER_PROFILE, LeverAction, MAGAZINE, RELOAD_IN, RELOAD_OUT, RESERVE_START, ROUND_TIME } from '../../weapons/leverAction';
import * as THREE from 'three';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import { LEVER_PRESENTATION, LEVER_HAND_HOLDS } from '../items/leverPresentation';
import details from '../../data/leverDetails.json' with { type: 'json' };

/**
 * LeverRifle — Pine Hollow's rifle (PINE-HOLLOW-REMASTER PH-U5 / PH-C11), a row over the platform's lever firearm
 * (`@wildshard/sdk/items/leverFirearm`, SHARD-PLATFORM SF36: this file is the model, the cartridge, the hands, the view and
 * the binding; the action is weapons/leverAction.ts): a 1900s backwoods lever-action carbine in the
 * Winchester 1894 mould, replacing the AR-15 on Pine Hollow only (Driftwood and the dev harnesses keep Rifle.ts). It fills
 * the same kit slot (`id 'rifle'`: the cabin pickup, Old Ironhide's skin, the trader's Scarback Furnace finish) and the
 * same `KitWeapon` contract, so Weapons.ts / the HUD / Combat / the feel hooks need nothing new.
 *
 *   const rifle = new LeverRifle({ game, sky, player, forest }, targets, { allowUnlocked });
 *   weapons = new Weapons(crossbow, rifle, [...]);   // the manager calls setActive / update / drives `holster`
 *   rifle.onCycle = () => sfx.shot('leverCycle')     // the lever thrown (after every shot, and to chamber after a reload)
 *   rifle.onRoundIn = () => …                        // one cartridge thumbed through the loading gate
 *
 * The model (PH-C11 remaster) is modelled + baked in Blender (src/shards/pine-hollow/blender/weapons/lever_rifle.py, built by scripts/blender/build.sh) and loaded
 * from `LEVER_MODEL_URL` (meshopt, WebP atlases; the phone tier's `.phone.glb` through tierUrl — ≈ 8 k tris + 1024²
 * atlases desktop, ≈ 4 k + 512² phone): a colour-case-hardened receiver (the bolt in its top channel, the loading gate on
 * the right), the hammer + spur, a round tapered barrel with a crowned muzzle over the magazine tube, the forend band and
 * the carbine's barrel band, the loop lever, the trigger, the tangs, an oiled-walnut forend and straight-grip stock with a
 * crescent buttplate, a semi-buckhorn rear sight on its base, the front ramp + blade (the gold bead stays this file's
 * sphere, the aim reference). `preloadLeverModel()` (main.ts, awaited by the weapon step) fetches it; a failed load refuses equipment boot loudly.
 * The same parts (the static steel, the forend, the stock, the lever / hammer about their pivots, the bolt), the same
 * seven draws and four materials ('lever-wood', 'lever-steel', 'lever-brass', + the flash), all on the viewmodels'
 * shared lit program (Crossbow.viewmodelMaterial) — the rifle compiles no program of its own. The skins restyle it by
 * those names. The cabin pickup (`displayModel`) draws with its own copies of the materials, so its orb's glow stays off
 * the rifle in your hands.
 *
 * Action: TUBE_MAX rounds in the tube + one chambered (7 in the gun). A shot fires the chambered round (HITSCAN like
 * Rifle.ts, ×DAMAGE_SCALE the bolt model — a .30-30 hits hard) and drops the hammer; after CYCLE_DELAY the lever is thrown
 * (LEVER_TIME: the loop swings down, the bolt runs back and cocks the hammer, the empty case spins up out of the top, the
 * lever closes and chambers the next round from the tube). No second shot until the cycle is done — the defining rhythm.
 * `R` (or a trigger pull on an empty gun) reloads THROUGH THE GATE, ONE ROUND AT A TIME (ROUND_TIME each: the rifle rolls
 * its right side up, a cartridge is pushed in); a trigger pull mid-reload stops it after the round in hand; a gun that
 * was run dry is cycled at the end to chamber one.
 *
 * ADS = iron sights at a real eye relief: model rotation 0, the eye on the comb (EYE_Z) exactly on the sight line, the
 * gold bead sitting in the buckhorn's notch on the crosshair, the receiver's top and the hammer low in the frame; FOV
 * 72 → 58 (the crossbow's 1.3×). The cycle pulls the rifle down off the eye and back.
 */

/** Pine's own construction options the build reads. */
export interface LeverBuildOptions {
  /** The required Blender model; absent uses the model admitted during equipment boot. */
  model?: LeverModel;
}

// Model-space geometry anchors stay with the rifle's native parts.
const HAMMER_PIVOT = new THREE.Vector3(...LEVER_PRESENTATION.hammerPivot);
const MODEL_LEVER_PIVOT = new THREE.Vector3(0, -0.031, -0.018);
const MODEL_GATE = new THREE.Vector3(0.0158, -0.021, 0.028);

// ───────────────────────────── the Blender model ─────────────────────────────

/** scripts/blender/build.sh pine-hollow/lever-rifle's output; the phone tier gets `lever-rifle.phone.glb` (tierUrl, the loaders' URL modifier) */
export const LEVER_MODEL_URL = '/assets/pine-hollow/weapons/lever-rifle.glb';
/** the GLB's meshes: the static steel, the forend, the stock (hidden sighted), the lever + hammer (each about its pivot), the bolt */
const MODEL_PARTS = ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt'] as const;
type ModelPart = (typeof MODEL_PARTS)[number];
/** the loaded model: plain float geometry per part (model space) + the two atlases */
export interface LeverModel { geo: Record<ModelPart, THREE.BufferGeometry>; steel: TexSet; wood: TexSet }
const LEVER_LIBRARY = createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
  geometryPools: [{ url: LEVER_MODEL_URL, parts: MODEL_PARTS, native: { requireIndex: true, white: true, disposeSource: true },
    atlases: [{ id: 'steel', part: 'steel', anisotropy: 8, refresh: true }, { id: 'wood', part: 'forend', anisotropy: 8, refresh: true }] }, details.pool],
}, '[lever-action]');
let modelLoad: Promise<LeverModel> | null = null;
let modelReady: LeverModel | null = null;

/** Fetch and admit the required Blender model and rifle details before constructing equipment. */
export function preloadLeverModel(): Promise<LeverModel> {
  modelLoad ??= LEVER_LIBRARY.preload().then(() => {
      const part = (name: ModelPart): THREE.BufferGeometry => { const geometry = LEVER_LIBRARY.geometry(name, { borrow: true }); if (geometry === null) throw new Error(`Missing lever geometry ${name}`); return geometry; };
      const steel = LEVER_LIBRARY.atlas('steel'), wood = LEVER_LIBRARY.atlas('wood'); if (steel === null || wood === null) throw new Error('Missing lever PBR atlases');
      for (const name of ['sight-bead', 'round-live', 'round-case'] as const) if (LEVER_LIBRARY.geometry(name, { borrow: true }) === null) throw new Error(`Missing required rifle detail ${name}`);
      const ready = retainCachedResources({ geo: { steel: part('steel'), forend: part('forend'), stock: part('stock'), lever: part('lever'), hammer: part('hammer'), bolt: part('bolt') }, steel, wood }); modelReady = ready;
      cacheUntilDisposed(ready, () => { if (modelReady === ready) { modelReady = null; modelLoad = null; } }); return ready;
    });
  return modelLoad;
}

/** a build's parts, in model space (the lever / hammer about their pivots) */
interface LeverParts { wood: THREE.BufferGeometry; stock: THREE.BufferGeometry; steel: THREE.BufferGeometry; lever: THREE.BufferGeometry; hammer: THREE.BufferGeometry; bolt: THREE.BufferGeometry; leverPivot: THREE.Vector3; gate: THREE.Vector3 }

/** a lever-action build: its three materials (the viewmodels' shared lit program) and its parts in model space and the gold bead */
interface LeverBuild { readonly brassMat: THREE.MeshPhysicalMaterial; readonly woodMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial; readonly parts: LeverParts; readonly beadGeo: THREE.BufferGeometry }
/** The viewmodel's build and the Model Explorer's card (`leverSpecimen`) are this one function, so the two never drift. */
function buildLever(sky: Sky, model: LeverModel): LeverBuild {
  // ── materials: the viewmodels' shared lit program, ./heldLook.ts LEVER_MATERIALS ──
  const sets = { gunmetal: viewmodelTexSet('gunmetal'), wood: model.wood, steel: model.steel }; // gunmetal: the cartridges' tiled brass UVs
  sets.gunmetal.map.repeat.set(2, 2); sets.gunmetal.normalMap.repeat.set(2, 2); sets.gunmetal.armMap.repeat.set(2, 2);
  const mat = (id: keyof typeof LEVER_MATERIALS): THREE.MeshPhysicalMaterial => viewmodelRowMaterial(sky, `lever-${id}`, LEVER_MATERIALS[id], sets);
  const brassMat = mat('brass'), woodMat = mat('wood'), steelMat = mat('steel');
  const g = model.geo, parts = { wood: g.forend, stock: g.stock, steel: g.steel, lever: g.lever, hammer: g.hammer, bolt: g.bolt, leverPivot: MODEL_LEVER_PIVOT, gate: MODEL_GATE };
  const beadGeo = detailGeometry('sight-bead');

  return { brassMat, woodMat, steelMat, parts, beadGeo };
}

/**
 * The Model Explorer's card (src/shards/pine-hollow/runtime/models/gear.ts): the lever-action as the cabin pickup shows it — the
 * seven parts, the hammer down — built by `buildLever` on its own materials and its own copy of the model's geometry, so
 * nothing of the rifle in your hands is shared or touched. `model`: `await preloadLeverModel()`.
 */
export function leverSpecimen(sky: Sky, model: LeverModel): THREE.Group {
  const { brassMat, woodMat, steelMat, parts, beadGeo } = buildLever(sky, model);
  return weaponDisplay([
    { geo: parts.wood, mat: woodMat }, { geo: parts.stock, mat: woodMat }, { geo: parts.steel, mat: steelMat }, { geo: beadGeo, mat: brassMat },
    { geo: parts.lever, mat: steelMat, pos: parts.leverPivot }, { geo: parts.hammer, mat: steelMat, pos: HAMMER_PIVOT, rot: new THREE.Euler(LEVER_PRESENTATION.lever.hammerDown, 0, 0) }, { geo: parts.bolt, mat: steelMat },
  ], { mode: 'parts', copyGeometry: true, whiteColors: true });
}

/** Details are admitted through the same model library and handed out as owned clones. */
function detailGeometry(name: string): THREE.BufferGeometry {
  const geometry = LEVER_LIBRARY.geometry(name);
  if (geometry === null) throw new Error(`Missing required rifle detail ${name}`);
  return geometry;
}
function cartridgeGeometry(live: boolean): THREE.BufferGeometry { return detailGeometry(live ? 'round-live' : 'round-case'); }

/**
 * E322 F-M6: the hunter's gloved hands (data/handsLook.ts on @wildshard/sdk/viewmodel/gloveHands; Jake's pick B), in model space: the left hand round the forend, the
 * right on the wrist with its fingers through the loop (it rides the lever through a cycle); `gate` = the right hand
 * thumbing a cartridge, relative to the round's base. A dev knob: edit, then the rifle's `rebuildHands()`.
 */
/** The hands: the glove material once per rifle, a fresh pair from the holds on every build. */
const LEVER_HANDS: LeverFirearmHandsKit = {
  make: (sky) => {
    let handsMat: THREE.MeshPhysicalMaterial | null = null;
    return (model) => {
      handsMat ??= viewmodelMaterial(sky, 'hunter-hands', HANDS_MATERIAL);
      const right = holdDef(LEVER_HAND_HOLDS.right), g = LEVER_HAND_HOLDS.gate;
      const gate = gripPose(g.at, g.axis, g.palm);
      return { rest: right.pose, gate, hands: new WeaponHands(HUNTER_HANDS, model, handsMat, holdDef(LEVER_HAND_HOLDS.left), right) };
    };
  },
  grip: () => gripPose([0, 0, 0], [0, 1, 0], [1, 0, 0]),
};

/** Pine's view: the .30-30's kick, flash, brass and tracer; the lever's throw; the sights at a carbine's eye relief; the
 *  action's clock; the hip pose and the lever's rock. */
export const LEVER_VIEW: LeverFirearmView = {
  ...LEVER_PRESENTATION, magazine: MAGAZINE, reserve: RESERVE_START,
  timing: { autoReloadDelay: AUTO_RELOAD_DELAY, autoReloadClose: LEVER_AUTO_RELOAD_CLOSE, reloadIn: RELOAD_IN, reloadOut: RELOAD_OUT, roundTime: ROUND_TIME },
};

function requireLeverModel(): LeverModel {
  if (modelReady === null) throw new Error('Required lever-action model is not loaded');
  return modelReady;
}

type LeverArguments = ConstructorParameters<typeof LeverFirearmWeapon<FirearmProfile>>;
/** Pine's lever-action: the row bound to the platform's lever firearm (`new LeverRifle(world, targets, { row })`). */
export class LeverRifle extends LeverFirearmWeapon<FirearmProfile> {
  constructor(world: LeverArguments[0], targets: LeverArguments[1], opts: Pick<LeverArguments[2], 'row' | 'allowUnlocked' | 'muzzleLight'> & { profile?: FirearmProfile } & LeverBuildOptions) {
    super(world, targets, { ...opts, profile: opts.profile ?? LEVER_PROFILE,
      build: sky => buildLever(sky, opts.model ?? requireLeverModel()), cartridge: cartridgeGeometry,
      action: store => new LeverAction(store), hands: LEVER_HANDS, view: LEVER_VIEW });
  }
}
/** A built Pine lever-action. */
export type LeverRifleWeapon = LeverFirearmWeapon<FirearmProfile>;
