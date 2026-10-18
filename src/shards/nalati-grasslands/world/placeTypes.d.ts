import type * as THREE from 'three';
import type { ModelContext, Placement } from '@wildshard/engine/models/model';
import type { Draw } from '@wildshard/engine/models/place';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { BakedGeometryRow } from '@wildshard/sdk/kit/bakedGeometry';
import type { BoxSpec, FloorRect } from '@wildshard/engine/physics/box';
import type { Material } from '@wildshard/engine/physics/surface';

import type { ModelPlacement, ModelLook } from './modelTypes';

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
  readonly solid: readonly DescRow[]; readonly descs: readonly DescRow[]; readonly floors: readonly ({ readonly rects: readonly FloorRect[] } | { readonly x: number; readonly z: number; readonly size: number; readonly res: number; readonly data: string })[];
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


export type Platform = (x: number, z: number) => number | undefined;
export type Box = BoxSpec & { surface?: Material; ghost?: true };
export interface Ledge { x: number; y: number; z: number; r: number }
export interface KurganEntrance { x: number; y: number; z: number; facing: number }
export interface PlaceAnchors {
  readonly signposts?: { x: number; y: number; z: number; boards: { readonly text: string; readonly dir: number }[] }[];
  readonly riders?: { t: number; k: number; w: number; bob: number }[];
  readonly entrance?: KurganEntrance;
  readonly balbalSpots?: { x: number; z: number; yaw: number; scale: number }[];
  readonly ledges?: Ledge[];
  readonly cave?: KurganEntrance;
}

export interface CragLedgeFloor { readonly heading?: readonly [number, number]; readonly kind: 'ledge'; readonly x: number; readonly z: number; readonly cs: number; readonly sn: number; readonly hw: number; readonly hd: number; readonly top: number }
export interface LeopardCaveFloor { readonly kind: 'cave'; readonly x: number; readonly z: number; readonly cs: number; readonly sn: number; readonly mouthW: number; readonly depth: number; readonly porchY: number }
export interface KurganEntranceFloor { readonly kind: 'entrance'; readonly x: number; readonly z: number; readonly fx: number; readonly fz: number; readonly cw: number; readonly len: number; readonly lintelY: number; readonly dep: number; readonly floorY: number; readonly nSteps: number; readonly rise: number }
export interface MemberData {
  readonly draw: Draw;
  /** true: its copies are painted into the set's kit (its mesh), false: the set's generated instances (its group) */
  readonly inKit: boolean;
  /** where each copy stands (its params stay with what it made: `place` draws nothing, and has no own-space colliders to pose) */
  readonly placements: Omit<Placement<object>, 'params'>[];
  readonly boxes: number[];
  /** its copies' boxes as colliders, then their real-geometry ones (the old builders' order: boxes first) */
  readonly solid: ColliderDesc[];
  readonly descs: ColliderDesc[];
  readonly floors: Platform[];
}
/** a set's generated models' instances of one model: their look and placements */
export interface InstanceData { readonly look: ModelLook; readonly castShadow: boolean; readonly placements: ModelPlacement[] }


export interface SetRegister {
  readonly ctx: ModelContext;
  readonly registry?: WorldRegistry | null;
  /** the set's painted mesh (its painted models' tap target) */
  readonly object: THREE.Object3D;
  /** where its generated models' instances land (default: `object`) */
  readonly group?: THREE.Object3D;
  /** register each model's colliders `every` at a time, a task apart (the phone's per-task collider budget: `Placed.registered`) */
  readonly split?: { readonly every: number; readonly yieldTask: () => Promise<void> };
}

