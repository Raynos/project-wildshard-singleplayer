import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { viewmodelMaterial, type RangedWorld, type TexSet } from '@wildshard/engine/combat/view/ranged';
import type { Targets } from '@wildshard/engine/combat/types';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { HeldFirearm, heldFirearmDisplay, type HeldFirearmModel, type HeldHandRow, type HeldModelRows } from '@wildshard/game/plugin/heldFirearm';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';
import { handGeometry, type HandHold } from '../viewmodel/gloveHands';
import { LEVER_MATERIALS } from './heldLook';
import { HANDS_MATERIAL, HUNTER_HANDS, LEVER_AUTO_RELOAD_CLOSE } from '../const';
import { AUTO_RELOAD_DELAY, LEVER_PROFILE, MAGAZINE, RELOAD_IN, RELOAD_OUT, RESERVE_START, ROUND_TIME } from '../../weapons/leverAction';
import { createModelLibrary, type ModelLibrary } from '@wildshard/game/plugin/geometry';
import { LEVER_PRESENTATION, LEVER_HAND_HOLDS } from '../items/leverPresentation';
import { RANGED_FRAME, RANGED_TRACE, RANGED_FLASH, RANGED_HIT, RANGED_BRASS } from '../items/rangedFrame';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';
import type { InferOutput } from 'valibot';
import type * as THREE from 'three';

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
 * sphere, the aim reference). `preloadLeverModel(ctx.product)` (runtime/index.ts, awaited by the weapon step) fetches it; a failed load refuses equipment boot loudly.
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

// ───────────────────────────── the Blender model ─────────────────────────────

/** scripts/blender/build.sh pine-hollow/lever-rifle's output; the phone tier gets `lever-rifle.phone.glb` (tierUrl, the loaders' URL modifier) */
export const LEVER_MODEL_URL = '/assets/pine-hollow/weapons/lever-rifle.glb';
/** the GLB's meshes: the static steel, the forend, the stock (hidden sighted), the lever + hammer (each about its pivot), the bolt */
const MODEL_PARTS = ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt'] as const;
type ModelPart = (typeof MODEL_PARTS)[number];
/** the loaded model: plain float geometry per part (model space) + the two atlases */
export interface LeverModel { geo: Record<ModelPart, THREE.BufferGeometry>; steel: TexSet; wood: TexSet }
/** The model and the rifle details (`custom/leverDetails`: a named blob of the product) in one library, made by each
 *  fresh preload from the admitted product; the last one made serves the details (`detailGeometry`). */
function leverLibrary(product: ShardProduct): ModelLibrary<never, never> {
  const { pool } = product.section('custom/leverDetails', SECTIONS);
  return createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
    geometryPools: [{ url: LEVER_MODEL_URL, parts: MODEL_PARTS, native: { requireIndex: true, white: true, disposeSource: true },
      atlases: [{ id: 'steel', part: 'steel', anisotropy: 8, refresh: true }, { id: 'wood', part: 'forend', anisotropy: 8, refresh: true }] },
    { url: product.url(pool.url), parts: pool.parts }],
  }, '[lever-action]');
}
let library: ModelLibrary<never, never> | null = null;
let modelLoad: Promise<LeverModel> | null = null;
let modelReady: LeverModel | null = null;
function admittedLibrary(): ModelLibrary<never, never> {
  if (library === null) throw new Error('Required lever-action model is not admitted');
  return library;
}

/** Fetch and admit the required Blender model and rifle details before constructing equipment. Without a product it
 *  returns the load the shard's equipment step already started (the Model Explorer's card), else refuses. */
export function preloadLeverModel(product?: ShardProduct): Promise<LeverModel> {
  if (modelLoad !== null) return modelLoad;
  if (product === undefined) return Promise.reject(new Error('Required lever-action model is not admitted'));
  const LEVER_LIBRARY = leverLibrary(product);
  library = LEVER_LIBRARY;
  modelLoad = LEVER_LIBRARY.preload().then(() => {
      const part = (name: ModelPart): THREE.BufferGeometry => { const geometry = LEVER_LIBRARY.geometry(name, { borrow: true }); if (geometry === null) throw new Error(`Missing lever geometry ${name}`); return geometry; };
      const steel = LEVER_LIBRARY.atlas('steel'), wood = LEVER_LIBRARY.atlas('wood'); if (steel === null || wood === null) throw new Error('Missing lever PBR atlases');
      for (const name of ['sight-bead', 'round-live', 'round-case'] as const) if (LEVER_LIBRARY.geometry(name, { borrow: true }) === null) throw new Error(`Missing required rifle detail ${name}`);
      const ready = retainCachedResources({ geo: { steel: part('steel'), forend: part('forend'), stock: part('stock'), lever: part('lever'), hammer: part('hammer'), bolt: part('bolt') }, steel, wood }); modelReady = ready;
      cacheUntilDisposed(ready, () => { if (modelReady === ready) { modelReady = null; modelLoad = null; } }); return ready;
    });
  return modelLoad;
}

/** The rifle's parts on the held-firearm host (H3): the GLB's meshes, the library's details, three materials. */
const LEVER_MODEL: HeldModelRows = {
  materials: { brass: { name: 'lever-brass', look: LEVER_MATERIALS.brass }, wood: { name: 'lever-wood', look: LEVER_MATERIALS.wood }, steel: { name: 'lever-steel', look: LEVER_MATERIALS.steel } },
  textures: { gunmetal: { set: 'gunmetal', repeat: [2, 2] } }, // the cartridges' tiled brass UVs
  parts: [{ id: 'wood', geometry: 'forend', material: 'wood', display: true }, { id: 'stock', geometry: 'stock', material: 'wood', sighted: false, display: true },
    { id: 'steel', geometry: 'steel', material: 'steel', display: true }, { id: 'bead', geometry: 'sight-bead', material: 'brass', display: true },
    { id: 'lever', geometry: 'lever', material: 'steel', at: 'leverPivot', display: true },
    { id: 'hammer', geometry: 'hammer', material: 'steel', at: 'hammerPivot', rot: [LEVER_PRESENTATION.lever.hammerCocked, 0, 0], display: { rot: [LEVER_PRESENTATION.lever.hammerDown, 0, 0] } },
    { id: 'bolt', geometry: 'bolt', material: 'steel', display: true }, { id: 'round', geometry: 'round-live', material: 'brass', hidden: true }],
  anchors: { leverPivot: [0, -0.031, -0.018], hammerPivot: LEVER_PRESENTATION.hammerPivot, gate: [0.0158, -0.021, 0.028] },
};
/** The admitted model as host data: the GLB's parts (borrowed), owned copies of the details, the two atlases. */
function leverModel(model: LeverModel): HeldFirearmModel {
  const g = model.geo, geometry = new Map(Object.entries(g));
  for (const name of ['sight-bead', 'round-live', 'round-case'] as const) geometry.set(name, detailGeometry(name));
  return { geometry, textures: { wood: model.wood, steel: model.steel } };
}

/** The Model Explorer's card (runtime/models/gear.ts): the cabin pickup's seven parts, hammer down, on their own materials. */
export function leverSpecimen(sky: Sky, model: LeverModel): THREE.Group { return heldFirearmDisplay(sky, LEVER_MODEL, leverModel(model)); }

/** Details are admitted through the same model library and handed out as owned clones. */
function detailGeometry(name: string): THREE.BufferGeometry {
  const geometry = admittedLibrary().geometry(name);
  if (geometry === null) throw new Error(`Missing required rifle detail ${name}`);
  return geometry;
}

/** Pine's view: the .30-30's kick, flash, brass and tracer; the lever's throw; the sights; the action's clock; the poses. */
export const LEVER_VIEW = {
  ...LEVER_PRESENTATION, magazine: MAGAZINE, reserve: RESERVE_START,
  timing: { autoReloadDelay: AUTO_RELOAD_DELAY, autoReloadClose: LEVER_AUTO_RELOAD_CLOSE, reloadIn: RELOAD_IN, reloadOut: RELOAD_OUT, roundTime: ROUND_TIME },
};

function requireLeverModel(): LeverModel {
  if (modelReady === null) throw new Error('Required lever-action model is not loaded');
  return modelReady;
}

type Section<K extends keyof typeof SECTIONS> = InferOutput<(typeof SECTIONS)[K]>;
/** The lever's admitted playback rows: Pine's custom sections, read once from the product where the rifle is built. */
export interface LeverHeldRows { readonly playback: Section<'custom/heldPlayback'>; readonly inputs: Section<'custom/heldInputs'>; readonly lever: Section<'custom/leverPlayback'> }
/** Read the lever's playback sections (load time, never in a frame loop). */
export function leverHeldRows(product: ShardProduct): LeverHeldRows {
  return { playback: product.section('custom/heldPlayback', SECTIONS), inputs: product.section('custom/heldInputs', SECTIONS), lever: product.section('custom/leverPlayback', SECTIONS) };
}
/** A gloved fist from its baked hold (the bake keys the spec with its mirror). */
function hand(hold: HandHold, mirror: boolean): HeldHandRow {
  return { ...handGeometry(HUNTER_HANDS, { ...hold.spec, mirror }, hold.spec.elbow !== undefined), at: hold.at, axis: hold.axis, palm: hold.palm };
}
const bound = <T>(row: T | undefined): T => { if (row === undefined) throw new Error('Missing lever presentation binding'); return row; };

/** Pine's lever-action: the profile, the view, the model and the sections' playback rows on the held-firearm host. */
export function leverRifle(world: RangedWorld, targets: Targets | undefined, opts: { row: EquipmentRow; allowUnlocked?: boolean; held: LeverHeldRows; profile?: FirearmProfile; model?: LeverModel }): HeldFirearm<FirearmProfile> {
  const { playback, inputs, lever } = opts.held, frame = inputs.frames.lever, rows = lever.bindings.slice(0, 5).map(bound);
  return new HeldFirearm(world, targets, { row: opts.row, allowUnlocked: opts.allowUnlocked ?? false, profile: opts.profile ?? LEVER_PROFILE, view: LEVER_VIEW,
    model: leverModel(opts.model ?? requireLeverModel()),
    hands: { material: viewmodelMaterial(world.sky, 'hunter-hands', HANDS_MATERIAL), left: hand(LEVER_HAND_HOLDS.left, true), right: hand(LEVER_HAND_HOLDS.right, false), gate: LEVER_HAND_HOLDS.gate },
    rows: { ...LEVER_MODEL, mount: 'ownPass', gate: 'gate', round: 'round', brass: { geometry: 'round-case', material: 'brass' }, rotationReads: { hammerAngle: 'hammer' },
      playback: {
        groups: { frame: frame.program, pose: playback.lever, parts: playback.leverParts, sight: lever.sight, cycle: lever.cycle, handAt: lever.handAt, handAxis: lever.handAxis, handPalm: lever.handPalm },
        inputs: [{ group: 'frame', rows: frame.inputs }, { group: 'pose', rows: inputs.lever }, { group: 'parts', rows: lever.partInputs }, ...rows.map(row => ({ group: row.group, rows: row.inputs }))],
        outputs: [{ group: 'frame', rows: frame.outputs, target: 'frame' }, ...rows.map(row => ({ group: row.group, rows: row.outputs, target: row.target === 'sight' ? 'sight' as const : row.target === 'cycle' ? 'values' as const : 'grip' as const }))],
        schedule: { frame: 'frame', sight: 'sight', pose: 'pose', action: ['cycle', 'parts'], grip: ['handAt', 'handAxis', 'handPalm'] },
      },
      presentation: { frame: RANGED_FRAME.lever, flash: { shape: RANGED_FLASH.lever, colour: 0xffb060 }, ejection: RANGED_BRASS.lever, tracer: RANGED_TRACE.segment, hitMuzzle: RANGED_HIT.lever.muzzle } },
  });
}
/** A built Pine lever-action. */
export type LeverRifleWeapon = HeldFirearm<FirearmProfile>;
