import { viewmodelMaterial, viewmodelTexSet, box, cyl, stripExtra, type TexSet } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { magazineFirearmType, type MagazineFirearmRowOptions, type MagazineFirearmView, type MagazineFirearmWeapon } from '@wildshard/sdk/items/magazineFirearm';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';
import { AR15 } from '../../data/firearmProfile';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The rifle's construction: its equipment row, an optional profile over AR15 and the muzzle light (default on; a shard
 * where the rifle can't be found passes false: its flash is the quads only and every lit program there keeps one point
 * light fewer).
 */
export type RifleOptions = MagazineFirearmRowOptions<FirearmProfile>;

/**
 * Rifle — AR-15 style semi-automatic carbine: the platform's magazine firearm (`@wildshard/sdk/items/magazineFirearm`,
 * SHARD-PLATFORM SF36) over this file's procedural model (`buildRifleParts`), the AR15 profile row and `RIFLE_VIEW`.
 * Procedural viewmodel from primitives: flat-top upper + lower receiver, free-float handguard under a full-length
 * Picatinny rail, 14.5" barrel with an A2 flash hider, gas block with a fixed front post between ears, flip-up rear ghost
 * ring, charging handle, forward assist, dust cover, 30-round PMAG, pistol grip, collapsible stock on a buffer tube. Dark
 * anodised aluminium + black polymer + steel, all on the viewmodels' shared lit material, so the rifle compiles no program
 * of its own.
 *
 *   const rifle = new Rifle({ game, sky, player, forest }, targets, { row: AR15, allowUnlocked });
 *
 * Semi-auto: one round per click / tap / `F`, 30-round magazine + 90 in reserve, reload on `R` or automatically when the
 * trigger is pulled on an empty mag; hitscan along the camera forward. ADS = shouldered iron sights: the front post sits
 * centred in the ghost ring, both on the crosshair. FOV 72 → 58 (1.3× zoom, Hor+ on portrait).
 */
export type RifleWeapon = MagazineFirearmWeapon<FirearmProfile>;

/** sight line height over the bore (m): the front post tip and the rear aperture centre both sit here */
const SIGHT_Y = 0.064;
const REAR_Z = 0.10, FRONT_Z = -0.455, MUZZLE_Z = -0.645;
const SIGHT_CYAN = 0x8fe3ff;

/** The AR-15's view: the hip pose, the ejection port, the 5.56 case, a two-frame flash with a 50 ms light, a 90 ms tracer. */
export const RIFLE_VIEW: MagazineFirearmView = {
  hip: { px: 0.13, py: -0.115, pz: -0.38, rx: 0.03, ry: 0.08, rz: 0.03, scale: 1.0 },
  port: [0.03, 0.008, 0.0],
  brassCase: [0.0047, 0.045],
  flash: { frames: 2, lightTime: 0.05, light: 30, colour: 0xffb060, size: 0.22 },
  tracer: 0.09,
};

/**
 * The AR-15's parts in model space (−Z the bore, +Y up, the bore axis at y 0; the receiver z −0.10 … +0.13, the muzzle at
 * MUZZLE_Z), every one on the viewmodels' shared lit program: the aluminium, polymer and steel meshes, the charging handle,
 * the bolt and the magazine (the three the viewmodel animates; the magazine at `magRest`), the rear ghost ring's glow (hidden:
 * shown sighted) and the ejected brass's material. The viewmodel's build and the Model Explorer's card (src/engine/models/gear.ts)
 * are this one function, so the two never drift; the geometries need white vertex colours (`whiteColors`) before a draw.
 */
export interface RifleParts {
  readonly alu: THREE.Mesh; readonly poly: THREE.Mesh; readonly steel: THREE.Mesh;
  readonly handle: THREE.Mesh; readonly bolt: THREE.Mesh; readonly mag: THREE.Mesh; readonly magRest: THREE.Vector3;
  readonly glowRing: THREE.Mesh; readonly glow: THREE.MeshBasicMaterial;
  readonly aluMat: THREE.MeshPhysicalMaterial; readonly polyMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial; readonly brassMat: THREE.MeshPhysicalMaterial;
}
export function buildRifleParts(sky: Sky): RifleParts {
  const alu = viewmodelTexSet('anodised'), poly = viewmodelTexSet('polymer'), steel = viewmodelTexSet('gunmetal'); // drawn in a worker during the boot (Crossbow.ts startViewmodelTextures)
  alu.map.repeat.set(3, 1); alu.normalMap.repeat.set(3, 1); alu.armMap.repeat.set(3, 1);
  steel.map.repeat.set(2, 2); steel.normalMap.repeat.set(2, 2); steel.armMap.repeat.set(2, 2);
  // no program of its own: every material is the viewmodels' shared lit one (Crossbow.viewmodelMaterial — MeshPhysical
  // at Standard-equivalent defaults, vertex colours, the five map slots with the ARM feeding ao/rough/metal), the
  // crossbow's program; the meshes get white vertex colours where they are drawn (the viewmodel's traverse). The ejected
  // brass (opaque, in the world) is the one opaque variant of it.
  const std = (name: string, t: TexSet, extra: THREE.MeshPhysicalMaterialParameters) => viewmodelMaterial(sky, name, { map: t.map, normalMap: t.normalMap, aoMap: t.armMap, roughnessMap: t.armMap, metalnessMap: t.armMap, roughness: 1, metalness: 1, ...extra });
  const aluMat = std('rifle-alu', alu, { normalScale: new THREE.Vector2(0.6, 0.6), color: new THREE.Color(0.9, 0.9, 0.92), envMapIntensity: 0.55 });
  const polyMat = std('rifle-poly', poly, { normalScale: new THREE.Vector2(0.8, 0.8), color: new THREE.Color(0.95, 0.95, 0.95), envMapIntensity: 0.35 });
  const steelMat = std('rifle-steel', steel, { normalScale: new THREE.Vector2(0.5, 0.5), color: new THREE.Color(0.4, 0.4, 0.42), roughness: 1.2, envMapIntensity: 0.7 });
  const brassMat = std('rifle-brass', steel, { normalScale: new THREE.Vector2(0.3, 0.3), color: new THREE.Color(0.95, 0.68, 0.32), roughness: 0.9, envMapIntensity: 1.0 });

  // model space: -Z forward (bore), +Y up, bore axis at y = 0; receiver z -0.10 … +0.13, muzzle at MUZZLE_Z
  const A: THREE.BufferGeometry[] = [], P: THREE.BufferGeometry[] = [], S: THREE.BufferGeometry[] = [];
  // ── upper receiver + rail ──
  A.push(box(0.05, 0.055, 0.22, 0, 0.0075, 0.01));
  A.push(box(0.021, 0.008, 0.56, 0, 0.039, -0.16)); // full-length Picatinny rail base
  for (let z = -0.43; z < 0.11; z += 0.023) A.push(box(0.021, 0.004, 0.011, 0, 0.045, z)); // rail teeth
  A.push(box(0.02, 0.012, 0.03, 0, 0.026, 0.115)); // rear of the upper, over the charging handle
  // ── handguard: octagonal free-float tube with M-LOK slots (polymer inserts) ──
  A.push(cyl(0.024, 0.024, 0.33, 8, 0, 0, -0.265, Math.PI / 2, 0, 0));
  for (let z = -0.16; z > -0.40; z -= 0.045) { P.push(box(0.004, 0.024, 0.032, -0.0235, 0, z)); P.push(box(0.004, 0.024, 0.032, 0.0235, 0, z)); P.push(box(0.024, 0.004, 0.032, 0, -0.0235, z)); }
  A.push(cyl(0.028, 0.028, 0.03, 12, 0, 0, -0.10, Math.PI / 2, 0, 0)); // barrel nut
  // ── barrel, gas block, flash hider ──
  S.push(cyl(0.0095, 0.0095, 0.19, 10, 0, 0, -0.525, Math.PI / 2, 0, 0));
  A.push(box(0.024, 0.03, 0.03, 0, 0.018, FRONT_Z)); // gas block
  S.push(cyl(0.0125, 0.0125, 0.055, 10, 0, 0, MUZZLE_Z + 0.0275, Math.PI / 2, 0, 0)); // A2 birdcage
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.6; P.push(box(0.003, 0.004, 0.03, Math.cos(a) * 0.0125, Math.sin(a) * 0.0125, MUZZLE_Z + 0.022, 0, 0, a)); } // hider slots
  // ── front sight: tower + post between ears (post tip exactly on the sight line) ──
  A.push(box(0.012, 0.02, 0.018, 0, 0.043, FRONT_Z));
  for (const sx of [-1, 1]) A.push(box(0.003, 0.03, 0.012, sx * 0.0095, 0.062, FRONT_Z));
  S.push(box(0.0035, SIGHT_Y - 0.047, 0.0035, 0, (SIGHT_Y + 0.047) / 2, FRONT_Z)); // the post: 0.047 → SIGHT_Y
  // ── lower receiver, mag well, trigger guard + trigger, selector, mag release ──
  A.push(box(0.048, 0.055, 0.19, 0, -0.0475, 0.035));
  A.push(box(0.032, 0.035, 0.078, 0, -0.0925, -0.045));
  A.push(box(0.008, 0.003, 0.065, 0, -0.108, 0.03)); // trigger guard bar
  A.push(box(0.008, 0.02, 0.003, 0, -0.098, -0.002)); A.push(box(0.008, 0.02, 0.003, 0, -0.098, 0.062)); // guard ends
  S.push(box(0.005, 0.022, 0.004, 0, -0.088, 0.024, 0.25, 0, 0)); // trigger
  A.push(box(0.004, 0.006, 0.03, -0.026, -0.028, 0.06)); // selector (left)
  A.push(cyl(0.005, 0.005, 0.006, 8, 0.026, -0.045, -0.005, 0, 0, Math.PI / 2)); // mag release (right)
  // ── right side: dust cover, brass deflector, forward assist ──
  A.push(box(0.003, 0.02, 0.06, 0.0265, 0.005, -0.012));
  A.push(box(0.012, 0.028, 0.02, 0.03, 0.006, 0.03));
  S.push(cyl(0.007, 0.007, 0.018, 8, 0.031, 0.002, 0.07, 0, 0, Math.PI / 2));
  // ── buffer tube, castle nut, stock (polymer) ──
  A.push(cyl(0.016, 0.016, 0.2, 10, 0, 0.006, 0.23, Math.PI / 2, 0, 0));
  A.push(cyl(0.02, 0.02, 0.01, 10, 0, 0.006, 0.135, Math.PI / 2, 0, 0));
  P.push(box(0.04, 0.045, 0.14, 0, -0.004, 0.30));
  P.push(box(0.036, 0.018, 0.12, 0, 0.026, 0.30)); // cheek riser
  P.push(box(0.036, 0.05, 0.05, 0, -0.045, 0.345)); // toe
  P.push(box(0.042, 0.11, 0.018, 0, -0.02, 0.37)); // butt pad
  // ── pistol grip (polymer), raked back ──
  P.push(box(0.028, 0.1, 0.038, 0, -0.125, 0.13, -0.35, 0, 0));
  // ── charging handle (steel, animated), bolt carrier glimpse behind the dust cover ──
  const handleGeo = mergeGeometries([stripExtra(box(0.05, 0.008, 0.02, 0, 0.022, 0.135)), stripExtra(box(0.012, 0.008, 0.11, 0, 0.022, 0.07))], false);
  const handle = new THREE.Mesh(handleGeo, steelMat);
  const bolt = new THREE.Mesh(box(0.014, 0.014, 0.06, 0.022, 0.005, -0.012), steelMat);
  // ── magazine (polymer, animated on reload) ──
  const magGeo = mergeGeometries([stripExtra(box(0.024, 0.19, 0.07, 0, -0.095, 0, 0.12, 0, 0)), stripExtra(box(0.027, 0.01, 0.075, 0, -0.19, -0.022, 0.12, 0, 0))], false);
  const mag = new THREE.Mesh(magGeo, polyMat);
  const magRest = new THREE.Vector3(0, -0.105, -0.045);
  mag.position.copy(magRest);
  // ── rear sight: flip-up base + ghost ring on the sight line, protective ears ──
  A.push(box(0.024, 0.012, 0.03, 0, 0.049, REAR_Z));
  for (const sx of [-1, 1]) A.push(box(0.003, 0.024, 0.006, sx * 0.011, 0.066, REAR_Z));
  A.push(box(0.004, 0.012, 0.004, 0, 0.058, REAR_Z));
  const ring = new THREE.TorusGeometry(0.0062, 0.0013, 6, 22); ring.translate(0, SIGHT_Y, REAR_Z); A.push(ring);
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(SIGHT_CYAN), toneMapped: false, fog: false, opacity: 0.85 });
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.0049, 0.00025, 4, 22), glow); glowRing.position.set(0, SIGHT_Y, REAR_Z);
  glowRing.visible = false;

  const meshA = new THREE.Mesh(mergeGeometries(A.map(stripExtra), false), aluMat);
  const meshP = new THREE.Mesh(mergeGeometries(P.map(stripExtra), false), polyMat);
  const meshS = new THREE.Mesh(mergeGeometries(S.map(stripExtra), false), steelMat);
  return { alu: meshA, poly: meshP, steel: meshS, handle, bolt, mag, magRest, glowRing, glow, aluMat, polyMat, steelMat, brassMat };
}

/** The AR-15 as a row over the platform's magazine firearm: the AR15 profile (or `opts.profile`), its parts and `RIFLE_VIEW`. */
export const Rifle = magazineFirearmType<FirearmProfile>({ profile: AR15, parts: buildRifleParts, view: RIFLE_VIEW });
