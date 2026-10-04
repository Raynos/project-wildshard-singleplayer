import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import { skinPlain, type Paint } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import { CREATURE_CLIPS, creatureFactory, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { KING_BONES, animateKing } from '../combat/kingRig';

/**
 * The Antler King's STAND-IN look (PINE-HOLLOW-REMASTER PH-C2; the final model is PH-M3, board B2 pick A "the Bark
 * Warden": art/pine-hollow/round-2-antler-king/A-bark-warden.jpg). Until M3 lands the fight runs on the procedural elk
 * rig (species/elk.ts, registered again as kind 'antler-king' by antlerKing.ts) scaled to ~7 m, in a bark-dark,
 * moss-shouldered coat, with the board's three signature pieces bolted onto its bones:
 *
 *   · three antler LANTERNS hanging off the rack (iron frame + amber glass; emissive only — the fight's one pooled light
 *     is antlerKing.ts's, never a light per lantern)
 *   · the amber RIBCAGE on the chest: a basket of glowing ribs round a burning core — the weak point; it "opens" (the
 *     ribs spread, the core flares) for the shot window
 *   · a bone-white SKULL plate over the face
 *
 * PH-M3 (the swap, done) and E322 F-M1 (Jake picked B): the King is his own upright hull on his own rig —
 * `public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb` (art/pine-hollow/round-25-e322-king-rig/,
 * src/shards/pine-hollow/combat/kingRig.ts; the Bark Warden hull on the elk's bones went with the Debug row) — and `dressAntlerKing`
 * hangs the lanterns off its own rack and drops the skull plate (the hull has its skull face); the ribcage rides his chest
 * bone. With Debug ▸ Creatures = Procedural (no hulls) he is kingRig's placeholder boxes with the lanterns at LANTERN_AT.
 *
 * THE SWAP: everything model-specific is here — `KING_VARIANT` (the coat), `KING_ANTLER_SCALE`, and `dressAntlerKing()`
 * (the one factory the fight calls on a freshly spawned King). When PH-M3's Bark Warden hull exists, `dressAntlerKing`
 * keeps its `KingLook` contract (lanterns / ribcage / glow) and attaches to the hull's bones instead; antlerKing.ts
 * does not change. Offsets below are the elk's model space (species/elk.ts: head bone (0, 2.28, 1.40), body bone
 * (0, 1.50, −0.06), the rack's dagger / fifth tines), i.e. before the ×KING_SCALE mesh scale.
 */

/** the stand-in's size: the elk ×2.6 → ~3.9 m at the shoulder, ~7 m to the antler tips */
export const KING_SCALE = 2.6;
export const KING_ANTLER_SCALE = 1.5;
export const KING_HP = 1500;

/** the coat: bark-dark hide, moss on the mane and the rump, pale weathered antlers (elk.ts palette keys) */
export const KING_VARIANT: VariantDef = {
  id: 'warden', label: 'The Antler King', weight: 1, rarity: 'legendary', scale: [KING_SCALE, KING_SCALE], hp: KING_HP,
  tint: {
    body: [0.15, 0.12, 0.09], bodyDark: [0.09, 0.075, 0.055], neck: [0.085, 0.075, 0.055], mane: [0.13, 0.17, 0.08],
    belly: [0.07, 0.06, 0.045], rump: [0.19, 0.22, 0.12], legDark: [0.065, 0.055, 0.045],
    antler: [0.42, 0.38, 0.31], antlerTip: [0.78, 0.74, 0.64],
  },
  // selfLight: on the Bark Warden hull (PH-M3) his bark and bone feed back as emissive, so he reads in the dark arena
  traits: { antlers: 1, antlerScale: KING_ANTLER_SCALE, selfLight: 0.45 },
};

/** where the three lanterns hang (head-bone local, model units): off the left dagger tine, the right beam, the right fifth tine */
const LANTERN_AT: [number, number, number][] = [[-0.6, 1.5, -0.19], [0.7, 1.02, -0.82], [0.84, 1.6, -0.67]];
const RIB_R = 0.36;
/** the ribcage basket, E322 F-M1's upright rig: in the barrel chest's front, under the hump (chest-bone local; the hull's
 *  chest front is at z 1.37–1.43 between 1.6 and 1.75 m, the chest joint at (0, 2.1, 0.735)) */
const RIB_AT: [number, number, number] = [0, -0.45, 0.47];

const AMBER = new THREE.Color(1.0, 0.56, 0.16);

/** the shared geometries + materials (built once at boot, so their programs are compiled with the rest) */
export interface KingKit {
  frameGeo: THREE.BufferGeometry; glassGeo: THREE.BufferGeometry; ribGeo: THREE.BufferGeometry; coreGeo: THREE.BufferGeometry; skullGeo: THREE.BufferGeometry;
  frameMat: THREE.MeshStandardMaterial; glassMat: THREE.MeshStandardMaterial; ribMat: THREE.MeshStandardMaterial; coreMat: THREE.MeshStandardMaterial; skullMat: THREE.MeshStandardMaterial;
}

export function makeKingKit(sky: Sky): KingKit {
  // the lantern: a cap, a base, four bars and the hanging ring, ~0.3 × 0.16 model units (≈ 0.8 m on the King)
  const parts: THREE.BufferGeometry[] = [];
  const cap = new THREE.ConeGeometry(0.1, 0.08, 8); cap.translate(0, 0.12, 0); parts.push(cap);
  const base = new THREE.CylinderGeometry(0.085, 0.09, 0.025, 8); base.translate(0, -0.1, 0); parts.push(base);
  for (let i = 0; i < 4; i++) { const b = new THREE.BoxGeometry(0.012, 0.2, 0.012); const a = (i / 4) * Math.PI * 2 + Math.PI / 4; b.translate(Math.cos(a) * 0.075, 0.0, Math.sin(a) * 0.075); parts.push(b); }
  const ring = new THREE.TorusGeometry(0.03, 0.008, 5, 10); ring.translate(0, 0.18, 0); parts.push(ring);
  const chain = new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4); chain.translate(0, 0.33, 0); parts.push(chain);
  const frameGeo = mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
  const glassGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.17, 10);
  // the ribs: five horizontal half-hoops round the front (+z), widest in the middle, plus the sternum
  const ribs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const y = (i - 2) * 0.13, r = RIB_R * Math.sqrt(1 - (y / (RIB_R * 1.25)) ** 2);
    const t = new THREE.TorusGeometry(r, 0.028, 5, 18, Math.PI);
    t.rotateX(Math.PI / 2); t.translate(0, y, 0);
    ribs.push(t.toNonIndexed());
  }
  const sternum = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5); sternum.translate(0, 0, RIB_R * 0.98); ribs.push(sternum.toNonIndexed());
  const ribGeo = mergeGeometries(ribs, false);
  const coreGeo = new THREE.IcosahedronGeometry(RIB_R * 0.72, 1);
  const skullGeo = new THREE.IcosahedronGeometry(1, 2); skullGeo.scale(0.15, 0.12, 0.34);
  const lit = (m: THREE.MeshStandardMaterial) => { sky.setupMaterial(m); return m; };
  const glow = (i: number) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: AMBER, emissiveIntensity: i, roughness: 0.6, metalness: 0, fog: false });
  return {
    frameGeo, glassGeo, ribGeo, coreGeo, skullGeo,
    frameMat: lit(new THREE.MeshStandardMaterial({ color: 0x2b2520, roughness: 0.55, metalness: 0.75 })),
    glassMat: glow(3), ribMat: glow(2), coreMat: glow(4),
    skullMat: lit(new THREE.MeshStandardMaterial({ color: 0xd9d0b8, roughness: 0.85, metalness: 0 })),
  };
}

/** what the fight drives on the King's look */
export interface KingLook {
  /** the three antler lanterns, while they hang (world position of lantern i) */
  lanternWorld: (i: number, out: THREE.Vector3) => THREE.Vector3;
  setLanternsHung: (on: boolean) => void;
  /** the ribcage's world centre and radius (the weak point's hit sphere) */
  ribcageWorld: (out: THREE.Vector3) => THREE.Vector3;
  readonly ribcageRadius: number;
  /** 0 dark … 1 burning (the intro ignites it) */
  setGlow: (k: number) => void;
  /** 0 shut … 1 open (the ribs spread, the core flares); `t` for the breathing */
  setOpen: (k: number, t: number) => void;
  /** a free-standing lantern (a fallen one): frame + glass, world scale */
  makeLantern: () => THREE.Group;
  dispose: () => void;
}

/** the King is on a generated hull (pineCreatures.ts): one group and no fur-shell `furLen` (the procedural loft has it) */
const isHull = (a: Animal): boolean => !a.mesh.geometry.hasAttribute('furLen');

/**
 * PH-M3: where the lanterns hang on the Bark Warden's own rack (head-bone local, model units) — three tine ends picked off
 * the hull: the rack's outermost left and right points and the right beam's middle, each lantern hung just under its
 * tine. Null when the King is the procedural stand-in (the offsets above) or the hull has no rack above the head.
 */
function hullLanterns(a: Animal): [number, number, number][] | null {
  if (!isHull(a)) return null;
  // the head bone's rest position, from the skeleton's bind (model units, the rig's own joints)
  const sk = a.mesh.skeleton, hi = sk.bones.findIndex((b) => b.name === 'head'), inv = sk.boneInverses[hi];
  if (hi === -1 || !inv) return null;
  const hp = new THREE.Vector3().setFromMatrixPosition(inv.clone().invert());
  const head: [number, number, number] = [hp.x, hp.y, hp.z];
  const P = a.mesh.geometry.getAttribute('position');
  let left = -1, right = -1, mid = -1, lx = Infinity, rx = -Infinity, best = -Infinity;
  const above = (i: number): boolean => P.getY(i) > head[1] + 0.25 && Math.abs(P.getZ(i) - head[2]) < 1.2;
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    const x = P.getX(i);
    if (x < lx) { lx = x; left = i; }
    if (x > rx) { rx = x; right = i; }
  }
  if (left < 0 || right < 0) return null;
  // the right beam's middle: the highest rack point about halfway out to the right
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    const x = P.getX(i);
    if (Math.abs(x - rx * 0.5) < Math.abs(rx) * 0.15 && P.getY(i) > best) { best = P.getY(i); mid = i; }
  }
  const at = (i: number): [number, number, number] => [P.getX(i) - head[0], P.getY(i) - head[1] - 0.2, P.getZ(i) - head[2]];
  return mid >= 0 ? [at(left), at(right), at(mid)] : [at(left), at(right)];
}

/** dress a freshly spawned King: lanterns on the head bone, the ribcage on the chest bone. On his hull (the generated
 *  model: its own skull face and rack) the lanterns hang off its rack and the skull plate is left off */
export function dressAntlerKing(a: Animal, kit: KingKit): KingLook {
  const head = a.mesh.getObjectByName('head'), chest = a.mesh.getObjectByName('chest');
  if (!head || !chest) throw new Error('antler-king: the rig has no head / chest bone');
  const own: THREE.Object3D[] = [];
  const lanterns: THREE.Group[] = [];
  const makeLantern = (): THREE.Group => {
    const g = new THREE.Group();
    const f = new THREE.Mesh(kit.frameGeo, kit.frameMat), gl = new THREE.Mesh(kit.glassGeo, kit.glassMat);
    f.castShadow = false; gl.castShadow = false;
    g.add(f, gl);
    return g;
  };
  const hull = isHull(a);
  for (const p of hullLanterns(a) ?? LANTERN_AT) {
    const l = makeLantern();
    l.position.set(p[0], p[1], p[2]);
    head.add(l); lanterns.push(l); own.push(l);
  }
  if (!hull) {
    const skull = new THREE.Mesh(kit.skullGeo, kit.skullMat);
    skull.position.set(0, 0.03, 0.2); skull.rotation.x = 0.55; skull.castShadow = false;
    head.add(skull); own.push(skull);
  }
  const cage = new THREE.Group();
  // the ribcage rides the chest, which rears and recoils with him
  cage.position.set(RIB_AT[0], RIB_AT[1], RIB_AT[2]);
  const ribs = new THREE.Mesh(kit.ribGeo, kit.ribMat), core = new THREE.Mesh(kit.coreGeo, kit.coreMat);
  ribs.castShadow = false; core.castShadow = false;
  cage.add(core, ribs);
  chest.add(cage); own.push(cage);
  let glow = 1;
  const scale = a.scale;
  return {
    lanternWorld: (i, out) => { const l = lanterns[i]; return l ? l.getWorldPosition(out) : out.copy(a.position); },
    setLanternsHung: (on) => { for (const l of lanterns) l.visible = on; },
    ribcageWorld: (out) => cage.getWorldPosition(out),
    ribcageRadius: RIB_R * scale * 1.15,
    setGlow: (k) => { glow = k; kit.glassMat.emissiveIntensity = 3 * k; kit.ribMat.emissiveIntensity = 2 * k; kit.coreMat.emissiveIntensity = 4 * k; },
    setOpen: (k, t) => {
      const breathe = 1 + 0.04 * Math.sin(t * 3.1);
      ribs.scale.set((1 + 0.45 * k) * breathe, 1 + 0.12 * k, (1 + 0.3 * k) * breathe);
      core.scale.setScalar(1 + 0.25 * k);
      kit.coreMat.emissiveIntensity = glow * (3 + 9 * k);
      kit.ribMat.emissiveIntensity = glow * (1.6 + 2.4 * k);
    },
    makeLantern: () => { const l = makeLantern(); l.scale.setScalar(scale); return l; },
    dispose: () => { for (const o of own) o.removeFromParent(); },
  };
}

// ─────────────── his own rig (E322 F-M1) ───────────────

/** the stand-in paint of the own rig's placeholder parts (only seen if its hull fails to load) */
const BARK: Paint = (out) => { out.setRGB(0.12, 0.1, 0.075); };

/** the placeholder body the factory merges before the hull replaces it: a box on the body, one on the head */
function buildOwnRig(): AnimalSpecies {
  const bones = KING_BONES.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] as [number, number, number] }));
  const at = (n: string): [number, number, number] => bones.find((b) => b.name === n)?.pos ?? [0, 0, 0];
  const bi = (n: string): number => Math.max(0, bones.findIndex((b) => b.name === n));
  const torso = new THREE.BoxGeometry(1.3, 1.2, 2.2); torso.translate(at('body')[0], at('body')[1], at('body')[2]);
  const skull = new THREE.BoxGeometry(0.4, 0.4, 0.6); skull.translate(at('head')[0], at('head')[1], at('head')[2] + 0.3);
  const eye = new THREE.SphereGeometry(0.04, 8, 6); eye.translate(0.14, at('head')[1], at('head')[2] + 0.35);
  return {
    bones, furParts: [skinPlain(torso, bi('body'), 'body', BARK)], hardParts: [skinPlain(skull, bi('head'), 'head', BARK)], eyeParts: [skinPlain(eye, bi('head'), 'eye', BARK)],
    // the hitbox path (src/engine/physics/creatures.ts) reads these, fitted to his hull (E350 F-X2, scripts/e350-king-measure.mjs:
    // rays from a standing eye over his silhouette in idle, the rear, the slam, the gallop and the sweep; hit volumes vs
    // the visible torso, shoulders and face — 77 % landed / 14 % through / 8 % from air, against 61 / 22 / 17 for the
    // elk-sized capsule it replaces). ×2.6: the barrel a capsule on the body bone, r 1.46 m, tilted 22° up to the front
    // and set back under the hips; the fore block (shoulders, chest, hump) a capsule r 1.79 m across the chest bone; the
    // head ball r 0.83 m on the face, not the joint. All three ride their bones (the rear, the sweep's dive). The motor
    // capsule stays 0.9 m wide (CreatureBodies clamps it)
    dims: {
      bodyY: 1.85, bodyHalfLen: 0.45, bodyRadius: 0.56, headRadius: 0.32, legLen: 1.85, halfWidth: 0.8,
      feet: [[0.65, 1.25], [-0.66, 1.25], [0.57, -1.42], [-0.6, -1.42]],
      bodyAt: [0, -0.3, -0.32], bodyPitch: 0.38, headAt: [0, -0.06, 0.12],
      fore: { bone: 'chest', at: [0, -0.14, 0.05], halfLen: 0.22, radius: 0.69 },
    },
  };
}

/**
 * The King's species on his own rig (E322 F-M1): `base` (the fight's elk-derived King: his coat, sounds,
 * AI hook and damage rule) as a custom rig — KING_BONES and kingRig.ts's poses instead of the elk's bones and gaits. The
 * hull (`antler-king-rig[.phone].rigged.glb`) replaces the placeholder through pineCreatures.ts like every Pine Hollow hull.
 */
export function kingOwnSpecies(base: SpeciesDef): SpeciesDef {
  // (the elk's postPose / gait knobs are the quadruped path's: a custom rig never runs them)
  return { ...base, rigContract: { skeleton: 'antler-king.v1', clips: [], sockets: ['body', 'head'] }, rig: 'custom', animate: animateKing, build: () => buildOwnRig() };
}

// ─────────────── the model (E306 / E315 M5) ───────────────

/** his species (src/shards/pine-hollow/combat/antlerKing.ts `KING_KIND`): registered by the fight at boot on his own rig (`registerKing`) */
const KING_KIND = 'antler-king';
const KING_KIT = 'pine-hollow/antler-king:kit';

/**
 * The Antler King, Pine Hollow's boss: his own hull (Hunyuan3D-2, `public/assets/pine-hollow/creatures/antler-king-rig
 * [.phone].rigged.glb`) on his own rig (kingRig.ts), drawn ×2.6 by the fight, dressed in code (`dressAntlerKing`: the antler
 * lanterns, the amber ribcage; the skull plate on the procedural stand-in). The fight (src/shards/pine-hollow/combat/antlerKing.ts) spawns,
 * dresses and drives the one copy at night in the King's clearing; nothing here draws him in the world.
 *
 * His fields are `creature(KING_KIND)`'s spelled out from his one coat (`KING_VARIANT`), not `creature()` itself: his
 * species is registered by the fight at boot (the elk's fields on his own rig, with the fight's damage hook), and this module
 * can load before that — importing the fight from here would be a cycle (it imports this file for his look). The specimen
 * (`build`) is one rig from the shard's creature factory, dressed as the fight dresses him — the lanterns and the ribcage
 * at full glow — at the rig's own scale like every species model.
 */
export const antlerKing: ModelDef<CreatureParams> = defineModel<CreatureParams>({
  id: 'pine-hollow/antler-king', name: KING_VARIANT.label, category: 'creatures', pipeline: ['hunyuan', 'code'], file: 'src/shards/pine-hollow/models/antlerKing.ts', surface: 'wood',
  defaults: { variant: KING_VARIANT.id },
  variants: [{ id: KING_VARIANT.id, label: KING_VARIANT.label, params: { variant: KING_VARIANT.id } }],
  rig: { clips: CREATURE_CLIPS, species: KING_KIND, dress: (a, ctx) => { dressAntlerKing(a, ctx.once(KING_KIT, () => makeKingKit(ctx.sky))); } },
  build: (ctx, p) => {
    const f = creatureFactory(ctx);
    const model = f.model(KING_KIND, p.variant);
    const a = new Animal(f.instantiate(model, 0.5), model, 7, 1);
    dressAntlerKing(a, ctx.once(KING_KIT, () => makeKingKit(ctx.sky)));
    return a.mesh;
  },
});
