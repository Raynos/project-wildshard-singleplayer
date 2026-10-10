import * as THREE from 'three';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import { skinPlain, type Paint } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import { CREATURE_CLIPS, creatureFactory, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildPrimitive, mergePrimitives, standardMaterial } from '@wildshard/sdk/kit/mergedPrimitives';
import { KING_COAT, KING_DRESS, KING_OWN_RIG } from '../data/antlerKingLook';
import { KING_BONES, animateKing, observeKingPose } from '../combat/kingRig';
import { bindKingQueryView } from '../runtime/kingQueryView';
import { readKingCollisionBake } from '../runtime/kingCollisionBake';
import kingCollision from '../runtime/kingCollision.baked.json' with { type: 'json' };

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
 * bone. With Debug ▸ Creatures = Procedural (no hulls) he is kingRig's placeholder boxes with the lanterns at KING_DRESS.lanterns.
 *
 * THE SWAP: everything model-specific is here — `KING_VARIANT` (the coat), `KING_ANTLER_SCALE`, and `dressAntlerKing()`
 * (the one factory the fight calls on a freshly spawned King). When PH-M3's Bark Warden hull exists, `dressAntlerKing`
 * keeps its `KingLook` contract (lanterns / ribcage / glow) and attaches to the hull's bones instead; antlerKing.ts
 * does not change. Offsets below are the elk's model space (species/elk.ts: head bone (0, 2.28, 1.40), body bone
 * (0, 1.50, −0.06), the rack's dagger / fifth tines), i.e. before the ×KING_SCALE mesh scale.
 */

/** the stand-in's size: the elk ×2.6 → ~3.9 m at the shoulder, ~7 m to the antler tips */
export const KING_SCALE = KING_COAT.scale[0];
export const KING_ANTLER_SCALE = KING_COAT.traits.antlerScale;
export const KING_HP = KING_COAT.hp;

/** the coat (../data/antlerKingLook.ts `KING_COAT`): bark-dark hide, moss on the mane and the rump, pale weathered antlers */
export const KING_VARIANT: VariantDef = {
  ...KING_COAT, scale: [KING_COAT.scale[0], KING_COAT.scale[1]],
  tint: Object.fromEntries(Object.entries(KING_COAT.tint).map(([k, c]): [string, [number, number, number]] => [k, [c[0], c[1], c[2]]])),
};

const RIB_R = KING_DRESS.ribR;

/** the shared geometries + materials (built once at boot, so their programs are compiled with the rest) */
export interface KingKit {
  frameGeo: THREE.BufferGeometry; glassGeo: THREE.BufferGeometry; ribGeo: THREE.BufferGeometry; coreGeo: THREE.BufferGeometry; skullGeo: THREE.BufferGeometry;
  frameMat: THREE.MeshStandardMaterial; glassMat: THREE.MeshStandardMaterial; ribMat: THREE.MeshStandardMaterial; coreMat: THREE.MeshStandardMaterial; skullMat: THREE.MeshStandardMaterial;
}

/** the lantern, the ribcage, the core and the skull plate, and their iron, amber and bone (../data/antlerKingLook.ts `KING_DRESS`) */
export function makeKingKit(sky: Sky): KingKit {
  const D = KING_DRESS;
  const frameGeo = mergePrimitives(D.frame), glassGeo = buildPrimitive(D.glass);
  const ribGeo = mergePrimitives(D.ribs), coreGeo = buildPrimitive(D.core), skullGeo = buildPrimitive(D.skull);
  const lit = (m: THREE.MeshStandardMaterial) => { sky.setupMaterial(m); return m; };
  const glow = (i: number) => standardMaterial({ ...D.glowMat, emissive: D.amber, emissiveIntensity: i });
  return {
    frameGeo, glassGeo, ribGeo, coreGeo, skullGeo,
    frameMat: lit(standardMaterial(D.frameMat)),
    glassMat: glow(D.glow.glass), ribMat: glow(D.glow.ribs), coreMat: glow(D.glow.core),
    skullMat: lit(standardMaterial(D.skullMat)),
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
  // The procedural fallback keeps its own dimensions; only the real measured GLB uses the native collision table.
  const collision = hull ? bindKingQueryView(a, readKingCollisionBake(kingCollision), receive => observeKingPose(a, receive)) : null;
  for (const p of hullLanterns(a) ?? KING_DRESS.lanterns) {
    const l = makeLantern();
    l.position.set(p[0], p[1], p[2]);
    head.add(l); lanterns.push(l); own.push(l);
  }
  if (!hull) {
    const skull = new THREE.Mesh(kit.skullGeo, kit.skullMat);
    skull.position.set(KING_DRESS.skullAt[0], KING_DRESS.skullAt[1], KING_DRESS.skullAt[2]); skull.rotation.x = KING_DRESS.skullTilt; skull.castShadow = false;
    head.add(skull); own.push(skull);
  }
  const cage = new THREE.Group();
  cage.name = 'king-ribcage'; // The offline capture reads this actual attachment, independently of FK queries.
  // the ribcage rides the chest, which rears and recoils with him
  cage.position.set(KING_DRESS.ribAt[0], KING_DRESS.ribAt[1], KING_DRESS.ribAt[2]);
  const ribs = new THREE.Mesh(kit.ribGeo, kit.ribMat), core = new THREE.Mesh(kit.coreGeo, kit.coreMat);
  ribs.castShadow = false; core.castShadow = false;
  cage.add(core, ribs);
  chest.add(cage); own.push(cage);
  let glow = 1;
  const scale = a.scale;
  return {
    lanternWorld: (i, out) => {
      const l = lanterns[i];
      if (!l) return out.copy(a.position);
      l.getWorldPosition(out); collision?.publishHead();
      return out;
    },
    setLanternsHung: (on) => { for (const l of lanterns) l.visible = on; },
    ribcageWorld: (out) => {
      cage.getWorldPosition(out); // Preserve the live getter's parent matrix propagation for every other consumer.
      if (collision === null) return out;
      collision.publishRibs(); return collision.query.ribs(out);
    },
    ribcageRadius: RIB_R * scale * 1.15,
    setGlow: (k) => { glow = k; kit.glassMat.emissiveIntensity = KING_DRESS.glow.glass * k; kit.ribMat.emissiveIntensity = KING_DRESS.glow.ribs * k; kit.coreMat.emissiveIntensity = KING_DRESS.glow.core * k; },
    setOpen: (k, t) => {
      const breathe = 1 + 0.04 * Math.sin(t * 3.1);
      ribs.scale.set((1 + 0.45 * k) * breathe, 1 + 0.12 * k, (1 + 0.3 * k) * breathe);
      core.scale.setScalar(1 + 0.25 * k);
      kit.coreMat.emissiveIntensity = glow * (3 + 9 * k);
      kit.ribMat.emissiveIntensity = glow * (1.6 + 2.4 * k);
    },
    makeLantern: () => { const l = makeLantern(); l.scale.setScalar(scale); return l; },
    dispose: () => { collision?.dispose(); for (const o of own) o.removeFromParent(); },
  };
}

// ─────────────── his own rig (E322 F-M1) ───────────────

/** the stand-in paint of the own rig's placeholder parts (only seen if its hull fails to load) */
const BARK: Paint = (out) => { out.setRGB(KING_OWN_RIG.bark[0], KING_OWN_RIG.bark[1], KING_OWN_RIG.bark[2]); };

/** the placeholder body the factory merges before the hull replaces it: a box on the body, one on the head; the hit
 *  volumes (../data/antlerKingLook.ts `KING_OWN_RIG`) */
function buildOwnRig(): AnimalSpecies {
  const bones = KING_BONES.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] as [number, number, number] }));
  const at = (n: string): [number, number, number] => bones.find((b) => b.name === n)?.pos ?? [0, 0, 0];
  const bi = (n: string): number => Math.max(0, bones.findIndex((b) => b.name === n));
  const R = KING_OWN_RIG, e = R.eye;
  const torso = new THREE.BoxGeometry(...R.torso); torso.translate(at('body')[0], at('body')[1], at('body')[2]);
  const skull = new THREE.BoxGeometry(...R.skull); skull.translate(at('head')[0], at('head')[1], at('head')[2] + R.skullAhead);
  const eye = new THREE.SphereGeometry(e.r, e.w, e.h); eye.translate(e.x, at('head')[1], at('head')[2] + e.ahead);
  return {
    bones, furParts: [skinPlain(torso, bi('body'), 'body', BARK)], hardParts: [skinPlain(skull, bi('head'), 'head', BARK)], eyeParts: [skinPlain(eye, bi('head'), 'eye', BARK)],
    dims: { ...R.dims, feet: R.dims.feet.map((f): [number, number] => [f[0], f[1]]) },
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
