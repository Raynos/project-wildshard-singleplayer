import { createClientScene } from '@wildshard/game/plugin/ui';
import { CROSSBOW_GEOMETRY } from '../../../boot/crossbowGeometry';
import rows from '../../../data/crossbowPool.generated.json' with {type:'json'};
import { dataTexture, viewmodelTexSet, makeCord, makeBoltAtlas, fixIBL, VIEWMODEL_GROUP, viewmodelMaterial } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { crossbowType, type BoltCrossbowParts, type BoltCrossbowView, type BoltCrossbow as BoltCrossbowWeapon } from '../../items/boltCrossbow';
import { WeaponHands, coatMaterialParams, coatTextures, holdDef, prepareWeaponHands, type HandHold, type WeaponHands as WeaponHandsView } from '../../viewmodel/gloveHands';
import { BUCKSKIN, HANDS_MATERIAL, HUNTER_HANDS } from '../../viewmodel/handsLook';
import { CROSSBOW_PROFILE, type CrossbowProfile } from '../../../weapons/crossbow/profiles';
import { boltFlightStep } from '../../../weapons/crossbow/flight';
import * as THREE from 'three';

/**
 * Crossbow — Pine Hollow's first-person hero weapon, a row over the platform's bolt crossbow
 * (`@wildshard/sdk/items/boltCrossbow`, SHARD-PLATFORM SF36): this file is the procedural medieval hunting crossbow
 * (`buildCrossbow`, `buildBolt`), the hunter's gloved hands on it, the iron-sights view and the binding. The trigger,
 * string, bolts (flight through weapons/crossbow/flight.ts, sticking, glancing), tracers, ADS solve and pose are the
 * family's.
 *
 *   const crossbow = new Crossbow({ game, sky, player, forest }, targets?, { row: CROSSBOW, allowUnlocked?: boolean });
 *   game.onUpdate((dt, t) => crossbow.update(dt, t));   // register AFTER player.update
 *
 * Input (only while `player.locked`, or always when `allowUnlocked`): LMB / `F` fire, RMB (click to toggle) ADS,
 * `R` reload. `crossbow.enabled = false` mutes input (intro / pause). `crossbow.adsHeld` can be forced.
 * Events, state and side effects: the family's (src/shards/pine-hollow/runtime/items/boltCrossbow.ts).
 */

export const MAX_BOLTS = 30;
/** Rear PEEP sight (mockup art/ads-aim/round-1/ads-C-peep-sight.png): a dark-iron ring on a post just in front of the nut (the stock
 *  behind the nut is inside the near plane when sighted), placed on the eye→tip line so that at full ADS its centre
 *  projects exactly where the tip does — the tip is seen through the ring. Outer diameter ≈ 4 % of the screen width
 *  (≥ 7 % of the height, so it stays a ring on a portrait phone). Hidden at the hip, fades in with the ADS blend. */
const PEEP_R = 0.01, PEEP_CYAN = 0x8fe3ff; // rear peep: 2.1 cm ring (CROSSBOW_VIEW.peep) on a short post just ahead of the nut

// ───────────────────────────── procedural textures ─────────────────────────────



// ───────────────────────────── geometry helpers ─────────────────────────────

/** Sweep a tapered rectangle section along a curve (flat spring-steel limb). */
/**
 * The bolt (E348): its atlas (the iron shaft, the steel head, the feather vanes), its geometry along −Z (tip at −Z, 0.36 m)
 * and its material, on the viewmodels' program group. The loaded bolt, every bolt in flight or stuck (`buildCrossbow`'s
 * parts) and the Model Explorer's bolt card (src/shards/pine-hollow/models/gear.ts: its own copy) are built by this.
 */
export function buildBolt(sky: Sky): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  const atlas = makeBoltAtlas();
  const geometry = CROSSBOW_GEOMETRY.geometry('loaded-bolt', {borrow:true});
  if (geometry === null) throw new Error('Crossbow bolt pool not ready');
  const material = new THREE.MeshStandardMaterial({ map: atlas.map, normalMap: atlas.normalMap, aoMap: atlas.armMap, roughnessMap: atlas.armMap, metalnessMap: atlas.armMap, roughness: 1, metalness: 1, alphaTest: 0.5, side: THREE.DoubleSide });
  // one DoubleSide pass: the viewmodel makes this material transparent (Crossbow), and three draws a transparent
  // DoubleSide material as a BackSide + a FrontSide pass — two programs. The fletching is alpha-tested and the
  // bolt writes depth, so one pass looks the same.
  material.forceSinglePass = true;
  material.name = 'xbow-bolt'; fixIBL(material, VIEWMODEL_GROUP); sky.setupMaterial(material);
  return { geometry, material };
}

/**
 * The crossbow in model space (−Z the bolt, +Y up, the rail top at y 0; the nut at z +0.14, the prod at z −0.30): the stock,
 * the iron, the brass, the prod, the string (its legs unposed: the viewmodel poses them every frame), the leather, the loaded
 * bolt and the rear peep sight (in `peep` / `peepRing`, hidden), added to `into.model`, every lit part on the viewmodels'
 * shared program. The viewmodel's build and the Model Explorer's card (src/shards/pine-hollow/models/gear.ts, through
 * Skins.crossbowDisplayModel) are this one function, so the two never drift; the geometries without wear colours need
 * `whiteColors` before a draw.
 */
export function buildCrossbow(sky: Sky, into: { readonly model: THREE.Group; readonly peep: THREE.Group; readonly peepRing: THREE.Group }): BoltCrossbowParts {
  const walnut = viewmodelTexSet('walnut'), steel = viewmodelTexSet('brushed-steel'), leather = viewmodelTexSet('leather'), cord = makeCord();
  walnut.map.repeat.set(1, 4); walnut.normalMap.repeat.set(1, 4); walnut.armMap.repeat.set(1, 4);
  // Every lit material below is the SAME program: MeshPhysical + vertex colours, the same map slots (map, normal,
  // ao, roughness, metalness — the ARM texture feeds the last three, a 1×1 ARM where a set has none) and the same
  // cache key. Physical at its defaults (ior 1.5, specularIntensity 1, white specularColor) is exactly Standard's
  // F0 0.04 / F90 1, and a mesh with no wear colours gets an all-white colour attribute (`whiteColors`), so iron,
  // brass, cord, leather and the peep ring render as before and share the stock's program. The prod keeps its own
  // (anisotropy is a define — the hero-weapon sheen stays). Each program is ~150 ms of Metal compile on the iPhone.
  const flatArm = dataTexture(new Uint8Array([255, 255, 0, 255]), 1, 1, false); // ao 1 · roughness 1 · metal 0
  const woodMat = new THREE.MeshPhysicalMaterial({ map: walnut.map, normalMap: walnut.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), aoMap: walnut.armMap, roughnessMap: walnut.armMap, metalnessMap: walnut.armMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.45, specularIntensity: 0.3 }); // low specularIntensity kills the grazing sunset sheen on the rail
  const ironMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.5, metalness: 1, color: new THREE.Color(0.24, 0.23, 0.23), vertexColors: true, envMapIntensity: 0.6 });
  const prodMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.25, metalness: 1, color: new THREE.Color(0.55, 0.55, 0.57), vertexColors: true, anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 0.7 }); // anisotropy kept (hero-weapon sheen): its define is the prod's own program
  steel.map.repeat.set(2, 2); steel.normalMap.repeat.set(2, 2); steel.armMap.repeat.set(2, 2);
  const leatherMat = new THREE.MeshPhysicalMaterial({ map: leather.map, normalMap: leather.normalMap, aoMap: leather.armMap, roughnessMap: leather.armMap, metalnessMap: leather.armMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.5 });
  const cordMat = new THREE.MeshPhysicalMaterial({ map: cord.map, normalMap: cord.normalMap, aoMap: flatArm, roughnessMap: flatArm, metalnessMap: flatArm, roughness: 0.85, metalness: 0, vertexColors: true });
  const brassMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.1, metalness: 1, color: new THREE.Color(0.95, 0.66, 0.3), vertexColors: true, envMapIntensity: 1.0 });
  ([['xbow-wood', woodMat], ['xbow-iron', ironMat], ['xbow-prod', prodMat], ['xbow-leather', leatherMat], ['xbow-cord', cordMat], ['xbow-brass', brassMat]] as [string, THREE.Material][]).forEach(([n, m]) => { m.name = n; fixIBL(m, VIEWMODEL_GROUP); sky.setupMaterial(m); });

  const {material:boltMat} = buildBolt(sky);
  const peepIron = viewmodelMaterial(sky, 'xbow-peep', { color: new THREE.Color(0.05,0.05,0.055), roughness:0.9, metalness:0.75, emissive:new THREE.Color(PEEP_CYAN), emissiveIntensity:0.05 });
  const peepGlow = new THREE.MeshBasicMaterial({color:new THREE.Color(PEEP_CYAN),toneMapped:false,fog:false,opacity:.85});
  const made=createClientScene(rows.hierarchy,{geometry:id=>CROSSBOW_GEOMETRY.geometry(id,{borrow:true}),
    objects:new Map([['peep',into.peep],['peep-ring',into.peepRing]]),
    materials:new Map<string, THREE.Material>([['wood',woodMat],['iron',ironMat],['prod',prodMat],['leather',leatherMat],['cord',cordMat],['brass',brassMat],['bolt',boltMat],['peep-iron',peepIron],['peep-glow',peepGlow]])});
  into.model.add(...made.root.children);
  const mesh=(id:string):THREE.Mesh=>{const node=made.mesh(id);if(node===null)throw new Error('Crossbow pool part missing');return node;};
  const loadedBolt=mesh('loaded-bolt'), boltGeo=loadedBolt.geometry;
  const box=boltGeo.boundingBox;if(box===null)throw new Error('Crossbow pool bounds missing');
  const tipLocal=new THREE.Vector3(0,0,box.min.z);
  return {stringLeft:mesh('string-left'),stringRight:mesh('string-right'),serving:mesh('serving'),loadedBolt,boltGeo,boltMat,
    peepPost:mesh('peep-post'),peepMats:[peepIron,peepGlow],tipL:new THREE.Vector3(-.335,.004,-.205),tipR:new THREE.Vector3(.335,.004,-.205),
    nockRest:new THREE.Vector3(0,.009,-.215),nockDrawn:new THREE.Vector3(0,.009,.128),tipLocal,tipModel:tipLocal.clone().add(loadedBolt.position),nockZ:box.max.z};
}

/** Pine's iron-sights view: the hip pose (lower-right, Skyrim) at 1.35×; the cheek on the stock (the eye 5.6 cm above the
 *  rail, looking straight down the bolt, the nut 3 cm in front of the near plane); the peep at model z 0.10, 2.1 cm. */
export const CROSSBOW_VIEW: BoltCrossbowView = {
  hip: { px: 0.12, py: -0.165, pz: -0.27, rx: 0.035, ry: 0.13, rz: 0.04, scale: 1.35 },
  ads: { eyeAboveRail: 0.056, nearMargin: 0.03, pitch: 0 },
  peep: { z: 0.10, radius: PEEP_R, worldRadius: 0.0105 },
};

/**
 * E322 F-M6: the hunter's gloved hands (data/handsLook.ts on @wildshard/sdk/viewmodel/gloveHands; Jake's pick B), in model space: the left hand round the back of
 * the fore-end's leather — its thumb up the near side, its fingers up the far side, the coat sleeve free (aimed at an
 * elbow off the frame's lower left, so the reload's tilt never swings the arm away); the right under the grip with the
 * index by the trigger. Both in the coat's sleeves. A dev knob: edit, then the crossbow's `rebuildHands()`.
 */
export const CROSSBOW_HAND_HOLDS: { left: HandHold; right: HandHold } = {
  left: { spec: { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, at: [0.004, -0.034, -0.04], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { spec: { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, at: [0, -0.09, 0.33], axis: [0, 0.34, -0.94], palm: [0, 1, 0] },
};
/** The hands' maker: the glove and coat materials once per crossbow, a fresh pair from the holds on every build. */
function crossbowHands(sky: Sky): (model: THREE.Group) => WeaponHandsView {
  let handsMat: THREE.MeshPhysicalMaterial | null = null, coatMat: THREE.MeshPhysicalMaterial | null = null;
  return (model) => {
    handsMat ??= viewmodelMaterial(sky, 'hunter-hands', HANDS_MATERIAL);
    coatMat ??= viewmodelMaterial(sky, 'hunter-coat', coatMaterialParams());
    return new WeaponHands(HUNTER_HANDS, model, handsMat, holdDef(CROSSBOW_HAND_HOLDS.left), holdDef(CROSSBOW_HAND_HOLDS.right), coatMat);
  };
}

/** The crossbow's hands and their coat's canvas built ahead of `new Crossbow` (SF67), a task apart (`due`): the same
 *  geometry and textures its constructor would build in one stretch. */
export async function prepareCrossbowHands(due: () => Promise<void> | null): Promise<void> {
  coatTextures();
  const wait = due(); if (wait !== null) await wait;
  await prepareWeaponHands(HUNTER_HANDS, CROSSBOW_HAND_HOLDS.left, CROSSBOW_HAND_HOLDS.right, due);
}

/** Pine's crossbow: the row bound to the platform's bolt crossbow (`new Crossbow(world, targets, { row })`). */
export const Crossbow = crossbowType({ profile: CROSSBOW_PROFILE, parts: buildCrossbow, hands: crossbowHands, flight: boltFlightStep, view: CROSSBOW_VIEW });
/** A built Pine crossbow. */
export type CrossbowWeapon = BoltCrossbowWeapon<CrossbowProfile>;
