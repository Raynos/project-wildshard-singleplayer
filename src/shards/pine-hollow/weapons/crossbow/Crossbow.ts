import { app, gameplayRandom } from '@wildshard/engine/app/runtime';
import type { AmmoRow } from '@wildshard/engine/combat/ammo';
import { ads as blendAds } from '@wildshard/engine/combat/blocks/ads';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import type { TargetHit, Targets } from '@wildshard/engine/combat/types';
import { Puffs, worldHit, impactSurfaceOf, FOV_HIP, FOV_ADS, fovForAspect, dataTexture, viewmodelTexSet, remapUV, makeCord, makeBoltAtlas, fixIBL, VIEWMODEL_GROUP, viewmodelMaterial, isMesh, box, cyl, edgeWear, whiteColors, stripExtra, TRACER_ORDER, TRACER_RED, type CrossbowWorld, type CrossbowOptions } from '@wildshard/engine/combat/view/ranged';
import { Weapon, quiverState, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { Game } from '@wildshard/engine/core/Game';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { sticksIn } from '@wildshard/engine/physics/query';
import type { Player } from '@wildshard/engine/player/Player';
import { sstep } from '@wildshard/engine/player/viewmodelTextures';
import { getSetting } from '@wildshard/engine/ui/Settings';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { BUCKSKIN, HANDS_MATERIAL, WeaponHands, coatMaterialParams, holdDef, type HandHold } from '../hunterHands';
import { CROSSBOW_PROFILE, type CrossbowProfile } from './profiles';




import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';











/**
 * Crossbow — first-person hero weapon: procedural medieval hunting crossbow viewmodel,
 * physical bolt projectiles, impact puffs, ADS (iron sights: cheek on the stock, the camera looking straight down the
 * bolt with its tip a hair below centre — the pose is solved from the geometry and the camera per aspect, no zoom), recoil and reload.
 *
 *   const crossbow = new Crossbow({ game, sky, player, forest }, targets?, { allowUnlocked?: boolean });
 *   game.onUpdate((dt, t) => crossbow.update(dt, t));   // register AFTER player.update
 *
 * Input (only while `player.locked`, or always when `allowUnlocked`): LMB / `F` fire, RMB (click to toggle) ADS,
 * `R` reload. `crossbow.enabled = false` mutes input (intro / pause). `crossbow.adsHeld` can be forced.
 *
 * Events (assign callbacks):
 *   onFire()                                       — a bolt left the rail (play crossbowFire, kick crosshair)
 *   onHit(kind, headshot, killed)                  — a bolt hit an animal from `targets`
 *   onImpact(surface: 'wood'|'ground'|'flesh', point) — any bolt impact (play boltImpact); the surface is the hit
 *                                                    collider's material (impactSurfaceOf)
 *   onReloadStart() / onReloadEnd()
 *   onDry()                                        — trigger pulled with nothing loaded
 * State: `crossbow.state` → { bolts, loaded, reloading, reloadProgress, ads }  (bolts includes the loaded one)
 * `crossbow.aimInfo` → { kind, distance } | null — the animal under the crosshair (for the HUD range readout)
 *
 * Side effects the integrator must know about: the FOV setter (Hor+ on portrait; ADS keeps the hip FOV) owns `game.camera.fov` and calls
 * `camera.updateProjectionMatrix()` + `sky.csm.updateFrustums()`; recoil nudges `player.pitch`;
 * the viewmodel is parented to `game.camera` and the camera is added to the scene.
 * Animals are reached only through the `Targets` interface below (no import of the animal module).
 */


export const MAX_BOLTS = 30;
/** Stuck bolts are PERMANENT (target practice): no lifetime — only the cap evicts, oldest first. */
/** how deep the broadhead sits in wood / ground (m); the rest of the bolt stands proud of the surface */
/** a flying bolt is swept through the physics world as a ball this big (m) — the broadhead's reach */
/** a bolt glancing off stone / rock / metal keeps this much of its speed along the surface, bounces off it with this
 *  much of its speed into it, and never leaves faster than GLANCE_MAX (m/s): a short skip, then it falls and lies */
const GLANCE_KEEP = 0.2, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9, GLANCE_LIFT = 0.01;
/**
 * TRACERS (for sighting-in the iron sights): a traced bolt gets a big red glow while it flies, leaves a fat solid-red
 * trail of its whole flight path (drawn through trees: no depth test) and drops a red impact marker where it stopped;
 * trail + marker live TRACER_LIFE s then fade. A traced bolt that sticks keeps a permanent red dot on its nock.
 * Runtime toggle: the 'tracers' setting (pause menu, persisted) is read at fire time, so a flip applies to the next
 * shot (a capture script saves it in ws.settings.v1 before the load, scripts/debug-settings.mjs).
 */
const MAX_TRACERS = 8, TRACER_POINTS = 2048, TRACER_LIFE = 6, TRACER_FADE = 1.5, TRACER_WIDTH = 8;
/** markers + the flying glow are scaled with distance (never below 1×) so they stay ~25 px on screen at any range */
const TRACER_PX = 0.32;
 // after the viewmodel (1000) so the trail's first metre shows over the weapon
/** ADS is true iron sights, not a zoom: the FOV stays put and the weapon is brought up to the eye instead. */
/** Iron sights: the camera looks straight down the bolt axis (model rotation 0, cheek on the stock) and the pose is
 *  SOLVED from the geometry + the camera's FOV/aspect, not tuned: the loaded bolt's tip is put at ADS_TIP_NDC (a hair
 *  below centre, the approved mockup) and the model is slid toward the eye until the nut/string reaches
 *  ADS_NUT_NDC_Y (just inside the bottom edge) or the near plane stops it — that fixes the eye height above the rail
 *  (~5 cm) and the depth, and the limb span falls out (≈ ±0.5 landscape, edge to edge on a 94° portrait). */
const ADS_EYE_ABOVE_RAIL = 0.056; // m — cheek on the stock: the eye is this far above the rail, looking straight down the bolt
const ADS_NEAR_MARGIN = 0.03, ADS_PITCH = 0;
// damage numbers live in the damage model (src/engine/entities/Animal.ts damageFor)
/** Rear PEEP sight (mockup art/ads-aim/round-1/ads-C-peep-sight.png): a dark-iron ring on a post just in front of the nut (the stock
 *  behind the nut is inside the near plane when sighted), placed on the eye→tip line so that at full ADS its centre
 *  projects exactly where the tip does — the tip is seen through the ring. Outer diameter ≈ 4 % of the screen width
 *  (≥ 7 % of the height, so it stays a ring on a portrait phone). Hidden at the hip, fades in with the ADS blend. */
const PEEP_Z = 0.10, PEEP_R = 0.01, PEEP_TUBE = 0.12, PEEP_R_WORLD = 0.0105, PEEP_CYAN = 0x8fe3ff; // rear peep: 2.1 cm ring on a short post just ahead of the nut

/** Deterministic bolt substep, including the selected ammo/weather multipliers. */
export function boltFlightStep(pos: THREE.Vector3, vel: THREE.Vector3, h: number,
  mod: { gravity: number; drag: number }, profile: Pick<CrossbowProfile, 'gravity' | 'drag'> = CROSSBOW_PROFILE): void {
  vel.y -= profile.gravity * mod.gravity * h;
  vel.multiplyScalar(1 - profile.drag * mod.drag * h * vel.length() * 0.1);
  pos.addScaledVector(vel, h);
}

// ───────────────────────────── procedural textures ─────────────────────────────



// ───────────────────────────── geometry helpers ─────────────────────────────

/** Sweep a tapered rectangle section along a curve (flat spring-steel limb). */
function sweepRect(curve: THREE.Curve<THREE.Vector3>, segs: number, halfW: (t: number) => number, halfH: (t: number) => number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = [];
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const faces: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // corners in (N, B) space, ring order
  const c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
    const hw = halfW(t), hh = halfH(t);
    for (let k = 0; k < 4; k++) { const ck = c[k], fk = faces[k]; if (ck === undefined || fk === undefined) continue; ck.copy(p).addScaledVector(N, fk[0] * hw).addScaledVector(B, fk[1] * hh); }
    // four faces, each with two verts per ring (hard edges)
    for (let f = 0; f < 4; f++) {
      const a = c[f], b = c[(f + 1) % 4];
      if (a === undefined || b === undefined) continue;
      const fn = new THREE.Vector3().subVectors(b, a).cross(T).normalize().negate();
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); nrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z); uv.push(t * 6, 0, t * 6, 1);
      const wear = (f % 2 === 1 ? 0.8 : 0.28) * (0.85 + 0.3 * Math.abs(Math.sin(t * 23 + f))); // edges worn bright, flats blackened
      col.push(wear, wear, wear, wear, wear, wear);
    }
  }
  for (let s = 0; s < segs; s++) for (let f = 0; f < 4; f++) {
    const o = s * 8 + f * 2, n = o + 8;
    idx.push(o, n, o + 1, o + 1, n, n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Bevelled rectangular ring (iron band) around a w×h section, `len` long, oriented along Z. */
function bandGeometry(w: number, h: number, len: number, thick: number, bevel = 0.0015): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, h / 2 + thick); outer.lineTo(-w / 2 - thick, h / 2 + thick); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -len / 2 + bevel);
  return g;
}

function buildBoltGeometry(): THREE.BufferGeometry {
  const L = 0.36, r = 0.0045;
  const parts: THREE.BufferGeometry[] = [];
  // shaft (ash)
  parts.push(remapUV(cyl(r, r, L - 0.05, 10, 0, 0, 0.025, Math.PI / 2), 0, 0.02, 1, 0.44));
  // nock end cap
  parts.push(remapUV(cyl(r * 0.8, r, 0.012, 8, 0, 0, L / 2 - 0.006, Math.PI / 2), 0, 0.02, 1, 0.44));
  // socket (steel)
  parts.push(remapUV(cyl(0.0052, r, 0.03, 8, 0, 0, -L / 2 + 0.04, Math.PI / 2), 0.03, 0.55, 0.42, 0.42));
  // broadhead: flattened 4-sided cone = two-edged blade
  const head = new THREE.ConeGeometry(0.016, 0.07, 4);
  head.rotateY(Math.PI / 4); head.scale(0.22, 1, 1); head.rotateX(-Math.PI / 2); head.translate(0, 0, -L / 2 + 0.035 - 0.035);
  parts.push(remapUV(head, 0.03, 0.55, 0.42, 0.42));
  // fletchings ×3
  for (let k = 0; k < 3; k++) {
    const vane = new THREE.PlaneGeometry(0.075, 0.02);
    vane.translate(0, 0.01 + r * 0.7, 0); vane.rotateY(Math.PI / 2); // plane along Z, standing up from the shaft
    vane.rotateZ((k / 3) * Math.PI * 2 + Math.PI / 2);
    vane.translate(0, 0, L / 2 - 0.06);
    parts.push(remapUV(vane, 0.5, 0.5, 0.5, 0.5));
  }
  const g = mergeGeometries(parts.map(stripExtra), false);
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────────── impact particles ─────────────────────────────

 // pure red; anything brighter the AgX tone map washes to salmon
/** shared: the glow on flying bolts, impact-marker spheres, stuck-bolt nock dots (never fades) */
const glowMat = new THREE.MeshBasicMaterial({ color: TRACER_RED, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
const boltGlowGeo = new THREE.SphereGeometry(0.035, 12, 8);   // 7 cm on the flying bolt
const stuckDotGeo = new THREE.SphereGeometry(0.025, 10, 6);   // 5 cm on a stuck bolt's nock
const markerGeo = new THREE.SphereGeometry(0.06, 14, 10);     // 12 cm at the impact point
const ringGeo = new THREE.RingGeometry(0.10, 0.14, 28);

/** One flight path: a pre-allocated fat-line buffer (TRACER_POINTS samples → segment pairs) + an impact marker. */
class Tracer {
  readonly line: LineSegments2; readonly mat: LineMaterial;
  readonly marker = new THREE.Group();
  private buf: Float32Array; private ibuf: THREE.InstancedInterleavedBuffer; private geo: LineSegmentsGeometry;
  private markMat: THREE.MeshBasicMaterial; private ring: THREE.Mesh;
  private last = new THREE.Vector3();
  n = 0; active = false;
  /** absolute time the trail + marker expire; < 0 while the bolt is still flying */
  endTime = -1;

  constructor(scene: THREE.Scene) {
    this.buf = new Float32Array((TRACER_POINTS - 1) * 6);
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.buf);
    this.ibuf = (this.geo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer;
    this.ibuf.setUsage(THREE.DynamicDrawUsage);
    this.geo.instanceCount = 0;
    this.mat = new LineMaterial({ linewidth: TRACER_WIDTH, transparent: true, opacity: 1, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mat.color = TRACER_RED.clone(); // the setter stores the object itself (a Color; > 1 so bloom haloes it)
    this.line = new LineSegments2(this.geo, this.mat);
    this.line.frustumCulled = false; this.line.renderOrder = TRACER_ORDER; this.line.visible = false;
    scene.add(this.line);
    this.markMat = glowMat.clone();
    const ball = new THREE.Mesh(markerGeo, this.markMat); ball.renderOrder = TRACER_ORDER + 1;
    this.ring = new THREE.Mesh(ringGeo, this.markMat); this.ring.renderOrder = TRACER_ORDER + 1;
    this.marker.add(ball, this.ring);
    this.marker.visible = false;
    scene.add(this.marker);
  }

  begin(p: THREE.Vector3) {
    this.n = 0; this.geo.instanceCount = 0; this.active = true; this.endTime = -1;
    this.mat.opacity = 1; this.markMat.opacity = 1;
    this.marker.visible = false; this.line.visible = false;
    this.addPoint(p);
  }

  /** append a flight sample (one per integration step); no allocation, uploads only the new segment */
  addPoint(p: THREE.Vector3) {
    if (this.n >= TRACER_POINTS) return;
    if (this.n > 0) {
      if (p.distanceToSquared(this.last) < 1e-8) return;
      const o = (this.n - 1) * 6, b = this.buf, l = this.last;
      b[o] = l.x; b[o + 1] = l.y; b[o + 2] = l.z; b[o + 3] = p.x; b[o + 4] = p.y; b[o + 5] = p.z;
      this.ibuf.addUpdateRange(o, 6); this.ibuf.needsUpdate = true;
      this.geo.instanceCount = this.n;
      this.line.visible = true;
    }
    this.last.copy(p); this.n++;
  }

  finish(p: THREE.Vector3, t: number) {
    this.addPoint(p);
    this.marker.position.copy(p); this.marker.visible = true;
    this.endTime = t + TRACER_LIFE;
  }

  update(t: number, cam: THREE.Camera, res: THREE.Vector2) {
    if (!this.active) return;
    this.mat.resolution.copy(res);
    if (this.endTime < 0) return;
    const rem = this.endTime - t;
    if (rem <= 0) { this.active = false; this.line.visible = false; this.marker.visible = false; return; }
    const a = Math.min(1, rem / TRACER_FADE);
    this.mat.opacity = a; this.markMat.opacity = a;
    this.ring.quaternion.copy(cam.quaternion); // the ring always faces the camera
    this.marker.scale.setScalar(Math.max(1, TRACER_PX * this.marker.position.distanceTo(cam.position)));
  }
}

// ───────────────────────────── the crossbow ─────────────────────────────

interface Bolt { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; active: boolean; age: number; roll: number; traced: boolean; tracer: Tracer | null; glow: THREE.Mesh; glanced: boolean; mod: BoltMod; ammo?: AmmoRow | undefined }
/**
 * Special bolts (optional — Pine Hollow's loadout, src/shards/pine-hollow/loadout/loadout.ts): the flight + damage of the NEXT bolt to leave
 * the rail, captured by each bolt as it launches. `gravity` / `drag` multiply the flight's, `damage(kind)` the damage model's
 * number on an animal of that kind, `material` dresses the bolt (a uniform-only clone of the bolt material: no program).
 * `PLAIN_BOLT` (the default) is the iron bolt exactly as before.
 */
export interface BoltMod { gravity: number; drag: number; damage: (kind: string) => number; material?: THREE.Material | undefined }
export const PLAIN_BOLT: BoltMod = { gravity: 1, drag: 1, damage: () => 1 };
interface Stuck { mesh: THREE.Mesh }

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _aimEnd = new THREE.Vector3();
const NEG_Z = new THREE.Vector3(0, 0, -1), Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * The bolt (E348): its atlas (the iron shaft, the steel head, the feather vanes), its geometry along −Z (tip at −Z, 0.36 m)
 * and its material, on the viewmodels' program group. The loaded bolt, every bolt in flight or stuck (`buildCrossbow`'s
 * parts) and the Model Explorer's bolt card (src/shards/pine-hollow/models/gear.ts: its own copy) are built by this.
 */
export function buildBolt(sky: Sky): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  const atlas = makeBoltAtlas();
  const geometry = buildBoltGeometry();
  const material = new THREE.MeshStandardMaterial({ map: atlas.map, normalMap: atlas.normalMap, aoMap: atlas.armMap, roughnessMap: atlas.armMap, metalnessMap: atlas.armMap, roughness: 1, metalness: 1, alphaTest: 0.5, side: THREE.DoubleSide });
  // one DoubleSide pass: the viewmodel makes this material transparent (Crossbow), and three draws a transparent
  // DoubleSide material as a BackSide + a FrontSide pass — two programs. The fletching is alpha-tested and the
  // bolt writes depth, so one pass looks the same.
  material.forceSinglePass = true;
  material.name = 'xbow-bolt'; fixIBL(material, VIEWMODEL_GROUP); sky.setupMaterial(material);
  return { geometry, material };
}

/** the crossbow's parts `buildCrossbow` hands back: the ones the viewmodel animates, and its measured rest points */
export interface CrossbowParts {
  readonly stringLeft: THREE.Mesh; readonly stringRight: THREE.Mesh; readonly serving: THREE.Mesh; readonly loadedBolt: THREE.Mesh;
  readonly boltGeo: THREE.BufferGeometry; readonly boltMat: THREE.MeshStandardMaterial;
  readonly peepPost: THREE.Mesh; readonly peepMats: readonly THREE.Material[];
  readonly tipL: THREE.Vector3; readonly tipR: THREE.Vector3; readonly nockRest: THREE.Vector3; readonly nockDrawn: THREE.Vector3;
  readonly tipLocal: THREE.Vector3; readonly tipModel: THREE.Vector3; readonly nockZ: number;
}
/**
 * The crossbow in model space (−Z the bolt, +Y up, the rail top at y 0; the nut at z +0.14, the prod at z −0.30): the stock,
 * the iron, the brass, the prod, the string (its legs unposed: the viewmodel poses them every frame), the leather, the loaded
 * bolt and the rear peep sight (in `peep` / `peepRing`, hidden), added to `into.model`, every lit part on the viewmodels'
 * shared program. The viewmodel's build and the Model Explorer's card (src/shards/pine-hollow/models/gear.ts, through
 * Skins.crossbowDisplayModel) are this one function, so the two never drift; the geometries without wear colours need
 * `whiteColors` before a draw.
 */
export function buildCrossbow(sky: Sky, into: { readonly model: THREE.Group; readonly peep: THREE.Group; readonly peepRing: THREE.Group }): CrossbowParts {
  const { model, peep, peepRing } = into;
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

  // model space: -Z forward (bolt direction), +Y up, rail top at y=0. Nut at z=+0.14, prod at z=-0.30.
  // ── stock: side profile extruded along X with bevels ──
  const s = new THREE.Shape(); // shape.x = forward (→ -Z), shape.y = up
  s.moveTo(0.40, 0.0);
  s.lineTo(-0.16, 0.0);
  s.quadraticCurveTo(-0.26, -0.006, -0.32, -0.035);
  s.lineTo(-0.43, -0.085);
  s.quadraticCurveTo(-0.455, -0.1, -0.445, -0.125);
  s.lineTo(-0.435, -0.15);
  s.quadraticCurveTo(-0.39, -0.16, -0.34, -0.135);
  s.lineTo(-0.23, -0.088);
  s.quadraticCurveTo(-0.12, -0.062, 0.0, -0.056);
  s.lineTo(0.30, -0.048);
  s.quadraticCurveTo(0.39, -0.046, 0.40, -0.018);
  s.closePath();
  const stockGeo = new THREE.ExtrudeGeometry(s, { depth: 0.038, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10 });
  stockGeo.rotateY(Math.PI / 2); // shape.x → -Z, extrusion → +X
  stockGeo.translate(-0.019, 0, 0);
  // rail strips (two lighter wood rails with a groove for the bolt)
  const railL = box(0.008, 0.005, 0.52, -0.011, 0.0025, -0.12), railR = box(0.008, 0.005, 0.52, 0.011, 0.0025, -0.12);
  const stockNI = stripExtra(stockGeo);
  const woodGeo = mergeGeometries([stockNI, stripExtra(railL), stripExtra(railR)], false);
  edgeWear(woodGeo, 0.18);
  { // the groove rails sit in shadow of the bolt: darker, oil-soaked
    const c = woodGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = stockNI.getAttribute('position').count; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.62, c.getY(i) * 0.6, c.getZ(i) * 0.58);
  }
  const stock = new THREE.Mesh(woodGeo, woodMat);
  model.add(stock);

  // ── iron: nut, trigger, guard, tickler, bands, rivets, stirrup, prod bridle, tip caps ──
  const iron: THREE.BufferGeometry[] = [];
  // brass: nut (roller), side inlay strips, thumb plate, rivet heads on the grip
  const brass: THREE.BufferGeometry[] = [];
  brass.push(cyl(0.014, 0.014, 0.042, 18, 0, 0.004, 0.14, 0, 0, Math.PI / 2)); // nut
  brass.push(box(0.032, 0.006, 0.011, 0, 0.012, 0.133)); // nut fingers
  for (const sx of [-1, 1]) brass.push(box(0.0015, 0.0035, 0.30, sx * 0.0245, -0.03, -0.09)); // inlay lines along the flanks
  brass.push(box(0.03, 0.002, 0.05, 0, -0.088, 0.25, 0.3)); // thumb plate on the grip top edge
  const bead = new THREE.SphereGeometry(0.0035, 10, 8); bead.translate(0, 0.009, -0.375); brass.push(bead); // foresight bead
  brass.push(cyl(0.0015, 0.0015, 0.008, 6, 0, 0.004, -0.375)); // bead post
  const brassGeo = mergeGeometries(brass.map(stripExtra), false);
  model.add(new THREE.Mesh(brassGeo, brassMat));
  // trigger (curved) + guard
  const trig = new THREE.TorusGeometry(0.022, 0.0032, 8, 14, Math.PI * 0.6); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.55); trig.translate(0, -0.075, 0.205); iron.push(trig);
  const guard = new THREE.TorusGeometry(0.036, 0.0025, 6, 20, Math.PI); guard.rotateY(Math.PI / 2); guard.rotateX(Math.PI); guard.translate(0, -0.066, 0.21); iron.push(guard);
  // tickler lever under the stock, angled
  iron.push(box(0.012, 0.006, 0.19, 0, -0.088, 0.30, -0.08));
  iron.push(cyl(0.004, 0.004, 0.05, 8, 0, -0.08, 0.215, 0, 0, Math.PI / 2)); // pivot pin
  // bands
  const bandF = bandGeometry(0.048, 0.052, 0.022, 0.003); bandF.translate(0, -0.026, -0.27); iron.push(bandF);
  const bandM = bandGeometry(0.048, 0.062, 0.016, 0.0025); bandM.translate(0, -0.031, 0.02); iron.push(bandM);
  const bandR = bandGeometry(0.046, 0.07, 0.016, 0.0025); bandR.translate(0, -0.045, 0.27); iron.push(bandR);
  // rivets on bands
  for (const [z, y] of [[-0.27, -0.026], [0.02, -0.031], [0.27, -0.045]] as const) for (const sx of [-1, 1]) {
    iron.push(cyl(0.003, 0.0035, 0.004, 8, sx * 0.028, y, z, 0, 0, Math.PI / 2));
  }
  // prod bridle: a saddle over the stock nose holding the prod
  iron.push(box(0.062, 0.012, 0.03, 0, 0.007, -0.30));
  iron.push(box(0.064, 0.05, 0.012, 0, -0.026, -0.296)); // vertical plate in front of prod
  for (const sx of [-1, 1]) iron.push(cyl(0.0045, 0.0045, 0.04, 8, sx * 0.024, -0.025, -0.283, Math.PI / 2)); // bridle bolts
  // stirrup: two legs + half ring
  for (const sx of [-1, 1]) iron.push(cyl(0.004, 0.004, 0.06, 8, sx * 0.03, -0.055, -0.415, 0, 0, 0));
  const stir = new THREE.TorusGeometry(0.03, 0.004, 8, 18, Math.PI); stir.rotateZ(Math.PI); stir.translate(0, -0.085, -0.415); iron.push(stir);
  iron.push(box(0.07, 0.008, 0.02, 0, -0.03, -0.41)); // stirrup mount plate
  // limb tip caps
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  for (const tip of [tipL, tipR]) iron.push(box(0.022, 0.024, 0.012, tip.x, tip.y, tip.z));
  // butt plate
  const butt = box(0.046, 0.06, 0.006, 0, -0.115, 0.44, 0.4); iron.push(butt);
  const ironGeo = mergeGeometries(iron.map(stripExtra), false);
  model.add(new THREE.Mesh(ironGeo, ironMat));

  // ── prod (steel limbs) ──
  const prodCurve = new THREE.CatmullRomCurve3([
    tipL.clone(), new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR.clone(),
  ], false, 'catmullrom', 0.5);
  const prodGeo = sweepRect(prodCurve, 40, (t) => 0.008 - Math.abs(t - 0.5) * 0.009, (t) => 0.021 - Math.abs(t - 0.5) * 0.022);
  model.add(new THREE.Mesh(prodGeo, prodMat));

  // ── string (2 legs + serving), updated every frame ──
  const legGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 1, 7); legGeo.translate(0, 0.5, 0);
  const stringLeft = new THREE.Mesh(legGeo, cordMat), stringRight = new THREE.Mesh(legGeo, cordMat);
  const servGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.055, 8); servGeo.rotateZ(Math.PI / 2);
  const serving = new THREE.Mesh(servGeo, cordMat);
  model.add(stringLeft, stringRight, serving);
  const nockRest = new THREE.Vector3(0, 0.009, -0.215), nockDrawn = new THREE.Vector3(0, 0.009, 0.128);
  // cord whipping around the stock nose
  const wrap = new THREE.CylinderGeometry(0.031, 0.031, 0.024, 10); wrap.rotateX(Math.PI / 2); wrap.translate(0, -0.025, -0.34);
  model.add(new THREE.Mesh(wrap, cordMat));

  // ── leather grip ──
  const gripShape = new THREE.Shape(); // rounded rectangle section
  const gw = 0.026, gh = 0.047, gr = 0.012;
  gripShape.moveTo(-gw + gr, -gh); gripShape.lineTo(gw - gr, -gh); gripShape.quadraticCurveTo(gw, -gh, gw, -gh + gr);
  gripShape.lineTo(gw, gh - gr); gripShape.quadraticCurveTo(gw, gh, gw - gr, gh); gripShape.lineTo(-gw + gr, gh);
  gripShape.quadraticCurveTo(-gw, gh, -gw, gh - gr); gripShape.lineTo(-gw, -gh + gr); gripShape.quadraticCurveTo(-gw, -gh, -gw + gr, -gh);
  const grip = new THREE.ExtrudeGeometry(gripShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 3, curveSegments: 6 });
  grip.rotateX(0.35); grip.translate(0, -0.074, 0.30);
  const fw = 0.0245, fh = 0.033, fr = 0.009; const foreShape = new THREE.Shape();
  foreShape.moveTo(-fw + fr, -fh); foreShape.lineTo(fw - fr, -fh); foreShape.quadraticCurveTo(fw, -fh, fw, -fh + fr); foreShape.lineTo(fw, fh - fr); foreShape.quadraticCurveTo(fw, fh, fw - fr, fh); foreShape.lineTo(-fw + fr, fh); foreShape.quadraticCurveTo(-fw, fh, -fw, fh - fr); foreShape.lineTo(-fw, -fh + fr); foreShape.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
  const fore = new THREE.ExtrudeGeometry(foreShape, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
  fore.translate(0, -0.03, -0.24); // forearm wrap between the front band and the mid band
  model.add(new THREE.Mesh(fore, leatherMat));
  model.add(new THREE.Mesh(grip, leatherMat));

  // ── loaded bolt on the rail ──
  const { geometry: boltGeo, material: boltMat } = buildBolt(sky);
  const loadedBolt = new THREE.Mesh(boltGeo, boltMat);
  loadedBolt.position.set(0, 0.0095, 0.128 - 0.18);
  model.add(loadedBolt);
  boltGeo.computeBoundingBox();
  const boltBox = boltGeo.boundingBox;
  if (boltBox === null) throw new Error('Crossbow: bolt geometry has no bounding box');
  const tipLocal = new THREE.Vector3(0, 0, boltBox.min.z), nockZ = boltBox.max.z;
  const tipModel = tipLocal.clone().add(loadedBolt.position);

  // ── rear peep sight: dark iron ring with a faint cyan inner edge, on a post rising from the rail (posed per frame) ──
  // the stock's program (see the materials above): 1×1 filler maps leave colour, roughness and metalness as set
  const peepIron = viewmodelMaterial(sky, 'xbow-peep', { color: new THREE.Color(0.05, 0.05, 0.055), roughness: 0.9, metalness: 0.75, emissive: new THREE.Color(PEEP_CYAN), emissiveIntensity: 0.05 });
  const peepGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(PEEP_CYAN), toneMapped: false, fog: false, opacity: 0.85 });
  const peepMats: THREE.Material[] = [peepIron, peepGlow];
  const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R, PEEP_R * PEEP_TUBE, 10, 40), peepIron);
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(PEEP_R * (1 - PEEP_TUBE * 0.85), PEEP_R * 0.025, 6, 40), peepGlow);
  peepRing.add(ringOuter, ringInner);
  const postGeo = new THREE.BoxGeometry(0.0025, 1, 0.002); postGeo.translate(0, -0.5, 0); // top at 0, scaled to reach the rail
  const peepPost = new THREE.Mesh(postGeo, peepIron);
  peep.add(peepRing, peepPost);
  peep.visible = false;
  model.add(peep);
  return { stringLeft, stringRight, serving, loadedBolt, boltGeo, boltMat, peepPost, peepMats, tipL, tipR, nockRest, nockDrawn, tipLocal, tipModel, nockZ };
}

export class Crossbow extends Weapon {
  readonly profile: CrossbowProfile;
  readonly state: ReturnType<typeof quiverState>;
  enabled = true;
  allowUnlocked = false;
  /** hold ADS externally (dev `?ads=1`) — OR'ed with the right mouse button */
  adsHeld = false;
  /** dev: 0 = normal, 1 = showcase pose (model centred, three-quarter view, slowly turning) */
  inspect = 0;
  /** dev: reload duration multiplier (1 = normal) */
  reloadScale = 1;
  /** 0..1 weapon-swap blend driven by Weapons.ts: 1 = dropped out of view (down + back + muzzle up); 0 = held (no effect) */
  holster = 0;
  /** what the crosshair is over (animals only; refreshed every 4th frame, 120 m) */
  aimInfo: { kind: string; distance: number } | null = null;
  private aimFrame = 0;
  private aimCache = { kind: 'deer', distance: 0 };
  /** the bolt on the rail (special bolts, BoltMod above): read at each loose; PLAIN_BOLT = iron */
  boltMod: BoltMod = PLAIN_BOLT;
  selectedAmmo: AmmoRow | undefined;
  protected nextAmmo(): AmmoRow | undefined { return this.selectedAmmo; }
  protected onShot(_bolt: { pos: THREE.Vector3; vel: THREE.Vector3 }): void { /* custom bolt hook */ }
  protected onBoltHit(_hit: TargetHit): void { /* custom hit hook */ }
  /** the HUD strip's ammo label (Weapons.ts BaseLike override): the loaded kind's ("Pitch bolts") */
  override get ammoLabel(): string { return this.row.ui.ammo?.label ?? ''; }
  override set ammoLabel(label: string) { if (this.row.ui.ammo) this.row = { ...this.row, ui: { ...this.row.ui, ammo: { ...this.row.ui.ammo, label } } }; }


  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;

  // viewmodel parts we animate
  private stringLeft!: THREE.Mesh; private stringRight!: THREE.Mesh; private serving!: THREE.Mesh;
  private loadedBolt!: THREE.Mesh;
  private tipL = new THREE.Vector3(); private tipR = new THREE.Vector3();
  private nockRest = new THREE.Vector3(); private nockDrawn = new THREE.Vector3();
  private boltGeo!: THREE.BufferGeometry; private boltMat!: THREE.MeshStandardMaterial;
  /** the bolt geometry's nock end (max z), measured from its bounding box */
  private nockZ = 0;

  // animation state
  private draw = 1; private drawVel = 0; private drawTarget = 1;
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private cooldown = 0; private sinceFire = 99; private reloadT = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;
  /** loaded bolt's broadhead tip, in model space (measured from the bolt geometry) and bolt-local */
  private tipModel = new THREE.Vector3(); private tipLocal = new THREE.Vector3();
  private adsCache = { aspect: 0, fov: 0, scale: 0 };
  /** the solved iron-sights pose + the numbers behind it (dev / verification: `__wildshard.world.crossbow.adsPose`) */
  readonly adsPose = { px: 0, py: 0, pz: 0, rx: ADS_PITCH, scale: 0, tipDepth: 0, eyeAboveRail: 0, nutDepth: 0, nutNdcY: 0, limbNdcX: 0, tipNdcY: 0, peepY: 0, peepZ: PEEP_Z, peepDepth: 0, peepR: 0 };
  /** the rear peep sight: ring + post, posed from `adsPose` every sighted frame */
  private peep = new THREE.Group(); private peepRing = new THREE.Group(); private peepPost!: THREE.Mesh;
  private peepMats: THREE.Material[] = [];
  /** E322 F-M6: the hunter's gloved hands (hunterHands.ts; Jake's pick B) */
  private hands: WeaponHands | null = null;
  private handsMat: THREE.MeshPhysicalMaterial | null = null; private coatMat: THREE.MeshPhysicalMaterial | null = null;
  /** the holds, in model space: the left hand round the back of the fore-end's leather — its thumb up the near side, its
   *  fingers up the far side, the coat sleeve free (aimed at an elbow off the frame's lower left, so the reload's tilt
   *  never swings the arm away); the right under the grip with the index by the trigger. Both in the coat's sleeves. A dev knob: edit, then `rebuildHands()` (`__wildshard.world.crossbow`). */
  readonly handHolds: { left: HandHold; right: HandHold } = {
    left: { spec: { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, at: [0.004, -0.034, -0.04], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
    right: { spec: { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, at: [0, -0.09, 0.33], axis: [0, 0.34, -0.94], palm: [0, 1, 0] },
  };

  // projectiles
  private bolts: Bolt[] = [];
  private stuck: Stuck[] = [];
  private puffs = new Puffs();
  private tracers: Tracer[] = [];
  private tracerRes = new THREE.Vector2();
  private time = 0;

  constructor(world: CrossbowWorld, targets: Targets | undefined, opts: CrossbowOptions & { profile?: CrossbowProfile }) {
    super(opts.row);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.ranged' } };
    this.profile = opts.profile ?? CROSSBOW_PROFILE;
    this.state = quiverState({ bolts: this.profile.quiver, loaded: true, reloading: false, reloadProgress: 0, ads: false }, this.profile.quiver);
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildProjectiles();
    this.game.viewmodel.add(this.model);
    this.game.scene.add(this.puffs.points);

    this.buildHands();
  }

  private buildHands(): void {
    this.handsMat ??= viewmodelMaterial(this.sky, 'hunter-hands', HANDS_MATERIAL);
    this.coatMat ??= viewmodelMaterial(this.sky, 'hunter-coat', coatMaterialParams());
    this.hands = new WeaponHands(this.model, this.handsMat, holdDef(this.handHolds.left), holdDef(this.handHolds.right), this.coatMat);
  }
  /** dev: rebuild the hands after editing `handHolds` */
  rebuildHands(): void { this.hands?.dispose(); this.buildHands(); }
  /** dev / the cost readout: what the hands add (null: not made yet) */
  get handsCost(): WeaponHands['cost'] | null { return this.hands?.cost ?? null; }

  // ── input ──
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.bindInput(ctx);
    ctx.scope.onDispose(() => { this.model.removeFromParent(); });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('aim', () => { this.mouseAds = !this.mouseAds; }, ctx.scope, allowed);
    app.input.bind('reload', () => { this.reload(); }, ctx.scope, allowed);
    app.input.onReset(() => { this.mouseAds = false; }, ctx.scope);
  }

  /** Pull the trigger. Fires if loaded, else starts a reload (and reports a dry click). */
  tryFire(): void {
    if (this.state.reloading || this.cooldown > 0) return;
    if (!this.state.loaded) { this.onDry?.(); this.reload(); return; }
    this.fire();
  }

  fire(): void {
    if (!this.state.loaded || this.state.reloading) return;
    this.state.loaded = false;
    this.state.bolts = Math.max(0, this.state.bolts - 1);
    this.cooldown = this.profile.cooldown; this.sinceFire = 0;
    this.drawTarget = 0; this.drawVel = -40; // string snaps forward
    this.recoil = 1; this.kickPending = this.profile.kick;
    this.spawnBolt();
    this.onFire?.();
  }

  override reload(): void {
    if (this.state.reloading || this.state.loaded || this.state.bolts <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  override addBolts(n: number): void { this.state.bolts = Math.min(this.profile.quiver, this.state.bolts + n); }

  // ── viewmodel ──
  private buildViewmodel(): void {
    const p = buildCrossbow(this.sky, { model: this.model, peep: this.peep, peepRing: this.peepRing });
    this.stringLeft = p.stringLeft; this.stringRight = p.stringRight; this.serving = p.serving; this.loadedBolt = p.loadedBolt;
    this.boltGeo = p.boltGeo; this.boltMat = p.boltMat; this.peepPost = p.peepPost; this.peepMats.push(...p.peepMats);
    this.tipL.copy(p.tipL); this.tipR.copy(p.tipR); this.nockRest.copy(p.nockRest); this.nockDrawn.copy(p.nockDrawn);
    this.tipLocal.copy(p.tipLocal); this.tipModel.copy(p.tipModel); this.nockZ = p.nockZ;

    // The engine owns the shared depth clear at 999; models remain at 1000 in the transparent queue.
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
      m.renderOrder = 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.depthWrite = true; }
    });
    this.model.scale.setScalar(1.35);
  }

  private buildProjectiles(): void {
    for (let i = 0; i < this.profile.maxFlying; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false; mesh.castShadow = true; mesh.frustumCulled = false;
      // red glow riding on the flying bolt (a child, so it hides with it; shown only on traced shots)
      const glow = new THREE.Mesh(boltGlowGeo, glowMat); glow.renderOrder = TRACER_ORDER + 1; glow.position.set(0, 0, this.tipLocal.z + 0.05); glow.visible = false;
      mesh.add(glow);
      this.game.scene.add(mesh);
      this.bolts.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), active: false, age: 0, roll: 0, traced: false, tracer: null, glow, glanced: false, mod: PLAIN_BOLT });
    }
    for (let i = 0; i < MAX_TRACERS; i++) this.tracers.push(new Tracer(this.game.scene));
  }
  /** a free tracer, else the one closest to expiring (oldest) */
  private takeTracer(): Tracer | null {
    let best: Tracer | null = null;
    for (const t of this.tracers) { if (!t.active) return t; if (t.endTime >= 0 && (!best || t.endTime < best.endTime)) best = t; }
    best ??= this.tracers[0] ?? null; // all 8 still flying: recycle the first
    for (const b of this.bolts) if (b.tracer === best) b.tracer = null;
    return best;
  }
  private endTracer(b: Bolt, point: THREE.Vector3): void {
    if (!b.tracer) return;
    b.tracer.finish(point, this.time);
    b.tracer = null;
  }

  /** world position of the loaded bolt's broadhead tip (the iron sight) */
  tipWorld(out: THREE.Vector3): THREE.Vector3 { return this.loadedBolt.localToWorld(out.copy(this.tipLocal)); }
  /** The aim line is ALWAYS the camera forward (the crosshair / the peep ring's centre), hip or sighted — the user
   *  found sighted shots landing low when they flew along the eye→tip ray. Sighted bolts start at the tip, which is
   *  a few cm under the eye, and fly parallel to the forward: at any range that is the same point as the hip shot. */
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private spawnBolt(): void {
    let b = this.bolts.find((x) => !x.active);
    b ??= this.bolts.reduce((a, x) => (x.age > a.age ? x : a));
    const a = sstep(0, 1, this.adsBlend);
    this.aimRay(_v3, _fwd);
    // spread: tight at ADS, a touch wider from the hip
    const spread = THREE.MathUtils.degToRad(0.15 + (1 - a) * 0.6);
    _dir.copy(_fwd);
    _v1.set((gameplayRandom() - 0.5) * 2, (gameplayRandom() - 0.5) * 2, (gameplayRandom() - 0.5) * 2).cross(_fwd).normalize();
    _dir.addScaledVector(_v1, Math.tan(spread * gameplayRandom())).normalize();
    // Simulation launches from command data; the drawn bolt never chooses a shot's origin.
    b.pos.copy(_v3).addScaledVector(_fwd, 0.35);
    b.vel.copy(_dir).multiplyScalar(this.profile.speed);
    b.active = true; b.age = 0; b.roll = 0; b.glanced = false;
    b.mod = this.boltMod; b.ammo = this.nextAmmo(); this.onShot(b); b.mesh.material = b.mod.material ?? this.boltMat;
    b.mesh.visible = true;
    b.mesh.position.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir);
    if (b.tracer) b.tracer.finish(b.pos, this.time); // slot stolen mid-flight: close its old trail
    b.traced = getSetting('tracers'); // read per shot: a pause-menu flip applies to the next bolt
    b.tracer = b.traced ? this.takeTracer() : null;
    b.tracer?.begin(b.pos);
    b.glow.visible = b.traced;
  }

  /**
   * Iron-sights pose, derived once per (aspect, fov, scale): model rotation is (ADS_PITCH, 0, 0) so the bolt runs
   * parallel to the camera forward, and the translation puts the tip on the ray to NDC (0, ADS_TIP_NDC_Y).
   * With the tip depth D and the eye h above the bolt: h = -ADS_TIP_NDC_Y·tan(fov/2)·D. The nut sits A = (nut.z - tip.z)·scale
   * behind the tip, at depth D - A; asking for it at ADS_NUT_NDC_Y gives one linear equation in D. The near plane
   * (+ margin) caps how close the nut may come, which is what limits the 94° portrait frame.
   */
  private solveAds(cam: THREE.PerspectiveCamera, scale: number): Crossbow['adsPose'] {
    const c = this.adsCache, o = this.adsPose;
    if (c.aspect === cam.aspect && c.fov === cam.fov && c.scale === scale) return o;
    c.aspect = cam.aspect; c.fov = cam.fov; c.scale = scale;
    // Shouldered: the stock is pulled up under the cheek so the eye sits a few cm above the rail and looks straight down
    // the bolt; the nut is as close as the near plane allows (that is what "pinned into the shoulder" looks like).
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), th = tv * cam.aspect;
    const tip = this.tipModel, nut = this.nockDrawn;
    const A = (nut.z - tip.z) * scale;
    const nutDepth = cam.near + ADS_NEAR_MARGIN;
    const D = nutDepth + A;
    o.px = 0; o.py = -ADS_EYE_ABOVE_RAIL; o.pz = -D - tip.z * scale; o.rx = ADS_PITCH; o.scale = scale;
    o.tipDepth = D; o.eyeAboveRail = ADS_EYE_ABOVE_RAIL; o.nutDepth = nutDepth;
    o.nutNdcY = (nut.y * scale + o.py) / (nutDepth * tv); o.tipNdcY = (tip.y * scale + o.py) / (D * tv);
    o.limbNdcX = (this.tipR.x * scale) / (-(this.tipR.z * scale + o.pz) * th);
    // peep: a real rear sight MOUNTED ON THE STOCK at model z = PEEP_Z, its centre exactly at eye height (on the forward
    // line → screen centre); fixed physical size, so the post is short and the ring reads as part of the weapon.
    o.peepZ = PEEP_Z; o.peepY = ADS_EYE_ABOVE_RAIL / scale; o.peepDepth = -(o.pz + PEEP_Z * scale);
    o.peepR = PEEP_R_WORLD;
    return o;
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceFire += dt;

    // auto reload
    if (!this.state.loaded && !this.state.reloading && this.state.bolts > 0 && this.sinceFire > this.profile.autoReload) this.reload();
    if (this.state.reloading) {
      this.reloadT += dt / this.reloadScale;
      const pr = Math.min(1, this.reloadT / this.profile.reload);
      this.state.reloadProgress = pr;
      this.drawTarget = sstep(0.18, 0.78, pr);
      if (pr >= 1) { this.state.reloading = false; this.state.loaded = true; this.drawTarget = 1; this.onReloadEnd?.(); }
    }
    // string spring (stiff, slightly under-damped so the release overshoots)
    const k = this.state.reloading ? 260 : 1400, c = this.state.reloading ? 28 : 34;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.updateString();

    // loaded bolt: visible once the reload is ~85 % through (slides in from the rear)
    const showBolt = this.state.loaded || (this.state.reloading && this.state.reloadProgress > 0.8);
    this.loadedBolt.visible = showBolt;
    this.loadedBolt.material = this.boltMod.material ?? this.boltMat;
    if (showBolt && this.state.reloading) {
      const slide = 1 - sstep(0.8, 1, this.state.reloadProgress);
      this.loadedBolt.position.z = 0.128 - 0.18 + slide * 0.12;
      this.loadedBolt.position.y = 0.0095 + slide * 0.02;
    } else { this.loadedBolt.position.z = 0.128 - 0.18; this.loadedBolt.position.y = 0.0095; }

    // ADS + FOV
    if (p.sprinting || !this.enabled) this.mouseAds = false; // sprinting / pause / holster drop the RMB toggle
    this.state.ads = (this.mouseAds || this.adsHeld) && this.enabled && !this.state.reloading && !p.sprinting;
    this.adsBlend = blendAds(this.adsBlend, this.state.ads, dt, this.profile.adsBlend);
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (kick up on fire, recover smoothly)
    this.recoil *= Math.exp(-dt * 9);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, this.profile.kick * dt * 40); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    // stiff spring (k=220): explicit Euler blows up once k·dt² > 1 (≈ 15 fps on a phone) → substep at ≤ 1/120 s
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = this.state.reloading ? Math.sin(Math.min(1, this.state.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt; // portrait: the sprint swing would fill the frame
    // portrait phone: the wider FOV + narrow frame make the bow fill the screen — hold it lower, further out, smaller
    const port = portrait, scale = 1.35 * (1 - port * 0.55);
    // shared motion: breathing / idle sway, walk bob (counter-phase to the camera bob → the weapon feels heavy),
    // look lag (spring), recoil. The hip takes it in full, the sights ~30 % (this.profile.adsMotion) so the tip stays on the aim line.
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.016 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.012 * sf, bobRz = Math.cos(p.bobTime) * 0.02 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.01 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil;
    // hip: lower-right (Skyrim)
    let px = 0.12, py = -0.165, pz = -0.27, rx = 0.035, ry = 0.13, rz = 0.04;
    // sprint: drop and swing across the body
    px += sp * -0.05; py += sp * -0.09; pz += sp * 0.04; rx += sp * 0.32; ry += sp * 0.45; rz += sp * -0.15;
    // reload: tilt the bow up-left to reach the string, crank shake
    const crank = this.state.reloading ? Math.sin(this.state.reloadProgress * Math.PI * 14) * (this.state.reloadProgress > 0.15 && this.state.reloadProgress < 0.8 ? 1 : 0) : 0;
    px += rt * -0.06; py += rt * -0.05; pz += rt * 0.02; rx += rt * 0.35 + crank * 0.008; ry += rt * -0.28; rz += rt * 0.42 + crank * 0.012;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.07; py += rc * 0.015; rx += rc * 0.12; rz += rc * -0.03;
    // target: the whole prod visible inside ~60 % of the screen width (prod ≈ 0.68 m × scale at |pz| + 0.3 × scale)
    px *= 1 - port * 0.25; py *= 1 + port * 0.7; pz *= 1 + port * 1.5;
    // iron sights: cheek on the stock, looking straight down the bolt — pose solved from the geometry (solveAds);
    // recoil kicks the muzzle up but barely back, the nut is already a hair in front of the near plane
    if (a > 0) {
      const ads = this.solveAds(cam, scale), m = this.profile.adsMotion;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.01, az = ads.pz + rc * 0.015;
      const arx = ads.rx + (bobRx + lagRx) * m + rc * 0.1, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.02;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }

    // peep sight: posed from the solve, faded with the blend (its centre, the eye and the tip are collinear at a = 1)
    if (a > 0.001 && !this.inspect) {
      const ads = this.solveAds(cam, scale);
      this.peep.visible = true;
      this.peep.position.set(0, ads.peepY, ads.peepZ);
      this.peepRing.scale.setScalar(ads.peepR / (scale * PEEP_R));
      this.peepPost.scale.y = Math.max(0.001, ads.peepY);
      for (const m of this.peepMats) m.opacity = a;
    } else this.peep.visible = false;

    if (this.inspect) { px = 0.02; py = -0.02; pz = -0.42; rx = 0.35; ry = 0.9 + Math.sin(t * 0.25) * 0.5; rz = 0.1; }
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.32; pz += h * 0.08; rx -= h * 0.55; rz += h * 0.25; } // weapon swap: drop out of the frame
    this.model.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 14) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);
    this.hands?.aim(this.model);

    // aim readout
    if (this.targets && (++this.aimFrame & 3) === 0) {
      this.model.updateMatrixWorld(); // the pose was just set; the sight ray goes through the tip
      this.aimRay(_v3, _fwd);
      // an animal behind a wall shows no range (P5-L2): the world hit along the sight ray caps the reach
      const wall = worldHit(_v3, _aimEnd.copy(_v3).addScaledVector(_fwd, 120), 0);
      const hit = this.targets.raycast(_v3, _fwd, wall?.distance ?? 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBolts(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, cam, this.tracerRes);
  }

  private updateString(): void {
    const d = THREE.MathUtils.clamp(this.draw, -0.12, 1.05);
    const nock = _v1.copy(this.nockRest).lerp(this.nockDrawn, d);
    nock.y = this.nockRest.y + (1 - Math.abs(d - 0.5) * 2) * 0.002;
    this.placeLeg(this.stringLeft, this.tipL, nock);
    this.placeLeg(this.stringRight, this.tipR, nock);
    this.serving.position.copy(nock);
    this.serving.quaternion.setFromUnitVectors(X_AXIS, _v2.subVectors(this.tipR, this.tipL).normalize());
  }
  private placeLeg(leg: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    leg.position.copy(from);
    _v3.subVectors(to, from);
    const len = _v3.length();
    leg.scale.set(1, len, 1);
    leg.quaternion.setFromUnitVectors(Y_AXIS, _v3.multiplyScalar(1 / len));
  }

  // ── projectiles ──
  private stepBolts(dt: number): void {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.age += dt;
      const sub = 4, h = dt / sub;
      let stopped = false;
      for (let s = 0; s < sub; s++) {
        _v1.copy(b.pos); // previous
        const flight = b.ammo && this.equipEvents ? this.equipEvents.ask('projectile.modify', { ammo: b.ammo, gravity: b.ammo.flight.gravity, drag: b.ammo.flight.drag }) : b.mod;
        boltFlightStep(b.pos, b.vel, h, flight, this.profile);
        if (this.testHit(b, _v1)) { stopped = true; break; }
        b.tracer?.addPoint(b.pos);
      }
      if (stopped) continue;
      if (Math.abs(b.pos.x) > CHUNK_HALF + 60 || Math.abs(b.pos.z) > CHUNK_HALF + 60 || b.pos.y < -150 || b.age > 12) { b.active = false; b.mesh.visible = false; this.endTracer(b, b.pos); continue; }
      b.mesh.position.copy(b.pos);
      _dir.copy(b.vel).normalize();
      b.roll += dt * 14;
      b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(NEG_Z, b.roll));
      if (b.traced) b.glow.scale.setScalar(Math.max(1, TRACER_PX * b.pos.distanceTo(this.game.camera.position)));
    }
  }

  /**
   * The step prev → b.pos: the nearer of an animal (AnimalManager.raycast, cut short at the world hit so a wall in
   * front wins) and the world (a this.profile.radius ball swept through the physics world — terrain, trunks, rocks,
   * structures). By the surface's material the bolt sticks (wood, planks, ground, sand, grass), or glances off
   * (stone, rock, metal, shell): a short skip with most of its speed lost, then it lies on the first floor it falls on
   * (knocking off any wall on the way).
   * Returns true when the bolt stopped.
   */
  private testHit(b: Bolt, prev: THREE.Vector3): boolean {
    _dir.subVectors(b.pos, prev);
    const segLen = _dir.length();
    if (segLen < 1e-6) return false;
    _dir.multiplyScalar(1 / segLen);
    const wall = worldHit(prev, b.pos, this.profile.radius);

    // animals, short of the wall
    if (this.targets) {
      const hit = this.targets.raycast(prev, _dir, wall ? wall.distance : segLen);
      if (hit) {
        this.onBoltHit(hit);
        const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.point.distanceTo(this.player.position)) * b.mod.damage(hit.animal.kind), hit.point, _dir);
        this.onHit?.(hit.animal.kind, hit.headshot, killed);
        const frame = hit.animal.stuckFrame?.(hit.point) ?? null; // a practice dummy keeps the bolt, on the bone it hit
        const attached = frame instanceof THREE.Object3D ? frame : null;
        this.stopBolt(b, hit.point, _dir, 'flesh', attached !== null, this.profile.bury, false, attached);
        return true;
      }
    }
    if (!wall) return false;
    const n = _v2.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(_dir) > 0) n.negate(); // facing the bolt
    const at = _v3.set(wall.point.x, wall.point.y, wall.point.z); // the ball's centre, touching the surface
    if (b.glanced && n.y >= 0.5) { this.restBolt(b, at, n); return true; } // a spent bolt lies where it lands
    const surface = impactSurfaceOf(wall.material);
    if (!b.glanced && sticksIn(wall.material)) {
      // the ball touches one radius off the surface: the tip carries on along the flight to it
      at.addScaledVector(_dir, this.profile.radius / Math.max(0.25, -n.dot(_dir)));
      this.stopBolt(b, at, _dir, surface, true, this.profile.bury, false, movingOwner(wall.owner));
      return true;
    }
    // glance: off the surface with little of the speed left, then gravity has it
    at.addScaledVector(n, GLANCE_LIFT);
    if (!b.glanced) { this.puffs.emit(at, _dir, surface); this.onImpact?.(surface, at); } // a spent bolt knocks off walls quietly
    const vn = b.vel.dot(n);
    b.vel.addScaledVector(n, -vn).multiplyScalar(GLANCE_KEEP).addScaledVector(n, -vn * GLANCE_BOUNCE);
    if (b.vel.length() > GLANCE_MAX) b.vel.setLength(GLANCE_MAX);
    b.pos.copy(at);
    b.glanced = true;
    return false;
  }

  /** A spent (glanced) bolt comes to rest lying on the surface it fell onto: along its travel, flat to the surface. */
  private restBolt(b: Bolt, at: THREE.Vector3, n: THREE.Vector3): void {
    const along = _v1.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.crossVectors(n, Math.abs(n.y) < 0.9 ? Y_AXIS : X_AXIS); // fell straight down: any way along the surface
    along.normalize();
    // the tip half a bolt ahead of the contact so the shaft lies across it, on the surface instead of a radius above it
    at.addScaledVector(n, -this.profile.radius * 0.8).addScaledVector(along, (this.nockZ - this.tipLocal.z) * 0.5);
    this.stopBolt(b, at, along, 'ground', true, 0, true);
  }

  /** `bury`: how deep the broadhead goes in; `quiet`: no puff / impact event (a spent bolt settling) */
  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean, bury = this.profile.bury, quiet = false, rideOn: THREE.Object3D | null = null): void {
    b.active = false; b.mesh.visible = false;
    this.endTracer(b, point);
    if (!quiet) {
      this.puffs.emit(point, dir, surface);
      this.onImpact?.(surface, point);
    }
    if (!stick) return;
    // stick: a static mesh, permanent, with the broadhead this.profile.bury into the surface and the shaft + fletching
    // standing proud. The geometry origin sits -tipLocal.z (≈ 21.5 cm, measured from the bounding box) behind
    // the tip, so the origin goes this.profile.bury + tipLocal.z along the flight direction from the hit point.
    if (this.stuck.length >= this.profile.maxStuck) this.removeStuck(0);
    const mesh = new THREE.Mesh(this.boltGeo, b.mod.material ?? this.boltMat);
    mesh.castShadow = true;
    mesh.position.copy(point).addScaledVector(dir, bury + this.tipLocal.z);
    mesh.quaternion.setFromUnitVectors(NEG_Z, dir).multiply(_q.setFromAxisAngle(NEG_Z, b.roll));
    if (b.traced) { // permanent red dot on the nock so a traced bolt reads from a distance
      const dot = new THREE.Mesh(stuckDotGeo, glowMat); dot.renderOrder = TRACER_ORDER + 1;
      dot.position.set(0, 0, this.nockZ);
      mesh.add(dot);
    }
    this.game.scene.add(mesh);
    if (rideOn !== null) rideOn.attach(mesh); // stuck in something that moves (the boat, a door): it rides along (P5-L1)
    this.stuck.push({ mesh });
  }
  private removeStuck(i: number): void {
    const s = this.stuck.splice(i, 1)[0];
    if (s !== undefined) s.mesh.removeFromParent();
  }

  /** the iron bolt's material (special bolts dress a uniform-only clone of it — BoltMod.material) */
  get boltMaterial(): THREE.Material { return this.boltMat; }
  /** flying bolt count (for debugging / HUD) */
  get inFlight(): number { let n = 0; for (const b of this.bolts) if (b.active) n++; return n; }
  get stuckCount(): number { return this.stuck.length; }
}

/** The Object3D a hit collider moves with: a registered piece that `follows` one (the boat, a cabin door), else null. */
function movingOwner(owner: unknown): THREE.Object3D | null {
  if (typeof owner !== 'object' || owner === null || !('follows' in owner)) return null;
  const f = (owner as { follows?: unknown }).follows;
  return f instanceof THREE.Object3D ? f : null;
}
