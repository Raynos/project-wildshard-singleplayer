/**
 * Nalati's gear (E306 / E315 M5, `gear`): what the steppe's player holds — its own kit (src/shards/nalati-grasslands/weapons/nalatiKit.ts: the
 * composite bow, the sabre, the spear and its javelins), the two legendary rewards the bosses pay (the Golden Bow, the
 * Storm Sabre Naizagai) and the AR-15 (the rifle slot: since E333 only Nalati's kit builds it; locked until its pickup, lent
 * in the practice room). The viewmodels keep
 * drawing the held ones; each card is a separate build by the weapon's own builder on its own materials, put back in the
 * normal queue (the viewmodel factories make theirs transparent for the depth-clear trick; src/engine/models/gear.ts says why).
 */
import * as THREE from 'three';
import { QUIVER_MAX } from '@wildshard/kit/weapons/bow/index';
import { arrowMaterial, bowSpecimen, buildArrowGeometry, type BowStyle } from '../weapons/recurve';
import { buildRifleParts } from '../runtime/weapons/Rifle';
import { buildSabre } from '../weapons/Sabre';
import { buildJavelin, buildSpear, type SpearParts } from '../weapons/Spear';
import { meleeMaterial, steelMaterial } from '../weapons/meleeGeo';
import { goldenBowModel } from '../weapons/GoldenBow';
import { naizagaiModel } from '../weapons/Naizagai';

import { whiteColors } from '@wildshard/engine/combat/view/ranged';
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { defineModel, type ModelContext, type ModelDef, type ModelPart } from '@wildshard/engine/models/model';

const FILE = 'src/shards/nalati-grasslands/models/gear.ts';

/** the specimen's own copy of a viewmodel material, back in the normal (opaque) queue */
function opaque<M extends THREE.Material>(m: M): M {
  m.transparent = false;
  return m;
}

/** a card's parts: every draw casts and takes shadows on the turntable */
const lit = (geometry: THREE.BufferGeometry, material: THREE.Material): ModelPart => ({ geometry, material, castShadow: true, receiveShadow: true });

export interface BowParams { readonly style: BowStyle }

/**
 * The composite recurve (horn-and-sinew, painterly): the braced bow and the left glove on it — the bow's one mesh as the
 * viewmodel builds it (`Bow.bowSpecimen`). Variants: its paints — the recurve, the Golden Bow's gold (the same bow once the
 * Golden King's reward is taken, GoldenBow.ts `apply`) and the Sky-Wolf skin (Kokbori's drop, nalatiSkins.ts).
 */
export const bow: ModelDef<BowParams> = defineModel<BowParams>({
  id: 'nalati-grasslands/bow', name: 'Composite bow', category: 'gear', pipeline: 'code', file: FILE,
  defaults: { style: 'recurve' },
  variants: [
    { id: 'recurve', label: 'Recurve', params: { style: 'recurve' } },
    { id: 'golden', label: 'Golden Bow', params: { style: 'golden' } },
    { id: 'sky-wolf', label: 'Sky-Wolf', params: { style: 'sky-wolf' } },
  ],
  build: (ctx, p) => ctx.once(`gear:bow:${p.style}`, () => bowSpecimen(ctx.sky, p.style)).clone(),
});

/**
 * The arrow (E348): a birch shaft with a red cresting band, an iron leaf head and three barred feathers, 0.8 m — the bow's
 * `buildArrowGeometry` on its own copy of the arrows' painterly material (`arrowMaterial`). Every arrow loosed, flying or
 * stuck in the world, is one instanced draw (Projectiles.ts); the quiver holds QUIVER_MAX.
 */
export const arrow: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/arrow', name: 'Arrow', category: 'gear', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
  specimenYaw: Math.PI / 2, // side on: the shaft runs across the card
  build: (ctx) => [lit(ctx.once('gear:arrow', buildArrowGeometry), ctx.once('gear:arrow-material', () => arrowMaterial(ctx.sky)))],
});

/**
 * The sabre (kylysh): `buildSabre` — the curved steel blade with its fuller, the gold collar, guard and pommel on the PBR
 * steel; the leather grip in its spiral wrap and the rider's gloved fist round it, painterly. The forearm (the viewmodel's
 * sleeve out of the frame) is the player's: left out.
 */
export const sabre: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/sabre', name: 'Sabre', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => {
    const rig = ctx.once('gear:sabre', () => buildSabre(opaque(meleeMaterial(ctx.sky)), opaque(steelMaterial(ctx.sky))));
    return [lit(rig.sword, rig.material), ...(rig.extras ?? []).map((x) => lit(x.geometry, x.material))];
  },
});

/** a spear's or a javelin's two draws on the spear's own materials (the painted wood and horsehair; the steel at 0.3) */
function spearParts(ctx: ModelContext, key: string, build: () => SpearParts): readonly ModelPart[] {
  const mats = ctx.once('gear:spear-materials', () => ({ paint: opaque(meleeMaterial(ctx.sky)), steel: opaque(steelMaterial(ctx.sky, 0.3)) }));
  const p = ctx.once(key, build);
  return [lit(p.paint, mats.paint), lit(p.metal, mats.steel)];
}

/** The spear: 1.9 m of ash, a thong binding under a dark iron socket, a red horsehair tassel, a long leaf head (`buildSpear`). */
export const spear: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/spear', name: 'Spear', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => spearParts(ctx, 'gear:spear', buildSpear),
});

/** The javelin, thrown from the spear's slot: a slimmer 1.3 m shaft, a narrow leaf head, a horsehair tuft (`buildJavelin`).
 *  Three carried (five with the camp's upgrade); the thrown ones are one instanced draw (Spear.ts). */
export const javelin: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/javelin', name: 'Javelin', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => spearParts(ctx, 'gear:javelin', buildJavelin),
});

/** The Golden Bow, the Golden King's reward as its orb shows it (GoldenBow.ts `goldenBowModel`): a Scythian recurve in
 *  gold, ibex heads at the limb tips, a string of light. Taken, it gilds the bow in your hands (the bow's Golden variant). */
export const goldenBow: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/golden-bow', name: 'Golden Bow', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => goldenBowModel(ctx.sky),
});

/** Naizagai, the Storm Sabre of Jel Ata — the Storm Titan's reward as its orb shows it (Naizagai.ts `naizagaiModel`): the
 *  pale storm-blue blade, point down, a gold guard. Taken, it turns the sabre in your hands storm-blue. */
export const naizagai: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/naizagai', name: 'Naizagai', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: () => naizagaiModel(),
});

/**
 * The AR-15: `buildRifleParts` — the receiver, rail, handguard, barrel, stock and grip (aluminium, polymer, steel), the
 * charging handle, the bolt and the magazine in its well — on the specimen's own materials (the parts are built once per
 * shard, never the viewmodel's). No ghost-ring glow (it only shows sighted), no flash, no depth clear. (Its legendary skins
 * drop in Pine Hollow only, E333: none here.)
 */
export const ar15: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/ar-15', name: 'AR-15', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => {
    const parts = ctx.once('gear:ar-15', () => {
      const r = buildRifleParts(ctx.sky);
      const meshes = [r.alu, r.poly, r.steel, r.handle, r.bolt, r.mag];
      for (const m of meshes) whiteColors(m.geometry); // the viewmodels' program reads vertex colours
      return meshes;
    });
    const g = new THREE.Group();
    g.name = 'AR-15';
    for (const part of parts) {
      const m = new THREE.Mesh(part.geometry, part.material);
      m.position.copy(part.position);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  },
});

/** the steppe's kit (src/shards/nalati-grasslands/weapons/nalatiKit.ts + src/main.ts): bow (+ its arrows) · sabre · spear (+ javelins), the bosses' rewards, the AR-15 */
export const GEAR: readonly RosterEntry[] = [
  live(bow, { copies: 1 }),
  live(arrow, { copies: QUIVER_MAX, drawnAs: 'instanced' }),
  live(sabre, { copies: 1 }),
  live(spear, { copies: 1 }),
  live(javelin, { copies: 3, drawnAs: 'instanced' }),
  live(goldenBow, { copies: 1 }),
  live(naizagai, { copies: 1 }),
  live(ar15, { copies: 1 }),
];
