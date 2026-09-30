/**
 * The gear several shards' players hold (E306 / E315 M5, category `gear`), and what every shard's gear cards share.
 *
 *   shared/iron-sword  the iron sword (src/player/Sword.ts `blade: 'iron'`): the wreck's loot on Driftwood, the second sword
 *                      (Nine Dragon's kit dropped it, E314 A: nothing there unlocks it).
 *
 * A weapon's viewmodel keeps its own render queue, depth clear, layers and materials; its card is the Explorer's specimen.
 * The specimen is a SEPARATE build by the weapon's own builder (`buildSword`, a shard's `buildRifleParts`: the functions the viewmodel
 * is built with, so the two never drift) on the specimen's own materials — opaque, in the normal queue, no depth clear —
 * so nothing the Explorer does (its turntable, its paint / wire views, a skin) reaches the weapon in your hands. A shard
 * lists its gear with `live(model, { copies: 1 })` (./live.ts): one copy per weapon its kit holds.
 *
 * Also here: a skinnable weapon's legendary skins as its variants (src/player/Skins.ts: the same material overrides a
 * drop wears, applied to the specimen's own clones), a low-poly sword's card, and the wireframe box a specimen stands as
 * while its file loads.
 */
import * as THREE from 'three';
import { buildSword, swordMaterial } from '../player/Sword';
import { SKINS, applySkin, type SkinId, type WeaponKind } from '../player/Skins';
import type { Sky } from '../world/Sky';
import { defineModel, type ModelContext, type ModelPart, type ModelVariant } from './model';

const FILE = 'src/models/gear.ts';

// ───────────────────────────── shared by every shard's gear ─────────────────────────────

/** a skinnable weapon's params: the legendary skin its specimen wears (null: plain) */
export interface GearSkinParams { readonly skin: SkinId | null }

/** a skinnable weapon's variants: plain, then every legendary skin made for it (Skins.ts SKINS, by `weapon`) */
export function skinVariants(kind: WeaponKind): readonly ModelVariant<GearSkinParams>[] {
  const skins = Object.values(SKINS).filter((s) => s.weapon === kind).map((s) => ({ id: s.id, label: s.name, params: { skin: s.id } }));
  return [{ id: 'plain', label: 'Plain', params: { skin: null } }, ...skins];
}

/** dress a specimen in its variant's skin: Skins.applySkin clones the materials the skin changes, for this root alone */
export function wearSkin(root: THREE.Object3D, p: GearSkinParams, sky: Sky): THREE.Object3D {
  if (p.skin !== null) applySkin(root, SKINS[p.skin], sky);
  return root;
}

/** the wireframe box a specimen shows while its file loads (the training dummy's, E289) */
function loadingBox(size: readonly [number, number, number]): THREE.Mesh {
  const [x, y, z] = size;
  const box = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }));
  box.position.y = y / 2;
  return box;
}

/**
 * A specimen whose parts load (a GLB): a wireframe box of about its size until `fill` resolves, then what `fill` made and a
 * `ws:model-ready` for model `id` (the Explorer re-frames and re-shoots its card). A failed load keeps the box and says why.
 */
export function loadingSpecimen(id: string, size: readonly [number, number, number], fill: () => Promise<THREE.Object3D>): THREE.Group {
  const holder = new THREE.Group();
  holder.add(loadingBox(size));
  void (async (): Promise<void> => {
    try {
      const made = await fill();
      holder.clear();
      holder.add(made);
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
    } catch (error) {
      console.warn(`[models] ${id}: the specimen's file did not load`, error);
    }
  })();
  return holder;
}

/**
 * A low-poly sword's card (the wooden sword, the iron sword): `buildSword`'s `sword` — the blade, guard, grip, pommel and
 * the two fists on the grip, the one mesh the viewmodel swings — on the specimen's own `swordMaterial`. The forearms (the
 * viewmodel's second mesh, the player's sleeves running out of the frame) are the player's, not the sword's: left out.
 */
export function swordParts(ctx: ModelContext, blade: 'wood' | 'iron'): readonly ModelPart[] {
  const { geometry, material } = ctx.once(`gear:${blade}-sword`, () => ({ geometry: buildSword(blade).sword, material: swordMaterial(ctx.sky, blade) }));
  return [{ geometry, material, castShadow: true, receiveShadow: true }];
}

// ───────────────────────────── the shared gear ─────────────────────────────

/** The iron sword: Sword.ts's rig with `blade: 'iron'` — the steel blade, the dark iron guard — as `swordParts` builds it. */
export const ironSword = defineModel<object>({
  id: 'shared/iron-sword', name: 'Iron sword', category: 'gear', pipeline: 'code', file: FILE,
  defaults: {},
  build: (ctx) => swordParts(ctx, 'iron'),
});
