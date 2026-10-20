import type { SpecimenAssetRow } from '@wildshard/game/models/specimenCatalogue';
import * as THREE from 'three';
import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { TIER } from '@wildshard/engine/core/tier';
import { readBakedGeometry, type BakedGeometryRow } from '@wildshard/sdk/kit/bakedGeometry';
import { fetchLaneBake } from '@wildshard/sdk/kit/geometryPack';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { PoiCtx, PlaceAnchors } from './types';
import type { PlaceGeometryRow, PlaceRow, MemberRow, EffectRow } from './placeTypes';
import prepared from '../boot/placeRuntime.generated.json' with { type: 'json' };
import poiPaint from '../boot/poiPaint.json' with { type: 'json' };
import signAtlases from '../boot/signAtlases.json' with { type: 'json' };

interface PreparedPlace extends Omit<PlaceRow, 'meshes' | 'members' | 'instances'> {
 readonly instances: readonly (readonly [string, { readonly placements: readonly unknown[]; readonly asset: SpecimenAssetRow; readonly scene: unknown }])[];
 readonly meshes: readonly { readonly geometry: PlaceGeometryRow; readonly offset: number; readonly material: string }[];
 readonly members: readonly (readonly [string, MemberRow])[];
}
const geometrySchema = v.object({ attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8']), v.number(), v.boolean()])), count: v.number(), index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: v.number(), box: v.boolean(), expand: v.boolean() });
const isPlaces = (input: unknown): input is readonly PreparedPlace[] => Array.isArray(input) && input.every(row => typeof row === 'object' && row !== null && 'name' in row && 'meshes' in row && 'members' in row);
const rows = v.parse(v.custom<readonly PreparedPlace[]>(isPlaces), prepared.places.rows);
const decode = (data: string): Uint8Array => unzlibSync(Uint8Array.from(atob(data), c => c.codePointAt(0) ?? 0));
function geometry(bytes: Uint8Array, at: number, row: BakedGeometryRow & { readonly expand: boolean }): THREE.BufferGeometry {
 const g = readBakedGeometry(bytes, at, row); if (!row.expand) return g;
 const flat = g.toNonIndexed(); g.dispose(); flat.computeBoundingBox(); flat.computeBoundingSphere(); return flat;
}
let places: Uint8Array | null = null, dressing: Uint8Array | null = null;
let placesLoading: Promise<void> | null = null, dressingLoading: Promise<void> | null = null;
let placesProvider: (() => Uint8Array) | null = null, dressingProvider: (() => Uint8Array) | null = null;
export const NALATI_PLACES_URL = '/assets/nalati/baked/places.bin', NALATI_DRESSING_URL = '/assets/nalati/baked/dressing.bin';
export function useNalatiPlaces(raw: Uint8Array): void { if (raw.length !== prepared.places.bytes) throw new Error('Place byte count differs'); places = raw; placesLoading = Promise.resolve(); }
export function useNalatiDressing(raw: Uint8Array): void { if (raw.length !== prepared.dressing.bytes) throw new Error('Dressing byte count differs'); dressing = raw; dressingLoading = Promise.resolve(); }
export function provideNalatiPlaces(read: () => Uint8Array): void { placesProvider = read; }
export function provideNalatiDressing(read: () => Uint8Array): void { dressingProvider = read; }
export function loadNalatiDressing(): Promise<void> { dressingLoading ??= fetchLaneBake(NALATI_DRESSING_URL).then(useNalatiDressing); return dressingLoading; }
export function preloadNalatiPlaces(): Promise<void> { placesLoading ??= fetchLaneBake(NALATI_PLACES_URL).then(useNalatiPlaces); return Promise.all([placesLoading, loadNalatiDressing()]).then(() => undefined); }
function placeBytes(): Uint8Array {
 if (places === null && placesProvider !== null) { const read = placesProvider; placesProvider = null; useNalatiPlaces(read()); }
 if (places === null) throw new Error('Place bake is not loaded'); return places;
}
export function bakedActorGeometry(key: string): THREE.BufferGeometry {
 const paint = poiPaint.rows.find(row => row.key === key);
 if (paint !== undefined) return geometry(decode(paint.data), 0, v.parse(geometrySchema, paint.geometry));
 const mesh = rows.find(row => row.name === `actor:${key}`)?.meshes[0];
 if (mesh === undefined) throw new Error(`no admitted actor shape ${key}`); return geometry(placeBytes(), mesh.offset, mesh.geometry);
}
export function bakedDressingGeo(key: string): THREE.BufferGeometry | null {
 if (dressing === null && dressingProvider !== null) { const read = dressingProvider; dressingProvider = null; useNalatiDressing(read()); }
 const row = prepared.dressing.rows.find(candidate => candidate.key === key);
 if (row === undefined) throw new Error(`Missing dressing shape ${key}`); return dressing === null ? null : geometry(dressing, row.offset, v.parse(geometrySchema, row.geometry));
}
export function bakedDressingContacts(name: string): ColliderDesc[] {
 const row = Object.entries(poiPaint.contacts[TIER]).find(([id]) => id === name)?.[1];
 if (row === undefined) throw new Error(`Missing dressing contacts ${name}`);
 const raw = decode(row.points), view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
 const points = Float32Array.from({ length: raw.length / 4 }, (_, i) => view.getFloat32(i * 4, true)); let at = 0;
 return row.origins.map(([x, y, z, count]) => { if (x === undefined || y === undefined || z === undefined || count === undefined) throw new Error('Missing contact origin'); const shape: ColliderDesc = { kind: 'hull', x, y, z, points: points.slice(at, at + count), surface: 'rock' }; at += count; return shape; });
}
export function bakedSignLettering(sky: SkyRig, key: 'roads' | 'specimen'): THREE.Mesh {
 const row = signAtlases[key], atlas = new THREE.DataTexture(decode(row.data), row.width, row.height);
 atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; atlas.flipY = true; atlas.generateMipmaps = true;
 atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.needsUpdate = true;
 const material = painterlyMaterial(sky, { rim: 0.2 }); material.map = atlas;
 const mesh = new THREE.Mesh(bakedActorGeometry(`sign-labels:${key}`), material); mesh.name = 'nalati-signs'; mesh.receiveShadow = true; return mesh;
}
export function bakedPlaceAnchors(name: string): PlaceAnchors {
 const anchors = rows.find(row => row.name === name)?.anchors; if (anchors === undefined) throw new Error(`Missing place anchors ${name}`); return anchors;
}
function effects(ctx: PoiCtx, effectsRows: readonly EffectRow[]): void {
 const colour = (c: unknown): THREE.ColorRepresentation => { if (typeof c === 'number' || typeof c === 'string') return c; throw new Error('Invalid cloth colour'); };
 const options = (o: unknown): Record<string, never> => typeof o === 'object' && o !== null ? o as Record<string, never> : {};
 for (const [kind, p, a, b, c, o] of effectsRows) {
  const at = new THREE.Vector3().fromArray(p);
  if (kind === 'emitter') ctx.smoke.emitter(at, options(a));
  else if (typeof a === 'number' && typeof b === 'number') { if (kind === 'streamer') ctx.flutter.streamer(at, a, b, colour(c), options(o)); else if (kind === 'flag') ctx.flutter.flag(at, a, b, colour(c), options(o)); else if (kind === 'strip') ctx.flutter.strip(at, a, b, colour(c)); else throw new Error('Invalid cloth effect'); }
  else throw new Error('Invalid place effect');
 }
}
/** Keep the original cloth and smoke calls beside their shard presentation. */
export function applyBakedPlaceEffects(name:string,ctx:PoiCtx):void{
 const row=rows.find(candidate=>candidate.name===name);if(row===undefined)throw new Error(`Missing place ${name}`);effects(ctx,row.effects);
}
export function bakedPlaceBounds(name:string):PreparedPlace['colliders']{
 const row=rows.find(candidate=>candidate.name===name);if(row===undefined)throw new Error(`Missing place ${name}`);return row.colliders;
}
