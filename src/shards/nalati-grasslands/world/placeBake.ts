/**
 * Nalati's painted places, baked offline (SHARD-PLATFORM M3, the places bake): the spring camp, the Kunes bridge and the
 * summer camp are painted, AO-baked and contact-shaded at bake time by `generators/places.ts` (in Chromium:
 * `scripts/bake-nalati-places.mjs` → `public/assets/nalati/baked/places.bin` + `data/places.json`), and the page only draws
 * the bake back: each place's meshes (every attribute's own float bytes, welded in the binary and expanded here into the
 * page's non-indexed arrays), its data boxes, its cloth and smoke, its generated (GLB) instances and, per model, the copies
 * `place` registers (colliders, floors, the catalog), in the order the builders made them. The models' Explorer specimens
 * are a second bake (`specimens.bin`), fetched the first time the Explorer builds one (`bakedPainted`).
 * Fetched once behind the loading screen (`preloadNalatiPlaces`, NalatiPOIs.buildSliced); a place asked for before it is a
 * page fault (`bakedPlaceSteps` throws, naming it).
 */
import * as THREE from 'three';
import type { ModelDef, ModelPart, Placement } from '@wildshard/engine/models/model';
import type { Placed } from '@wildshard/engine/models/place';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { readBakedGeometry, type BakedGeometryRow } from '@wildshard/sdk/kit/bakedGeometry';
import placesJson from '../data/places.json' with { type: 'json' };
import specimensJson from '../data/placeSpecimens.json' with { type: 'json' };
import type { NalatiTexName } from '../look/nalatiTextures';
import { unshuffleBodyLanes } from '../species/bodies';
import type { ModelPlacement, NalatiModelName } from './glbPaint';
import { poiMaterial, texturedMaterial } from './paint';
import { flushInstances, modelReady, placeMember, type InstanceData, type MemberData, type SetRegister } from './painted';
import type { Box } from './solid';
import type { Platform, PoiCtx, PoiPiece } from './types';
import { yardMaterial } from './Yard';

/** a baked geometry: its row, and whether the binary holds it welded (expanded to the page's non-indexed arrays) */
export interface PlaceGeometryRow extends BakedGeometryRow { readonly expand: boolean }
/** a drawn mesh of a place: its name, its material ('poi' the painterly POI material, a texture name the textured one,
 *  'yard' the trodden-earth decal's), its child slot in the place's group (the rows are in the order the builder made them),
 *  its geometry */
export interface PlaceMeshRow { readonly name: string; readonly material: string; readonly slot: number; readonly geometry: PlaceGeometryRow }
/** a level deck with ramps as a floor (the Kunes bridge's): level `deck` over [flat0, flat1], down `slope` beyond, out to [z0, z1] */
export interface DeckRow { readonly x: number; readonly halfWidth: number; readonly z0: number; readonly z1: number; readonly flat0: number; readonly flat1: number; readonly deck: number; readonly slope: number }
/** a cloth or smoke call as the builders made it: [kind, point, ...arguments] */
export type EffectRow = readonly [string, readonly number[], ...unknown[]];
interface DescRow { readonly kind: string; readonly points?: readonly number[]; readonly [k: string]: unknown }
interface PlacementRow { readonly x: number; readonly y: number; readonly z: number; readonly yaw?: number; readonly matrix?: readonly number[] }
/** one model's copies in a place, as data */
export interface MemberRow {
  readonly draw: string; readonly inKit: boolean; readonly placements: readonly PlacementRow[]; readonly boxes: readonly number[];
  readonly solid: readonly DescRow[]; readonly descs: readonly DescRow[]; readonly floors: readonly DeckRow[];
}
/** one place: its object (a group by name, or null: its one mesh is the object), meshes, boxes, cloth / smoke, models */
export interface PlaceRow {
  readonly name: string; readonly group: string | null; readonly surface: string; readonly tris: number;
  readonly meshes: readonly PlaceMeshRow[]; readonly colliders: readonly Box[]; readonly effects: readonly EffectRow[];
  readonly members: readonly (readonly [string, MemberRow])[];
  readonly instances: readonly (readonly [string, { readonly look: object; readonly castShadow: boolean; readonly placements: readonly ModelPlacement[] }])[];
}
/** a model specimen: its key (model id + params), its parts */
export interface SpecimenRow { readonly key: string; readonly parts: readonly PlaceMeshRow[] }

export const NALATI_PLACES_URL = '/assets/nalati/baked/places.bin';
export const NALATI_SPECIMENS_URL = '/assets/nalati/baked/specimens.bin';

interface Bake<R> { readonly bin: string; readonly bytes: number; readonly rows: readonly R[] }
/** a bake's rows as written by generators/places.ts (its stamp checked here; the rows are the generator's own types) */
function isBake<R>(v: unknown): v is Bake<R> {
  return typeof v === 'object' && v !== null && 'bin' in v && typeof v.bin === 'string' && 'bytes' in v && typeof v.bytes === 'number' && 'rows' in v && Array.isArray(v.rows);
}
function bakeOf<R>(v: unknown, what: string): Bake<R> {
  if (!isBake<R>(v)) throw new Error(`[nalati-grasslands] data/${what} is not a places bake`);
  return v;
}
const PLACES = bakeOf<PlaceRow>(placesJson, 'places.json');
const SPECIMENS = bakeOf<SpecimenRow>(specimensJson, 'placeSpecimens.json');

/** the deck's floor function (placement only): the bridge painter's own `prof`, from its data */
export function deckFloor(row: DeckRow): Platform & { readonly row: DeckRow } {
  const { x, halfWidth, z0, z1, flat0, flat1, deck, slope } = row;
  const f = (px: number, pz: number): number | undefined => (Math.abs(px - x) <= halfWidth && pz >= z0 && pz <= z1 ? deck - Math.max(0, flat0 - pz, pz - flat1) * slope : undefined);
  return Object.assign(f, { row });
}

const bytesOfRow = (g: PlaceGeometryRow): number => {
  let n = 0;
  for (const [, type, size] of g.attrs) n += Math.ceil((g.count * size * (type === 'f32' ? 4 : type === 'u8' || type === 'i8' ? 1 : 2)) / 4) * 4;
  return n + (g.index === null ? 0 : g.indexCount * 4);
};

/** a bake's geometry from `at` (expanded when welded), its bounds as the page's builders computed them */
function geometryAt(bytes: Uint8Array, at: number, row: PlaceGeometryRow): THREE.BufferGeometry {
  const g = readBakedGeometry(bytes, at, row);
  if (!row.expand) return g;
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeBoundingSphere();
  flat.computeBoundingBox();
  return flat;
}

function offsets<R>(bake: Bake<R>, raw: Uint8Array, geos: (r: R) => readonly PlaceMeshRow[], what: string): number[] {
  if (raw.length !== bake.bytes) throw new Error(`[nalati-grasslands] the ${what} bake holds ${String(raw.length)} bytes, its rows ${String(bake.bytes)}`);
  const out: number[] = [];
  let at = 0;
  for (const r of bake.rows) for (const m of geos(r)) { out.push(at); at += bytesOfRow(m.geometry); }
  if (at !== raw.length) throw new Error(`[nalati-grasslands] the ${what} rows do not cover the bake`);
  return out;
}

async function fetchLanes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return unshuffleBodyLanes(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()));
}

let places: { bytes: Uint8Array; at: number[] } | null = null;
let placesLoading: Promise<void> | null = null;
let placesProvider: (() => Uint8Array) | null = null;

/** Hand the places bake's raw binary (inflated, lanes put back) to the page; a test passes the committed file's. */
export function useNalatiPlaces(raw: Uint8Array): void {
  places = { bytes: raw, at: offsets(PLACES, raw, (r) => r.meshes, 'places') };
  placesLoading = Promise.resolve();
}
/** Read the raw binary only when a place is first built (a Node test setup). */
export function provideNalatiPlaces(read: () => Uint8Array): void { placesProvider = read; }

/** Fetch, inflate and read the places bake once (NalatiPOIs.buildSliced). A failed load is a console.error page fault. */
export function preloadNalatiPlaces(): Promise<void> {
  placesLoading ??= (async (): Promise<void> => {
    try { useNalatiPlaces(await fetchLanes(NALATI_PLACES_URL)); } catch (error: unknown) { console.error('[nalati-grasslands] the baked places did not load:', error); }
  })();
  return placesLoading;
}

const color = (c: unknown): THREE.ColorRepresentation => {
  if (typeof c === 'string' || typeof c === 'number') return c;
  throw new Error('[nalati-grasslands] a baked cloth colour is not a string or number');
};
const v3 = (p: readonly number[]): THREE.Vector3 => new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
const options = (o: unknown): Record<string, never> => (typeof o === 'object' && o !== null ? o as Record<string, never> : {});

/** replay a place's cloth and smoke onto the shard's, in the builders' order */
function replayEffects(ctx: PoiCtx, effects: readonly EffectRow[]): void {
  for (const [kind, p, a, b, c, o] of effects) {
    if (kind === 'emitter') ctx.smoke.emitter(v3(p), options(a));
    else if (kind === 'streamer' && typeof a === 'number' && typeof b === 'number') ctx.flutter.streamer(v3(p), a, b, color(c), options(o));
    else if (kind === 'flag' && typeof a === 'number' && typeof b === 'number') ctx.flutter.flag(v3(p), a, b, color(c), options(o));
    else if (kind === 'strip' && typeof a === 'number' && typeof b === 'number') ctx.flutter.strip(v3(p), a, b, color(c));
    else throw new Error(`[nalati-grasslands] a baked effect '${kind}' is malformed`);
  }
}

const desc = (d: DescRow): ColliderDesc => (d.points === undefined ? d as ColliderDesc : { ...d, points: Float32Array.from(d.points) } as ColliderDesc);
const placement = (p: PlacementRow): Omit<Placement<object>, 'params'> => {
  const { matrix, ...rest } = p;
  return matrix === undefined ? rest : { ...rest, matrix: new THREE.Matrix4().fromArray(matrix) };
};
const member = (m: MemberRow): MemberData => ({
  draw: m.draw === 'instanced' ? 'instanced' : 'merged', inKit: m.inKit, placements: m.placements.map(placement), boxes: [...m.boxes],
  solid: m.solid.map(desc), descs: m.descs.map(desc), floors: m.floors.map(deckFloor),
});

/** a material of a baked mesh */
function materialOf(ctx: PoiCtx, kind: string): THREE.Material {
  if (kind === 'poi') return poiMaterial(ctx.sky);
  if (kind === 'yard') return yardMaterial(ctx.sky);
  return texturedMaterial(ctx.sky, kind as NalatiTexName);
}

/** places one model's copies (`placeMember` on its def) */
export type Placer = (m: MemberData, o: SetRegister, object: THREE.Object3D) => Placed;
/** a model's placer, by its id (a place's `placers`) */
export const placer = <P extends object>(def: ModelDef<P>): readonly [string, Placer] => [def.id, (m, o, object) => placeMember(def, m, o, object)];

/**
 * A baked place as its builder made it, a mesh a step (SF67): its object (the group, or its one mesh), its data boxes,
 * its cloth and smoke, and `register` placing each model's copies (`placers`: the models it places, by id) in order.
 */
export function* bakedPlaceSteps(name: string, ctx: PoiCtx, placers: ReadonlyMap<string, Placer>): Generator<void, PoiPiece> {
  if (places === null && placesProvider !== null) { const read = placesProvider; placesProvider = null; useNalatiPlaces(read()); }
  const bake = places, index = PLACES.rows.findIndex((r) => r.name === name), row = PLACES.rows[index];
  if (bake === null) throw new Error(`[nalati-grasslands] the baked places are not loaded (${name})`);
  if (row === undefined) throw new Error(`[nalati-grasslands] no baked place '${name}'`);
  let first = 0;
  for (let i = 0; i < index; i++) first += PLACES.rows[i]?.meshes.length ?? 0;
  // the builders made the group first, then the meshes in their own order (the yard, the felt, the painted mesh, the
  // timber), so the objects' and materials' ids (the render lists' ties) are the page's; each goes to its child slot
  const top = row.group === null ? null : new THREE.Group();
  if (top !== null && row.group !== null) top.name = row.group;
  const meshes: THREE.Mesh[] = [];
  for (const [k, m] of row.meshes.entries()) {
    const mesh = new THREE.Mesh(geometryAt(bake.bytes, bake.at[first + k] ?? 0, m.geometry), materialOf(ctx, m.material));
    mesh.name = m.name;
    if (m.material === 'yard') { mesh.receiveShadow = true; mesh.renderOrder = 1; } else { mesh.castShadow = true; mesh.receiveShadow = true; }
    meshes[m.slot] = mesh;
    yield;
  }
  replayEffects(ctx, row.effects);
  const instances = row.instances.map(([n, l]): [NalatiModelName, InstanceData] => [n as NalatiModelName, { look: l.look, castShadow: l.castShadow, placements: [...l.placements] }]);
  const members = row.members.map(([id, m]) => [id, member(m)] as const);
  let object: THREE.Object3D;
  if (top === null) {
    const only = meshes[0];
    if (only === undefined || meshes.length !== 1) throw new Error(`[nalati-grasslands] baked place '${name}' is not one mesh`);
    object = only;
  } else {
    for (const m of meshes) top.add(m);
    flushInstances(instances, top, ctx.sky);
    object = top;
  }
  const group = object;
  const register = (o: Omit<SetRegister, 'object' | 'group'>): Placed[] => members.map(([id, m]) => {
    const put = placers.get(id);
    if (put === undefined) throw new Error(`[nalati-grasslands] baked place '${name}' places an unknown model '${id}'`);
    return put(m, { ...o, object: group }, group);
  });
  return { name: row.name, object, colliders: row.colliders.map((b) => ({ ...b })), surface: row.surface as Material, tris: row.tris, register };
}

let specimens: { bytes: Uint8Array; at: number[] } | null = null;
let specimensLoading: Promise<{ bytes: Uint8Array; at: number[] } | null> | null = null;
/** the specimens bake, fetched the first time the Explorer builds one */
function loadSpecimens(): Promise<{ bytes: Uint8Array; at: number[] } | null> {
  specimensLoading ??= (async (): Promise<{ bytes: Uint8Array; at: number[] } | null> => {
    try {
      const raw = await fetchLanes(NALATI_SPECIMENS_URL);
      specimens = { bytes: raw, at: offsets(SPECIMENS, raw, (r) => r.parts, 'specimens') };
      return specimens;
    } catch (error: unknown) { console.error('[nalati-grasslands] the baked specimens did not load:', error); return null; }
  })();
  return specimensLoading;
}
/** Hand the specimens bake's raw binary to the page (a test). */
export function useNalatiSpecimens(raw: Uint8Array): void { specimens = { bytes: raw, at: offsets(SPECIMENS, raw, (r) => r.parts, 'specimens') }; specimensLoading = Promise.resolve(specimens); }

/** a specimen's key: its model and its params as the Explorer builds them (`paramsOf`) */
export const specimenKey = (id: string, params: object): string => `${id} ${JSON.stringify(params)}`;

/** a baked specimen's parts (the Explorer's model, in its own space), when the specimens bake is in */
export function bakedSpecimenParts(key: string, sky: PoiCtx['sky']): ModelPart[] | null {
  const bake = specimens, i = SPECIMENS.rows.findIndex((r) => r.key === key), row = SPECIMENS.rows[i];
  if (bake === null || row === undefined) return null;
  let first = 0;
  for (let k = 0; k < i; k++) first += SPECIMENS.rows[k]?.parts.length ?? 0;
  return row.parts.map((p, k) => ({ geometry: geometryAt(bake.bytes, bake.at[first + k] ?? 0, p.geometry), material: p.material === 'poi' ? poiMaterial(sky) : texturedMaterial(sky, p.material as NalatiTexName), castShadow: true, receiveShadow: true }));
}

/**
 * A painted model whose painter runs offline (the places bake): its Explorer specimen is the baked one for the params it
 * is built with, drawn into the returned group when the specimens bake is in (`ws:model-ready` then, as a GLB model's).
 */
export function bakedPainted<P extends object>(def: Omit<ModelDef<P>, 'build'>): ModelDef<P> {
  return {
    ...def,
    build: (ctx, p) => {
      const g = new THREE.Group(), key = specimenKey(def.id, p);
      const fill = (): void => {
        const parts = bakedSpecimenParts(key, ctx.sky);
        if (parts === null) { console.warn(`[nalati-grasslands] no baked specimen ${key}`); return; }
        for (const part of parts) { const m = new THREE.Mesh(part.geometry, part.material); m.castShadow = true; m.receiveShadow = true; g.add(m); }
        modelReady(def.id);
      };
      if (specimens !== null) fill(); else void (async (): Promise<void> => { await loadSpecimens(); fill(); })();
      return g;
    },
  };
}
