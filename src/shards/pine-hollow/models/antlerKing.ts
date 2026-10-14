import * as THREE from 'three';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalSpecies, SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import { CREATURE_CLIPS, creatureFactory, type CreatureParams } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { KING_COAT, KING_DRESS, KING_OWN_RIG } from '../data/antlerKingLook';
import { KING_BONES, animateKing, observeKingPose } from '../combat/kingRig';
import { bindKingQueryView } from '../runtime/kingQueryView';
import { readKingCollisionBake } from '../runtime/kingCollisionBake';
import kingCollision from '../data/kingCollision.generated.json' with { type: 'json' };
import kingKit from '../data/kingKit.generated.json' with { type: 'json' };

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
 * bone. The lantern, the ribcage and the core are baked (generators/kingKit.ts: one rest-geometry pool, and the lantern spots
 * read off his hull's rack); he is drawn only on his hull, and a hull or kit that is not loaded refuses.
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

/** the King's baked kit (generators/kingKit.ts → data/kingKit.generated.json): the lantern's frame and glass, the ribs and
 *  the core, one rest-geometry pool the shard's kit preloads (`preloadKingKit`) and the dressing borrows */
const KING_KIT_GEOMETRY = createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, aoFloor: 1, hdLooks: {}, geometryPools: [kingKit.pool] }, '[pine-hollow king kit]');
/** load the King's baked kit once (the shard's kit step, before the fight or a card builds him) */
export const preloadKingKit = (): Promise<void> => KING_KIT_GEOMETRY.preload();
/** where his three lanterns hang off his hull's rack (head-bone local, model units): baked off the hull */
const KING_LANTERNS: readonly (readonly number[])[] = kingKit.lanterns;

/** the shared geometries + materials (made once at boot, so their programs are compiled with the rest) */
export interface KingKit {
  frameGeo: THREE.BufferGeometry; glassGeo: THREE.BufferGeometry; ribGeo: THREE.BufferGeometry; coreGeo: THREE.BufferGeometry;
  frameMat: THREE.MeshStandardMaterial; glassMat: THREE.MeshStandardMaterial; ribMat: THREE.MeshStandardMaterial; coreMat: THREE.MeshStandardMaterial;
}

/** the baked lantern, ribcage and core, and their iron and amber (../data/antlerKingLook.ts `KING_DRESS`); a part that is not
 *  loaded refuses, it is never rebuilt here */
export function makeKingKit(sky: Sky): KingKit {
  const D = KING_DRESS;
  const part = (name: string): THREE.BufferGeometry => {
    const g = KING_KIT_GEOMETRY.geometry(name, { borrow: true });
    if (g === null) throw new Error(`[pine-hollow] the King's baked ${name} is not loaded`);
    return g;
  };
  const frameMat = new THREE.MeshStandardMaterial({ ...D.frameMat });
  sky.setupMaterial(frameMat);
  const glow = (i: number) => new THREE.MeshStandardMaterial({ ...D.glowMat, emissive: new THREE.Color(D.amber[0], D.amber[1], D.amber[2]), emissiveIntensity: i });
  return {
    frameGeo: part('king-lantern-frame'), glassGeo: part('king-lantern-glass'), ribGeo: part('king-ribs'), coreGeo: part('king-core'),
    frameMat, glassMat: glow(D.glow.glass), ribMat: glow(D.glow.ribs), coreMat: glow(D.glow.core),
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

/** dress a freshly spawned King (on his hull: its own skull face and rack): the lanterns off the rack on the head bone, the
 *  ribcage on the chest bone */
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
  const collision = bindKingQueryView(a, readKingCollisionBake(kingCollision), receive => observeKingPose(a, receive));
  for (const p of KING_LANTERNS) {
    const l = makeLantern();
    l.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
    head.add(l); lanterns.push(l); own.push(l);
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
      l.getWorldPosition(out); collision.publishHead();
      return out;
    },
    setLanternsHung: (on) => { for (const l of lanterns) l.visible = on; },
    ribcageWorld: (out) => {
      cage.getWorldPosition(out); // Preserve the live getter's parent matrix propagation for every other consumer.
      collision.publishRibs(); return collision.query.ribs(out);
    },
    ribcageRadius: RIB_R * scale * KING_DRESS.ribHit,
    setGlow: (k) => { glow = k; kit.glassMat.emissiveIntensity = KING_DRESS.glow.glass * k; kit.ribMat.emissiveIntensity = KING_DRESS.glow.ribs * k; kit.coreMat.emissiveIntensity = KING_DRESS.glow.core * k; },
    setOpen: (k, t) => {
      const O = KING_DRESS.open, breathe = 1 + O.breathe[0] * Math.sin(t * O.breathe[1]);
      ribs.scale.set((1 + O.ribs[0] * k) * breathe, 1 + O.ribs[1] * k, (1 + O.ribs[2] * k) * breathe);
      core.scale.setScalar(1 + O.core * k);
      kit.coreMat.emissiveIntensity = glow * (O.coreGlow[0] + O.coreGlow[1] * k);
      kit.ribMat.emissiveIntensity = glow * (O.ribGlow[0] + O.ribGlow[1] * k);
    },
    makeLantern: () => { const l = makeLantern(); l.scale.setScalar(scale); return l; },
    dispose: () => { collision.dispose(); for (const o of own) o.removeFromParent(); },
  };
}

// ─────────────── his own rig (E322 F-M1) ───────────────

/** his body: the skeleton (the hull's own joints replace its rest positions) and the hit volumes
 *  (../data/antlerKingLook.ts `KING_OWN_RIG`), and no parts (the hull is the mesh) */
function buildOwnRig(): AnimalSpecies {
  const R = KING_OWN_RIG;
  return {
    bones: KING_BONES.map((b) => ({ name: b.name, parent: b.parent, pos: [b.pos[0], b.pos[1], b.pos[2]] })), furParts: [], hardParts: [], eyeParts: [],
    dims: { ...R.dims, feet: R.dims.feet.map((f): [number, number] => [f[0], f[1]]) },
  };
}

/**
 * The King's species on his own rig (E322 F-M1): `base` (the fight's elk-derived King: his coat, sounds,
 * AI hook and damage rule) as a custom rig — KING_BONES and kingRig.ts's poses instead of the elk's bones and gaits. The
 * hull (`antler-king-rig[.phone].rigged.glb`) is his mesh through species/hulls.ts like every Pine Hollow hull.
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
 * [.phone].rigged.glb`) on his own rig (kingRig.ts), drawn ×2.6 by the fight, dressed with his baked kit (`dressAntlerKing`:
 * the antler lanterns, the amber ribcage). The fight (src/shards/pine-hollow/combat/antlerKing.ts) spawns,
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
