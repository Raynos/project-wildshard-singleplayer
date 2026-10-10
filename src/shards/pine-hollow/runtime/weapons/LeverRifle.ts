import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { viewmodelMaterial, viewmodelTexSet, whiteColors, edgeWear, box, cyl, stripExtra, isMesh, type TexSet } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { leverFirearmType, type LeverFirearmBuild, type LeverFirearmHandsKit, type LeverFirearmView, type LeverFirearmWeapon } from '@wildshard/sdk/items/leverFirearm';
import type { FirearmProfile } from '@wildshard/sdk/weapons/firearmProfile';
import { BUCKSKIN, HANDS_MATERIAL, WeaponHands, blendGrip, gripPose, holdDef, type HandHold } from '../../weapons/hunterHands';
import { AUTO_RELOAD_DELAY, LEVER_PROFILE, LeverAction, MAGAZINE, RELOAD_IN, RELOAD_OUT, RESERVE_START, ROUND_TIME } from '../../weapons/leverAction';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * LeverRifle — Pine Hollow's rifle (PINE-HOLLOW-REMASTER PH-U5 / PH-C11), a row over the platform's lever firearm
 * (`@wildshard/sdk/items/leverFirearm`, SHARD-PLATFORM SF36: this file is the model, the cartridge, the hands, the view and
 * the binding; the action is weapons/leverAction.ts): a 1900s backwoods lever-action carbine in the
 * Winchester 1894 mould, replacing the AR-15 on Pine Hollow only (Driftwood and the dev harnesses keep Rifle.ts). It fills
 * the same kit slot (`id 'rifle'`: the cabin pickup, Old Ironhide's skin, the trader's Scarback Furnace finish) and the
 * same `KitWeapon` contract, so Weapons.ts / the HUD / Combat / the feel hooks need nothing new.
 *
 *   const rifle = new LeverRifle({ game, sky, player, forest }, targets, { allowUnlocked, woodFrom: crossbow.model });
 *   weapons = new Weapons(crossbow, rifle, [...]);   // the manager calls setActive / update / drives `holster`
 *   rifle.onCycle = () => sfx.shot('leverCycle')     // the lever thrown (after every shot, and to chamber after a reload)
 *   rifle.onRoundIn = () => …                        // one cartridge thumbed through the loading gate
 *
 * The model (PH-C11 remaster) is modelled + baked in Blender (scripts/blender/pine-hollow/weapons/lever_rifle.py, built by scripts/blender/build.sh) and loaded
 * from `LEVER_MODEL_URL` (meshopt, WebP atlases; the phone tier's `.phone.glb` through tierUrl — ≈ 8 k tris + 1024²
 * atlases desktop, ≈ 4 k + 512² phone): a colour-case-hardened receiver (the bolt in its top channel, the loading gate on
 * the right), the hammer + spur, a round tapered barrel with a crowned muzzle over the magazine tube, the forend band and
 * the carbine's barrel band, the loop lever, the trigger, the tangs, an oiled-walnut forend and straight-grip stock with a
 * crescent buttplate, a semi-buckhorn rear sight on its base, the front ramp + blade (the gold bead stays this file's
 * sphere, the aim reference). `preloadLeverModel()` (main.ts, awaited by the weapon step) fetches it; `?rifle=proc` — or a
 * failed load — keeps the procedural build below (thin parts: image-to-3D mangles a 9 mm barrel and a lever loop). Either
 * way the same parts (the static steel, the forend, the stock, the lever / hammer about their pivots, the bolt), the same
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
  /** a viewmodel to borrow the walnut from (the crossbow's 'xbow-wood' textures, shared on the GPU); absent = drawn here.
   *  The procedural build's only. */
  woodFrom?: THREE.Object3D | null;
  /** the Blender model to build from; absent = whatever `preloadLeverModel()` has delivered, null = the procedural build */
  model?: LeverModel | null;
}

const KICK_PITCH = THREE.MathUtils.degToRad(1.25);
const FLASH_FRAMES = 2, FLASH_LIGHT_TIME = 0.06, FLASH_LIGHT = 34;
const BRASS_COUNT = 4, BRASS_LIFE = 1.8;
const TRACER_COUNT = 2, TRACER_TIME = 0.09;
const ADS_MOTION = 0.3;
/** the lever's throw (rad about X at its pivot), the bolt's travel (m), the hammer down / cocked (rad) */
const LEVER_OPEN = 0.92, BOLT_TRAVEL = 0.058, HAMMER_DOWN = -0.12, HAMMER_COCKED = 0.5;

// model space: −Z along the bore, +Y up, the bore axis at y = 0
/** sight line height over the bore: the gold bead's centre and the buckhorn notch's floor */
export const SIGHT_Y = 0.045;
/** the eye on the comb, the buckhorn 45 cm ahead of it (a carbine's eye relief); the sights stand on raised bases, the
 *  line higher over the receiver than a real 1894's, so the receiver's top and the wrist sit low in the frame, not across the view */
const EYE_Z = 0.36;
const REAR_Z = -0.13, FRONT_Z = -0.512, MUZZLE_Z = -0.535;
const RECV_F = -0.035, RECV_B = 0.14;
const LEVER_PIVOT = new THREE.Vector3(0, -0.047, -0.018);
const HAMMER_PIVOT = new THREE.Vector3(0, -0.006, 0.122);
const GATE = new THREE.Vector3(0.0158, -0.024, 0.028);
/** the Blender model's receiver is 16 mm shallower (a real 1894's proportions): its lever pivot and loading gate sit higher */
const MODEL_LEVER_PIVOT = new THREE.Vector3(0, -0.031, -0.018);
const MODEL_GATE = new THREE.Vector3(0.0158, -0.021, 0.028);
const PORT = new THREE.Vector3(0.0, 0.026, 0.045);
const BEAD_R = 0.0055;
/** how much of the lever's throw the right hand turns with (its fist rides the loop all the way) */
const HAND_TURN = 0.6;


// ───────────────────────────── the Blender model ─────────────────────────────

/** scripts/blender/build.sh pine-hollow/lever-rifle's output; the phone tier gets `lever-rifle.phone.glb` (tierUrl, the loaders' URL modifier) */
export const LEVER_MODEL_URL = '/assets/pine-hollow/weapons/lever-rifle.glb';
/** the GLB's meshes: the static steel, the forend, the stock (hidden sighted), the lever + hammer (each about its pivot), the bolt */
const MODEL_PARTS = ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt'] as const;
type ModelPart = (typeof MODEL_PARTS)[number];
/** the loaded model: plain float geometry per part (model space, as the procedural build's) + the two atlases */
export interface LeverModel { geo: Record<ModelPart, THREE.BufferGeometry>; steel: TexSet; wood: TexSet }
let modelLoad: Promise<LeverModel | null> | null = null;
let modelReady: LeverModel | null = null;

/** Fetch + decode the Blender model once (main.ts starts it early; the weapon step awaits it). null = the procedural build. */
export function preloadLeverModel(): Promise<LeverModel | null> {
  modelLoad ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(LEVER_MODEL_URL)
    .then((gltf) => {
      const ready = retainCachedResources(parseLeverModel(gltf.scene)); modelReady = ready;
      cacheUntilDisposed(ready, () => { if (modelReady === ready) { modelReady = null; modelLoad = null; } });
      return ready;
    })
    .catch((e: unknown) => { console.warn('[lever-action] the Blender model did not load — the procedural build stands in:', e); return null; });
  return modelLoad;
}

/** one GLB mesh as plain float geometry: meshopt's quantised streams decoded, its node's dequantising transform applied,
 *  only what the viewmodel program reads (position, normal, uv; the colour attribute is added white by the constructor) */
function plainGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) throw new Error(`[lever-action] ${mesh.name}: no ${name}`);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i);
      if (size > 2) out[i * size + 2] = a.getZ(i);
    }
    return out;
  };
  g.setAttribute('position', new THREE.BufferAttribute(copy('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(copy('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2), 2));
  const idx = src.getIndex();
  if (!idx) throw new Error(`[lever-action] ${mesh.name}: not indexed`);
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/** the atlas a GLB mesh's material carries: albedo, normal, ARM (the glTF's occlusion + metallic-roughness image) */
function atlasOf(mesh: THREE.Mesh): TexSet {
  const m = mesh.material;
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) throw new Error(`[lever-action] ${mesh.name}: not a PBR material`);
  const { map, normalMap, roughnessMap } = m;
  if (map === null || normalMap === null || roughnessMap === null) throw new Error(`[lever-action] ${mesh.name}: an atlas map is missing`);
  for (const t of [map, normalMap, roughnessMap]) { t.anisotropy = 8; t.needsUpdate = true; }
  return { map, normalMap, armMap: roughnessMap };
}

function parseLeverModel(root: THREE.Object3D): LeverModel {
  root.updateMatrixWorld(true);
  const meshes = new Map<string, THREE.Mesh>();
  root.traverse((o) => { if (isMesh(o)) meshes.set(o.name, o); });
  const need = (p: ModelPart): THREE.Mesh => {
    const m = meshes.get(p);
    if (!m) throw new Error(`[lever-action] ${LEVER_MODEL_URL} has no mesh '${p}'`);
    return m;
  };
  // the atlases first (plainGeometry disposes the GLB's own buffers)
  const steel = atlasOf(need('steel')), wood = atlasOf(need('forend'));
  const geo: Record<ModelPart, THREE.BufferGeometry> = {
    steel: plainGeometry(need('steel')), forend: plainGeometry(need('forend')), stock: plainGeometry(need('stock')),
    lever: plainGeometry(need('lever')), hammer: plainGeometry(need('hammer')), bolt: plainGeometry(need('bolt')),
  };
  return { geo, steel, wood };
}

/** a build's parts, in model space (the lever / hammer about their pivots) */
interface LeverParts { wood: THREE.BufferGeometry; stock: THREE.BufferGeometry; steel: THREE.BufferGeometry; lever: THREE.BufferGeometry; hammer: THREE.BufferGeometry; bolt: THREE.BufferGeometry; leverPivot: THREE.Vector3; gate: THREE.Vector3 }

/** a lever-action build: its three materials (the viewmodels' shared lit program) and its parts in model space — the
 *  Blender model's when it is in, else the procedural build (its walnut borrowed from `woodFrom`) — and the gold bead */
interface LeverBuild { readonly brassMat: THREE.MeshPhysicalMaterial; readonly woodMat: THREE.MeshPhysicalMaterial; readonly steelMat: THREE.MeshPhysicalMaterial; readonly parts: LeverParts; readonly beadGeo: THREE.BufferGeometry }
/** The viewmodel's build and the Model Explorer's card (`leverSpecimen`) are this one function, so the two never drift. */
function buildLever(sky: Sky, model: LeverModel | null, woodFrom: THREE.Object3D | null): LeverBuild {
  // ── materials: the viewmodels' shared lit program (MeshPhysical + vertex colours + the five map slots) ──
  const std = (name: string, t: TexSet, extra: THREE.MeshPhysicalMaterialParameters) => viewmodelMaterial(sky, name, { map: t.map, normalMap: t.normalMap, aoMap: t.armMap, roughnessMap: t.armMap, metalnessMap: t.armMap, roughness: 1, metalness: 1, ...extra });
  const steelTex = viewmodelTexSet('gunmetal'); // the brass's (the cartridges' tiled UVs), and the procedural build's steel
  for (const t of [steelTex.map, steelTex.normalMap, steelTex.armMap]) t.repeat.set(2, 2);
  const brassMat = std('lever-brass', steelTex, { normalScale: new THREE.Vector2(0.25, 0.25), color: new THREE.Color(0.95, 0.7, 0.34), roughness: 0.75, envMapIntensity: 1.1 });
  let woodMat: THREE.MeshPhysicalMaterial, steelMat: THREE.MeshPhysicalMaterial, parts: LeverParts;
  if (model) {
    // the baked atlases carry the colour, the AO and the roughness / metalness: the factors stay 1 (the skins set theirs);
    // glTF's v runs down the image, so the normal map's green is flipped (three's GLTFLoader does the same)
    woodMat = std('lever-wood', model.wood, { normalScale: new THREE.Vector2(0.9, -0.9), envMapIntensity: 0.55, specularIntensity: 0.55 });
    steelMat = std('lever-steel', model.steel, { normalScale: new THREE.Vector2(0.8, -0.8), envMapIntensity: 0.95 });
    const g = model.geo;
    parts = { wood: g.forend, stock: g.stock, steel: g.steel, lever: g.lever, hammer: g.hammer, bolt: g.bolt, leverPivot: MODEL_LEVER_PIVOT, gate: MODEL_GATE };
  } else {
    const wood = borrowWood(woodFrom);
    for (const t of [wood.map, wood.normalMap, wood.armMap]) t.repeat.set(1.6, 0.9);
    woodMat = std('lever-wood', wood, { normalScale: new THREE.Vector2(0.8, 0.8), color: new THREE.Color(0.62, 0.47, 0.36), metalness: 0, roughness: 0.8, envMapIntensity: 0.5, specularIntensity: 0.45 });
    steelMat = std('lever-steel', steelTex, { normalScale: new THREE.Vector2(0.45, 0.45), color: new THREE.Color(0.1, 0.105, 0.12), roughness: 0.95, envMapIntensity: 0.7 });
    parts = proceduralParts();
  }

  // the gold bead (both builds): the aim reference, on the sight line; it catches the light — a vertex colour over 1
  // brightens it on the shared program (no emissive, no new draw)
  const beadGeo = new THREE.SphereGeometry(BEAD_R, 12, 10); beadGeo.translate(0, SIGHT_Y, FRONT_Z - 0.0035);
  beadGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(beadGeo.getAttribute('position').count * 3).fill(2.2), 3));
  return { brassMat, woodMat, steelMat, parts, beadGeo };
}

/**
 * The Model Explorer's card (src/shards/pine-hollow/models/gear.ts): the lever-action as the cabin pickup shows it — the
 * seven parts, the hammer down — built by `buildLever` on its own materials and its own copy of the model's geometry, so
 * nothing of the rifle in your hands is shared or touched. `model`: `await preloadLeverModel()` (null: the procedural build).
 */
export function leverSpecimen(sky: Sky, model: LeverModel | null): THREE.Group {
  const { brassMat, woodMat, steelMat, parts, beadGeo } = buildLever(sky, model, null);
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos?: THREE.Vector3, rotX = 0): void => {
    const m = new THREE.Mesh(model === null ? geo : geo.clone(), mat); // the loaded model's geometry is the held rifle's: a copy
    whiteColors(m.geometry);
    if (pos) m.position.copy(pos);
    m.rotation.x = rotX;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  };
  add(parts.wood, woodMat); add(parts.stock, woodMat); add(parts.steel, steelMat); add(beadGeo, brassMat);
  add(parts.lever, steelMat, parts.leverPivot); add(parts.hammer, steelMat, HAMMER_PIVOT, HAMMER_DOWN); add(parts.bolt, steelMat);
  return g;
}

/** The procedural lever-action (the build before the Blender model; `?rifle=proc`, or the model failed to load) */
function proceduralParts(): LeverParts {
  const W: THREE.BufferGeometry[] = [], S: THREE.BufferGeometry[] = [];
  let stockGeo: THREE.BufferGeometry;
  // ── receiver: a flat-sided block, rounded on top at the back, the lower tang running back under the wrist ──
  {
    const sh = new THREE.Shape(); // x = forward (→ −Z), y = up
    sh.moveTo(-RECV_F, 0.021);
    sh.lineTo(-0.07, 0.021);
    sh.quadraticCurveTo(-0.118, 0.021, -0.132, 0.008);
    sh.lineTo(-RECV_B, -0.002);
    sh.lineTo(-RECV_B - 0.05, -0.004); // upper tang
    sh.lineTo(-RECV_B - 0.05, -0.012);
    sh.lineTo(-RECV_B, -0.014);
    sh.lineTo(-RECV_B, -0.046);
    sh.lineTo(-RECV_B - 0.07, -0.05); // lower tang (the trigger plate)
    sh.lineTo(-RECV_B - 0.07, -0.058);
    sh.lineTo(-0.06, -0.056);
    sh.quadraticCurveTo(-RECV_F + 0.004, -0.056, -RECV_F, -0.046);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 8 });
    g.rotateY(Math.PI / 2); g.translate(-0.014, 0, 0);
    S.push(g);
  }
  // the loading gate (right side), its screw, the side-plate screws, the saddle-ring stud (left)
  S.push(box(0.0022, 0.017, 0.034, GATE.x, GATE.y, GATE.z));
  for (const [y, z] of [[-0.008, 0.02], [-0.03, 0.095], [0.004, -0.02]] as const) for (const sx of [-1, 1]) S.push(cyl(0.0028, 0.0028, 0.002, 10, sx * 0.0156, y, z, 0, 0, Math.PI / 2));
  // ── barrel (a little taper) + the muzzle crown; the magazine tube under it with its end cap ──
  S.push(cyl(0.0098, 0.0089, RECV_F - MUZZLE_Z, 14, 0, 0, (RECV_F + MUZZLE_Z) / 2, Math.PI / 2, 0, 0)); // cyl's top end lands at +Z (the breech)
  S.push(cyl(0.0094, 0.0094, 0.004, 14, 0, 0, MUZZLE_Z + 0.002, Math.PI / 2, 0, 0));
  S.push(cyl(0.0079, 0.0079, 0.445, 12, 0, -0.0192, -0.26, Math.PI / 2, 0, 0));
  S.push(cyl(0.0084, 0.0084, 0.012, 12, 0, -0.0192, -0.484, Math.PI / 2, 0, 0));
  // the carbine barrel band (round over the barrel, round under the tube) and the forend cap
  for (const [z, d] of [[-0.462, 0.011], [-0.272, 0.013]] as const) {
    S.push(cyl(0.0112, 0.0112, d, 14, 0, 0, z, Math.PI / 2, 0, 0));
    S.push(cyl(0.0101, 0.0101, d, 12, 0, -0.0192, z, Math.PI / 2, 0, 0));
    S.push(box(0.0215, 0.0192, d, 0, -0.0096, z));
  }
  // ── the rear sight: a raised base, the semi-buckhorn leaf with its U notch and ears. The notch floor sits under the
  //    sight line by the bead's radius as the eye sees it, so the whole gold bead sits ON the floor, its centre on the aim ──
  {
    S.push(box(0.011, 0.018, 0.03, 0, 0.0165, REAR_Z)); // the raised base
    const floor = SIGHT_Y - BEAD_R * (EYE_Z - REAR_Z) / (EYE_Z - FRONT_Z);
    const leafBot = 0.024, notchW = 0.0074, earTop = SIGHT_Y + 0.0065;
    S.push(box(0.026, floor - leafBot, 0.0022, 0, (floor + leafBot) / 2, REAR_Z)); // up to the notch floor
    for (const sx of [-1, 1]) {
      const x0 = notchW / 2, x1 = 0.013;
      S.push(box(x1 - x0, earTop - floor, 0.0022, sx * (x0 + x1) / 2, (earTop + floor) / 2, REAR_Z));
      S.push(box(0.004, 0.006, 0.0022, sx * 0.0142, earTop + 0.0018, REAR_Z, 0, 0, sx * -0.55)); // the buckhorn's ear
    }
    S.push(box(0.012, 0.004, 0.018, 0, 0.0238, REAR_Z + 0.02)); // the elevator
  }
  // ── the front sight: a ramp, a blade, the gold bead on the sight line ──
  S.push(box(0.008, 0.024, 0.032, 0, 0.02, FRONT_Z + 0.006, -0.12, 0, 0)); // the ramp
  S.push(box(0.0028, SIGHT_Y - 0.03, 0.011, 0, (SIGHT_Y + 0.03) / 2, FRONT_Z)); // the blade
  // ── trigger + the lower tang's guard notch ──
  { const trig = new THREE.TorusGeometry(0.014, 0.0026, 8, 12, Math.PI * 0.55); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.5); trig.translate(0, -0.056, 0.13); S.push(trig); }
  // ── walnut: the forend (rounded section under the barrel + tube) and the straight-grip stock ──
  {
    const fw = 0.0175, fh = 0.019, fr = 0.009, fs = new THREE.Shape();
    fs.moveTo(-fw + fr, -fh); fs.lineTo(fw - fr, -fh); fs.quadraticCurveTo(fw, -fh, fw, -fh + fr); fs.lineTo(fw, fh - 0.004); fs.lineTo(-fw, fh - 0.004); fs.lineTo(-fw, -fh + fr); fs.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
    const fore = new THREE.ExtrudeGeometry(fs, { depth: 0.23, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 6 });
    fore.translate(0, -0.0165, -0.266); // z −0.266 … −0.036
    W.push(fore);
    const st = new THREE.Shape(); // x = forward (→ −Z), y = up
    st.moveTo(-RECV_B + 0.002, -0.004);
    st.lineTo(-0.2, 0.0);
    st.quadraticCurveTo(-0.29, 0.004, -0.49, -0.012); // the comb falls a touch to the heel
    st.lineTo(-0.5, -0.016);
    st.lineTo(-0.5, -0.128);                           // the butt
    st.lineTo(-0.47, -0.128);
    st.quadraticCurveTo(-0.33, -0.088, -0.232, -0.06); // the belly up to the wrist
    st.lineTo(-RECV_B - 0.066, -0.056);
    st.lineTo(-RECV_B + 0.002, -0.046);
    st.closePath();
    const stock = new THREE.ExtrudeGeometry(st, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.0055, bevelSize: 0.0045, bevelSegments: 3, curveSegments: 10 });
    stock.rotateY(Math.PI / 2); stock.translate(-0.015, 0, 0);
    stockGeo = stripExtra(stock);
  }
  // the steel butt plate, its two screws
  S.push(box(0.04, 0.114, 0.006, 0, -0.072, 0.503));
  for (const y of [-0.03, -0.11]) S.push(cyl(0.003, 0.003, 0.002, 10, 0, y, 0.507, Math.PI / 2, 0, 0));

  const woodGeo = mergeGeometries(W.map(stripExtra), false); edgeWear(woodGeo, 0.22);
  edgeWear(stockGeo, 0.22);
  const steelGeo = mergeGeometries(S.map(stripExtra), false);
  const L: THREE.BufferGeometry[] = [];
  L.push(box(0.009, 0.0065, 0.108, 0, -0.004, 0.058)); // the bar under the receiver, pivot → the loop
  const loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.004, 0.105), new THREE.Vector3(0, -0.024, 0.118), new THREE.Vector3(0, -0.046, 0.142), new THREE.Vector3(0, -0.058, 0.18),
    new THREE.Vector3(0, -0.052, 0.214), new THREE.Vector3(0, -0.036, 0.222), new THREE.Vector3(0, -0.02, 0.2), new THREE.Vector3(0, -0.006, 0.168),
  ], false, 'catmullrom', 0.5);
  L.push(new THREE.TubeGeometry(loop, 28, 0.0036, 8, false));
  L.push(cyl(0.0052, 0.0052, 0.012, 12, 0, 0, 0, 0, 0, Math.PI / 2)); // the pivot boss
  const leverGeo = mergeGeometries(L.map(stripExtra), false);
  const H: THREE.BufferGeometry[] = [];
  H.push(box(0.007, 0.03, 0.01, 0, 0.012, 0.004, -0.2, 0, 0));
  H.push(box(0.009, 0.006, 0.02, 0, 0.028, 0.014, 0.35, 0, 0)); // the spur
  for (let k = 0; k < 4; k++) H.push(box(0.0092, 0.0012, 0.0016, 0, 0.0312, 0.008 + k * 0.004, 0.35, 0, 0)); // chequering
  const hammerGeo = mergeGeometries(H.map(stripExtra), false);
  const boltGeo = mergeGeometries([stripExtra(box(0.013, 0.0085, 0.075, 0, 0.0215, 0.068)), stripExtra(box(0.004, 0.003, 0.05, 0, 0.0265, 0.07))], false);
  return { wood: woodGeo, stock: stockGeo, steel: steelGeo, lever: leverGeo, hammer: hammerGeo, bolt: boltGeo, leverPivot: LEVER_PIVOT, gate: GATE };
}

/** a .30-30 cartridge (tip at −Z, 6.8 cm long); `live` has the bullet, an empty is the case alone */
function cartridgeGeometry(live: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(0.0053, 0.0053, 0.0015, 10, 0, 0, 0.0255, Math.PI / 2, 0, 0)); // the rim
  parts.push(cyl(0.0052, 0.0054, 0.036, 10, 0, 0, 0.007, Math.PI / 2, 0, 0));
  parts.push(cyl(0.0042, 0.0052, 0.008, 10, 0, 0, -0.015, Math.PI / 2, 0, 0)); // the shoulder
  parts.push(cyl(0.0042, 0.0042, 0.006, 10, 0, 0, -0.022, Math.PI / 2, 0, 0)); // the neck
  if (live) { parts.push(cyl(0.0022, 0.0039, 0.014, 10, 0, 0, -0.032, Math.PI / 2, 0, 0)); parts.push(cyl(0.0015, 0.0022, 0.003, 8, 0, 0, -0.0405, Math.PI / 2, 0, 0)); } // the flat-nose bullet
  const g = mergeGeometries(parts.map(stripExtra), false);
  whiteColors(g);
  return g;
}

/** the crossbow's walnut textures, cloned (the GPU keeps one copy: the clones share their source), else drawn here */
function borrowWood(from: THREE.Object3D | null): TexSet {
  const mats: THREE.Material[] = [];
  from?.traverse((m) => { if (isMesh(m) && !Array.isArray(m.material)) mats.push(m.material); });
  for (const mat of mats) {
    if (mat.name !== 'xbow-wood' || !(mat instanceof THREE.MeshStandardMaterial)) continue;
    const { map, normalMap, roughnessMap } = mat;
    if (map !== null && normalMap !== null && roughnessMap !== null) return { map: map.clone(), normalMap: normalMap.clone(), armMap: roughnessMap.clone() };
  }
  return viewmodelTexSet('walnut');
}

/**
 * E322 F-M6: the hunter's gloved hands (hunterHands.ts; Jake's pick B), in model space: the left hand round the forend, the
 * right on the wrist with its fingers through the loop (it rides the lever through a cycle); `gate` = the right hand
 * thumbing a cartridge, relative to the round's base. A dev knob: edit, then the rifle's `rebuildHands()`.
 */
export const LEVER_HAND_HOLDS: { left: HandHold; right: HandHold; gate: Omit<HandHold, 'spec'> } = {
  left: { spec: { R: 0.02, curl: 0.8, bend: [0.4, -0.8], armLen: 0.5, tint: 2.2, gloveTint: BUCKSKIN }, at: [0, -0.017, -0.16], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { spec: { R: 0.012, span: 0.9, bend: [0.3, -0.6], armLen: 0.5, tint: 2.2, gloveTint: BUCKSKIN }, at: [0, -0.062, 0.165], axis: [0, 1, -0.25], palm: [-1, 0, 0] },
  gate: { at: [0.03, -0.01, 0.03], axis: [0, 0, -1], palm: [-1, 0, 0] },
};
/** The hands: the glove material once per rifle, a fresh pair from the holds on every build. */
const LEVER_HANDS: LeverFirearmHandsKit = {
  make: (sky) => {
    let handsMat: THREE.MeshPhysicalMaterial | null = null;
    return (model) => {
      handsMat ??= viewmodelMaterial(sky, 'hunter-hands', HANDS_MATERIAL);
      const right = holdDef(LEVER_HAND_HOLDS.right), g = LEVER_HAND_HOLDS.gate;
      const gate = gripPose(g.at, g.axis, g.palm);
      return { rest: right.pose, gate, hands: new WeaponHands(model, handsMat, holdDef(LEVER_HAND_HOLDS.left), right) };
    };
  },
  grip: () => gripPose([0, 0, 0], [0, 1, 0], [1, 0, 0]),
  blend: blendGrip,
};

/** Pine's view: the .30-30's kick, flash, brass and tracer; the lever's throw; the sights at a carbine's eye relief; the
 *  action's clock; the hip pose and the lever's rock. */
export const LEVER_VIEW: LeverFirearmView = {
  magazine: MAGAZINE, reserve: RESERVE_START,
  kick: KICK_PITCH,
  flash: { frames: FLASH_FRAMES, lightTime: FLASH_LIGHT_TIME, light: FLASH_LIGHT },
  brass: { count: BRASS_COUNT, life: BRASS_LIFE },
  tracer: { count: TRACER_COUNT, time: TRACER_TIME },
  adsMotion: ADS_MOTION,
  lever: { open: LEVER_OPEN, boltTravel: BOLT_TRAVEL, hammerDown: HAMMER_DOWN, hammerCocked: HAMMER_COCKED, handTurn: HAND_TURN },
  sight: { y: SIGHT_Y, eyeZ: EYE_Z, rearZ: REAR_Z, frontZ: FRONT_Z, muzzleZ: MUZZLE_Z },
  hammerPivot: [HAMMER_PIVOT.x, HAMMER_PIVOT.y, HAMMER_PIVOT.z],
  port: [PORT.x, PORT.y, PORT.z],
  timing: { autoReloadDelay: AUTO_RELOAD_DELAY, reloadIn: RELOAD_IN, reloadOut: RELOAD_OUT, roundTime: ROUND_TIME },
  hip: { px: 0.07, py: -0.085, pz: -0.26, rx: 0.05, ry: 0.14, rz: -0.15, scale: 1.0 },
  cyclePose: { px: -0.03, py: 0.03, pz: 0, rx: 0.1, ry: 0.1, rz: -0.45 },
};

/** Pine's lever-action: the row bound to the platform's lever firearm (`new LeverRifle(world, targets, { row, woodFrom })`). */
export const LeverRifle = leverFirearmType<FirearmProfile, LeverBuildOptions>({
  profile: LEVER_PROFILE,
  build: (sky: Sky, opts: LeverBuildOptions): LeverFirearmBuild => buildLever(sky, opts.model !== undefined ? opts.model : modelReady, opts.woodFrom ?? null),
  cartridge: cartridgeGeometry,
  action: (store) => new LeverAction(store),
  hands: LEVER_HANDS,
  view: LEVER_VIEW,
});
/** A built Pine lever-action. */
export type LeverRifleWeapon = LeverFirearmWeapon<FirearmProfile>;
