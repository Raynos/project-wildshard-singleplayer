import { cyl, dataTexture, viewmodelTexSet, remapUV, makeCord, makeBoltAtlas, fixIBL, VIEWMODEL_GROUP, viewmodelMaterial, box, edgeWear, stripExtra } from '@wildshard/engine/combat/view/ranged';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { crossbowType, type BoltCrossbowParts, type BoltCrossbowView, type BoltCrossbowWeapon } from '@wildshard/sdk/items/boltCrossbow';
import { BUCKSKIN, HANDS_MATERIAL, WeaponHands, coatMaterialParams, holdDef, type HandHold } from '../../../weapons/hunterHands';
import { CROSSBOW_PROFILE, type CrossbowProfile } from '../../../weapons/crossbow/profiles';
import { boltFlightStep } from '../../../weapons/crossbow/flight';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
 * Events, state and side effects: the family's (src/game/systems/items/boltCrossbow.ts).
 */

export const MAX_BOLTS = 30;
/** Rear PEEP sight (mockup art/ads-aim/round-1/ads-C-peep-sight.png): a dark-iron ring on a post just in front of the nut (the stock
 *  behind the nut is inside the near plane when sighted), placed on the eye→tip line so that at full ADS its centre
 *  projects exactly where the tip does — the tip is seen through the ring. Outer diameter ≈ 4 % of the screen width
 *  (≥ 7 % of the height, so it stays a ring on a portrait phone). Hidden at the hip, fades in with the ADS blend. */
const PEEP_R = 0.01, PEEP_TUBE = 0.12, PEEP_CYAN = 0x8fe3ff; // rear peep: 2.1 cm ring (CROSSBOW_VIEW.peep) on a short post just ahead of the nut

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

/**
 * The crossbow in model space (−Z the bolt, +Y up, the rail top at y 0; the nut at z +0.14, the prod at z −0.30): the stock,
 * the iron, the brass, the prod, the string (its legs unposed: the viewmodel poses them every frame), the leather, the loaded
 * bolt and the rear peep sight (in `peep` / `peepRing`, hidden), added to `into.model`, every lit part on the viewmodels'
 * shared program. The viewmodel's build and the Model Explorer's card (src/shards/pine-hollow/models/gear.ts, through
 * Skins.crossbowDisplayModel) are this one function, so the two never drift; the geometries without wear colours need
 * `whiteColors` before a draw.
 */
export function buildCrossbow(sky: Sky, into: { readonly model: THREE.Group; readonly peep: THREE.Group; readonly peepRing: THREE.Group }): BoltCrossbowParts {
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

/** Pine's iron-sights view: the hip pose (lower-right, Skyrim) at 1.35×; the cheek on the stock (the eye 5.6 cm above the
 *  rail, looking straight down the bolt, the nut 3 cm in front of the near plane); the peep at model z 0.10, 2.1 cm. */
export const CROSSBOW_VIEW: BoltCrossbowView = {
  hip: { px: 0.12, py: -0.165, pz: -0.27, rx: 0.035, ry: 0.13, rz: 0.04, scale: 1.35 },
  ads: { eyeAboveRail: 0.056, nearMargin: 0.03, pitch: 0 },
  peep: { z: 0.10, radius: PEEP_R, worldRadius: 0.0105 },
};

/**
 * E322 F-M6: the hunter's gloved hands (hunterHands.ts; Jake's pick B), in model space: the left hand round the back of
 * the fore-end's leather — its thumb up the near side, its fingers up the far side, the coat sleeve free (aimed at an
 * elbow off the frame's lower left, so the reload's tilt never swings the arm away); the right under the grip with the
 * index by the trigger. Both in the coat's sleeves. A dev knob: edit, then the crossbow's `rebuildHands()`.
 */
export const CROSSBOW_HAND_HOLDS: { left: HandHold; right: HandHold } = {
  left: { spec: { R: 0.025, curl: 0.7, thumbCurl: 0.9, armLen: 1, tint: 2.2, gloveTint: BUCKSKIN, coat: true, elbow: [-0.35, -0.45, -0.45] }, at: [0.004, -0.034, -0.04], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { spec: { R: 0.03, curl: 0.6, thumbCurl: 0.9, bend: [0.8, -1.2], armLen: 0.6, tint: 2.2, gloveTint: BUCKSKIN, coat: true }, at: [0, -0.09, 0.33], axis: [0, 0.34, -0.94], palm: [0, 1, 0] },
};
/** The hands' maker: the glove and coat materials once per crossbow, a fresh pair from the holds on every build. */
function crossbowHands(sky: Sky): (model: THREE.Group) => WeaponHands {
  let handsMat: THREE.MeshPhysicalMaterial | null = null, coatMat: THREE.MeshPhysicalMaterial | null = null;
  return (model) => {
    handsMat ??= viewmodelMaterial(sky, 'hunter-hands', HANDS_MATERIAL);
    coatMat ??= viewmodelMaterial(sky, 'hunter-coat', coatMaterialParams());
    return new WeaponHands(model, handsMat, holdDef(CROSSBOW_HAND_HOLDS.left), holdDef(CROSSBOW_HAND_HOLDS.right), coatMat);
  };
}

/** Pine's crossbow: the row bound to the platform's bolt crossbow (`new Crossbow(world, targets, { row })`). */
export const Crossbow = crossbowType({ profile: CROSSBOW_PROFILE, parts: buildCrossbow, hands: crossbowHands, flight: boltFlightStep, view: CROSSBOW_VIEW });
/** A built Pine crossbow. */
export type CrossbowWeapon = BoltCrossbowWeapon<CrossbowProfile>;
