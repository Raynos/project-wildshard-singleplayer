/**
 * The Drowned Captain's hat (E314, project/archive/2026-09-30-driftwood-loot.md: the captain's trophy, worn — board 4 C — and a GEAR
 * cosmetic): a black felt tricorne with a gold-braided brim, a faded red cockade on the front-left, and a strand of kelp
 * still hanging off its right-hand corner from the wreck. The brim is one sheet turned up steeply between its three
 * points (front, back-left, back-right) and nearly flat at them, so its silhouette — and its shadow — reads as a
 * tricorne from any side.
 *
 * One mesh, one draw on the island's shared low-poly material. The kelp sways in the island's wind (the kit's `sway`,
 * vertex shader only). It is the world pickup too (it sits level on its crown's rim and brim points) and what the
 * player wears: src/engine/player/Cosmetics.ts hangs it on the player's head socket.
 *
 * Own space: the origin is the centre of the head band (the crown's bottom rim), +Y up, the front point toward +Z.
 * About 0.48 m across the points, 0.13 m tall. No colliders (a pickup is a trigger, not a solid).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { HAT_GEOMETRY, CAPE_GEOMETRY, loadFixedGeometry } from '../boot/fixedGeometry';

/** Both cosmetics keep their baked geometry, ordinary kit material and native socket space. */
const GARMENTS = {
  'captain-hat': { name: "Captain's hat", geometry: HAT_GEOMETRY, yaw: 0 },
  'sailcloth-cape': { name: 'Sailcloth cape', geometry: CAPE_GEOMETRY, yaw: Math.PI },
} as const;
type Garment = keyof typeof GARMENTS;

/** Fresh copies; worn/specimen scaling never changes the shared template. */
export function captainHatGeometry(): THREE.BufferGeometry { return HAT_GEOMETRY.copy(); }
export function sailclothCapeGeometry(): THREE.BufferGeometry { return CAPE_GEOMETRY.copy(); }

function buildGarment(ctx: ModelContext, id: Garment): THREE.Mesh {
  const mesh = new THREE.Mesh(GARMENTS[id].geometry.copy(), lowPolyLookMaterial(ctx.sky));
  mesh.name = id; mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
/** Native pickup/socket factories retain their exact mesh names and flags. */
export function buildCaptainHat(ctx: ModelContext): THREE.Mesh { return buildGarment(ctx, 'captain-hat'); }
export function buildSailclothCape(ctx: ModelContext): THREE.Mesh { return buildGarment(ctx, 'sailcloth-cape'); }

export interface CaptainHatParams { readonly size: number }
export type SailclothCapeParams = CaptainHatParams;

function garment(id: Garment) {
  const row = GARMENTS[id];
  return defineModel<CaptainHatParams>({
    id: `driftwood-isle/${id}`, name: row.name, category: 'gear', pipeline: 'code',
    file: 'src/shards/driftwood-isle/runtime/models/captainHat.ts', surface: 'felt',
    prepare: loadFixedGeometry, defaults: { size: 1 }, specimenYaw: row.yaw,
    build: (ctx, p): readonly ModelPart[] => [{
      geometry: ctx.once(`${id}:${p.size}`, () => (p.size === 1 ? row.geometry.copy() : row.geometry.copy().scale(p.size, p.size, p.size))),
      material: lowPolyLookMaterial(ctx.sky), castShadow: true, receiveShadow: true,
    }],
  });
}
export const captainHat = garment('captain-hat'), sailclothCape = garment('sailcloth-cape');
