import type { BakedGeometryRow } from '@wildshard/sdk/kit/bakedGeometry';
import type { Platform, PlaceAnchors, Box } from '../data/placeTypes';
import type { ModelPlacement } from '../data/modelTypes';
import type { CragLedgeFloor, LeopardCaveFloor, KurganEntranceFloor } from './placement';

export interface PlaceGeometryRow extends BakedGeometryRow { readonly expand: boolean }
/** a drawn mesh of a place: its name, its material ('poi' the painterly POI material, a texture name the textured one,
 *  'yard' the trodden-earth decal's), its child slot in the place's group (the rows are in the order the builder made them),
 *  its geometry */
export interface PlaceMeshRow { readonly name: string; readonly material: string; readonly slot: number; readonly geometry: PlaceGeometryRow }
/** a level deck with ramps as a floor (the Kunes bridge's): level `deck` over [flat0, flat1], down `slope` beyond, out to [z0, z1] */
export interface DeckRow { readonly x: number; readonly halfWidth: number; readonly z0: number; readonly z1: number; readonly flat0: number; readonly flat1: number; readonly deck: number; readonly slope: number }
/** a tor's floor (Eagle Rock's): slabs [inner radius, top] `w` wide round (cx, cz), clockwise `da` apart from `a0`, and its summit disc */
export interface TorFloorRow { readonly cx: number; readonly cz: number; readonly a0: number; readonly da: number; readonly w: number; readonly slabs: readonly (readonly [number, number])[]; readonly rTop: number; readonly top: number }
/** a cloth or smoke call as the builders made it: [kind, point, ...arguments] */
export type EffectRow = readonly [string, readonly number[], ...unknown[]];
/** Numeric floor profiles, evaluated by the same model functions as their offline painters. */
export type PlaceFloorRow = DeckRow | TorFloorRow | CragLedgeFloor | LeopardCaveFloor | KurganEntranceFloor;
interface DescRow { readonly heading?: readonly [number, number]; readonly kind: string; readonly points?: readonly number[]; readonly [k: string]: unknown }
interface PlacementRow { readonly heading?: readonly [number, number]; readonly x: number; readonly y: number; readonly z: number; readonly yaw?: number; readonly matrix?: readonly number[] }
/** one model's copies in a place, as data */
export interface MemberRow {
  readonly draw: string; readonly inKit: boolean; readonly placements: readonly PlacementRow[]; readonly boxes: readonly number[];
  readonly solid: readonly DescRow[]; readonly descs: readonly DescRow[]; readonly floors: readonly PlaceFloorRow[];
}
/** one place: its object (a group by name, or null: its one mesh is the object), meshes, boxes, cloth / smoke, models */
export interface PlaceRow {
  readonly name: string; readonly group: string | null; readonly surface: string; readonly tris: number; readonly anchors?: PlaceAnchors;
  readonly meshes: readonly PlaceMeshRow[]; readonly colliders: readonly Box[]; readonly effects: readonly EffectRow[];
  readonly members: readonly (readonly [string, MemberRow])[];
  readonly instances: readonly (readonly [string, { readonly look: object; readonly castShadow: boolean; readonly placements: readonly ModelPlacement[] }])[];
}
/** a model specimen: its key (model id + params), its parts */
export interface SpecimenRow { readonly key: string; readonly parts: readonly PlaceMeshRow[] }
/** a dressing scatter shape (generators/dressingGeos.ts): its key ('boulder:3', 'rose:lite' …), its indexed geometry */
export interface DressingGeoRow { readonly key: string; readonly geometry: PlaceGeometryRow }

/** the deck's floor function (placement only): the bridge painter's own `prof`, from its data */
export function deckFloor(row: DeckRow): Platform & { readonly row: DeckRow } {
  const { x, halfWidth, z0, z1, flat0, flat1, deck, slope } = row;
  const f = (px: number, pz: number): number | undefined => (Math.abs(px - x) <= halfWidth && pz >= z0 && pz <= z1 ? deck - Math.max(0, flat0 - pz, pz - flat1) * slope : undefined);
  return Object.assign(f, { row });
}
/** the tor painter's floor (placement only): the highest of the slab under (x, z) and the summit */
export function torFloor(row: TorFloorRow): Platform & { readonly row: TorFloorRow } {
  const { cx, cz, a0, da, w, slabs, rTop, top } = row;
  const f = (x: number, z: number): number | undefined => {
    const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz);
    let u = a0 - Math.atan2(dz, dx); u = ((u % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sl = slabs[Math.floor(u / da)], step = sl === undefined || r < sl[0] - 0.2 || r > sl[0] + w + 0.1 ? undefined : sl[1];
    const summit = r <= rTop ? top : undefined;
    return step === undefined || (summit !== undefined && summit > step) ? summit : step;
  };
  return Object.assign(f, { row });
}

