import { SpecimenCatalogueSchema, PackedSpecimenSchema, SpecimenMaterialSchema, PickupCatalogueSchema, assertSpecimenJson as jsonData } from '@wildshard/format/specimenCatalogue';
import { unzlibSync } from 'fflate';
import * as THREE from 'three';
import * as v from 'valibot';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRigLoader } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadTexture } from '@wildshard/engine/core/assets';
import { TIER, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { defineModel, announceModelReady, type ModelContext, type ModelBuild, type ModelDef } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { painterlyMaterial, painterlyKnobs } from '@wildshard/engine/world/painterly';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { bakedGeometryBytes, readBakedGeometry, fetchLaneBake, type BakedGeometryRow } from '../plugin/geometry';
import { pickup } from '@wildshard/engine/models/interact';
import { interactParts } from '@wildshard/engine/world/interact/kit';
import { registerPickupLook, type PickupPart } from '@wildshard/engine/world/interact/types';
import { installCoinModel } from '../loot/coinModel';

/** Install prepared pickup looks shared by authored interaction tables and loot effects.
 * Each request owns fresh geometry; unknown seeds refuse and no decoded template is retained. */
export function installPickupCatalogue(input: unknown): void {
  jsonData(input);
  const rows = v.parse(PickupCatalogueSchema, input);
  const keys = rows.geometries.map(row => `${row.key}:${row.seed}`);
  if (new Set(keys).size !== keys.length || new Set(rows.looks.map(row => row.id)).size !== rows.looks.length
    || new Set(rows.looks.map(row => row.model)).size !== rows.looks.length) throw new Error('Duplicate pickup declaration');
  if (rows.looks.some(row => row.parts.some(part => !keys.includes(`${part.key}:${rows.seed}`)))) throw new Error('Missing pickup specimen geometry');
  const geometry = (key: string, seed: number): THREE.BufferGeometry => {
    const row = rows.geometries.find(candidate => candidate.key === key && candidate.seed === seed);
    if (row === undefined) throw new Error(`No prepared pickup geometry: ${key}:${seed}`);
    const compressed = Uint8Array.from(atob(row.data), character => character.codePointAt(0) ?? 0);
    const bytes = unzlibSync(compressed);
    if (bytes.length !== bakedGeometryBytes(row.geometry)) throw new Error(`Invalid prepared pickup bytes: ${key}:${seed}`);
    return readBakedGeometry(bytes, 0, row.geometry);
  };
  for (const row of rows.looks) {
    const model = pickup(row.model, row.name, row.lift, ctx => row.parts.map(part =>
      interactParts[part.batch](ctx, geometry(part.key, rows.seed))), rows.file);
    registerPickupLook(row.id, { model, batch: row.batch, lift: row.lift,
      parts: row.parts.map(part => {
        const bound: PickupPart = { key: part.key, batch: part.batch, geometry: seed => geometry(part.key, seed) };
        if (part.bob !== undefined) bound.bob = part.bob;
        if (part.pulse !== undefined) bound.pulse = part.pulse;
        return bound;
      }),
    });
  }
  installCoinModel(seed => geometry(rows.coin, seed));
}

/** Data-only material binding. Cache identities are shared with live world users. */
export interface SpecimenMaterialRow {
  readonly id: string;
  readonly family: 'lowpoly' | 'painterly';
  readonly variant?: string | undefined;
  readonly rim?: number | undefined;
  readonly bands?: number | undefined;
  readonly sway?: number | undefined;
  readonly color?: string | number | readonly [number, number, number] | undefined;
  readonly floor?: number | undefined;
  readonly transparent?: boolean | undefined; readonly depthWrite?: boolean | undefined;
  readonly polygonOffset?: readonly [number,number] | undefined; readonly textureFallback?:readonly [number,number,number,number] | undefined;
  readonly texture?: { readonly url: string; readonly phoneUrl: string; readonly name: string } | undefined;
}

const materials = new WeakMap<SkyRig, Map<string, THREE.Material>>();
const textures = new Map<string, Promise<THREE.Texture>>();

/** A declared tile and its phone counterpart share their original cached texture with every surface. */
export function loadSpecimenTexture(row: NonNullable<SpecimenMaterialRow['texture']>): Promise<THREE.Texture> {
  const url = TIER_CONFIG.maxTexture <= 1024 ? row.phoneUrl : row.url;
  let pending = textures.get(url);
  if (pending === undefined) {
    pending = loadTexture(url, true).then(loaded => { loaded.name = row.name; return loaded; });
    textures.set(url, pending);
    const kept = pending; void cacheUntilDisposed(kept, () => { if (textures.get(url) === kept) textures.delete(url); });
  }
  return pending;
}

/** Bind the same declared surface for a world draw and its catalogue specimen. */
export function specimenMaterial(sky: SkyRig, input: unknown, map?: THREE.Texture | null): THREE.Material {
  jsonData(input);
  const row = v.parse(SpecimenMaterialSchema, input);
  if (row.family === 'lowpoly') return lowPolyLookMaterial(sky, row.variant ?? 'default');
  let bySky = materials.get(sky);
  if (bySky === undefined) { bySky = new Map(); materials.set(sky, bySky); }
  const cached = bySky.get(row.id);
  if (cached !== undefined) return cached;
  const color = typeof row.color === 'object' ? new THREE.Color().setRGB(...row.color) : row.color ?? 0xffffff;
  const material = painterlyMaterial(sky, { vertexColors: true, rim: row.rim ?? 0.35, bands: row.bands ?? 0.8,
    sway: row.sway ?? 0, transparent:row.transparent??false,depthWrite:row.depthWrite??true,color, ...(map === undefined ? {} : { map }) });
  if(row.polygonOffset!==undefined){material.polygonOffset=true;material.polygonOffsetFactor=row.polygonOffset[0];material.polygonOffsetUnits=row.polygonOffset[1];}
  if (row.floor !== undefined) { const knobs = painterlyKnobs(material); if (knobs !== undefined) knobs.uPFloorAmt.value = row.floor; }
  if (row.texture !== undefined) {
    const white = new THREE.DataTexture(Uint8Array.from(row.textureFallback??[255,255,255,255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace; white.wrapS = white.wrapT = THREE.RepeatWrapping; white.needsUpdate = true;
    material.map = white;
    void loadSpecimenTexture(row.texture).then(loaded => { material.map = loaded; return undefined; }).catch(() => undefined);
  }
  bySky.set(row.id, material);
  const cache = bySky; cacheUntilDisposed(material, () => { if (cache.get(row.id) === material) cache.delete(row.id); });
  return material;
}

/** Prepared GLB policy: the authored direct-child geometry slot and mapped material slot (both default to zero). */
export interface SpecimenAssetRow {
  readonly url: string;
  readonly phoneUrl?: string | undefined;
  readonly geometrySlot?: number | undefined;
  readonly materialSlot?: number | undefined;
  readonly material: SpecimenMaterialRow;
  readonly retainedAttribute?: string | undefined;
  readonly transform?: { readonly yaw:number; readonly scale:number } | undefined;
  /** Inert identity for an existing placement owner; never a procedural builder. */
  readonly instance?: { readonly name: string; readonly lod: 'near' | 'far' } | undefined;
}
export interface SpecimenAsset {
  readonly geometry: THREE.BufferGeometry;
  readonly map: THREE.Texture | null;
  readonly box: THREE.Box3;
  readonly retainedAttribute?: THREE.BufferAttribute;
}
const raw = new Map<string, Promise<SpecimenAsset>>();
const bound = new WeakMap<SkyRig, Map<string, Promise<SpecimenAsset & { readonly material: THREE.Material }>>>();
let loader: GLTFLoader | undefined;
const assetUrl = (row: Pick<SpecimenAssetRow, 'url' | 'phoneUrl'>): string => TIER === 'phone' ? row.phoneUrl ?? row.url : row.url;

/** Borrow a prepared primitive once. No fitting, painting, channel conversion or geometry copy. */
export function loadSpecimenAsset(row: Pick<SpecimenAssetRow, 'url' | 'phoneUrl' | 'geometrySlot' | 'materialSlot' | 'retainedAttribute'>): Promise<SpecimenAsset> {
  const url = assetUrl(row), key = `${url}|${row.geometrySlot ?? 0}|${row.materialSlot ?? 0}|${row.retainedAttribute ?? ''}`;
  let pending = raw.get(key);
  if (pending === undefined) {
    loader ??= createRigLoader();
    pending = loader.loadAsync(url).then(({ scene }) => {
      const found = scene.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh)[row.geometrySlot ?? 0];
      if (found === undefined) throw new Error(`Prepared specimen has no mesh: ${url}`);
      const geometry = found.geometry, retained = row.retainedAttribute === undefined ? undefined : geometry.getAttribute(row.retainedAttribute);
      if (row.retainedAttribute !== undefined && retained instanceof THREE.BufferAttribute) geometry.deleteAttribute(row.retainedAttribute);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = Array.isArray(found.material) ? found.material[row.materialSlot ?? 0] : (row.materialSlot ?? 0) === 0 ? found.material : undefined;
      if (material === undefined) throw new Error(`Prepared specimen has no material slot: ${url}`);
      const map = material instanceof THREE.MeshStandardMaterial ? material.map : null;
      if (map !== null) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
      const out: SpecimenAsset = { geometry, map, box: geometry.boundingBox?.clone() ?? new THREE.Box3(),
        ...(retained instanceof THREE.BufferAttribute ? { retainedAttribute: retained } : {}) };
      cacheUntilDisposed(out, () => { if (raw.get(key) === pending) raw.delete(key); });
      return out;
    });
    raw.set(key, pending);
  }
  return pending;
}

/** A prepared asset and its per-world material have one lifetime and one shared promise. */
export function loadBoundSpecimen(sky: SkyRig, row: SpecimenAssetRow): Promise<SpecimenAsset & { readonly material: THREE.Material }> {
  let bySky = bound.get(sky);
  if (bySky === undefined) { bySky = new Map(); bound.set(sky, bySky); }
  const key = `${assetUrl(row)}|${row.geometrySlot ?? 0}|${row.materialSlot ?? 0}|${row.material.id}|${JSON.stringify(row.transform??null)}`;
  let pending = bySky.get(key);
  if (pending === undefined) {
    pending = loadSpecimenAsset(row).then(asset => {
      const transform=row.transform,geometry=transform===undefined?asset.geometry:asset.geometry.clone().rotateY(transform.yaw).scale(transform.scale,transform.scale,transform.scale);
      const out = { ...asset,geometry, material: specimenMaterial(sky, row.material, asset.map) };
      const cache = bySky; cacheUntilDisposed(out, () => { cache.delete(key); });
      return out;
    });
    bySky.set(key, pending);
  }
  return pending;
}

/** Client-only replacement of native instance drawings by a declared prepared asset. */
export function replaceSpecimenInstances(sky:SkyRig,row:SpecimenAssetRow,meshes:readonly THREE.InstancedMesh[]):void{
  const replace=async():Promise<void>=>{
    try{
      const asset=await loadBoundSpecimen(sky,row);
      for(const mesh of meshes){if(mesh.count===0)continue;mesh.geometry=asset.geometry;mesh.material=asset.material;mesh.computeBoundingSphere();}
    }catch(error:unknown){console.warn('Prepared instance asset failed',error);}
  };void replace();
}

/** Await only loads already requested; does not start a load or impose a timed delay. */
export async function awaitSpecimenAssets(sky: SkyRig): Promise<void> {
  const observed = new Set<Promise<unknown>>();
  for (;;) {
    const pending = [...raw.values(), ...bound.get(sky)?.values() ?? []].filter(promise => !observed.has(promise));
    if (pending.length === 0) return;
    for (const promise of pending) observed.add(promise);
    await Promise.all(pending);
  }
}

/** Binary geometry rows retain exact channel types, offsets and optional expansion. */
export interface PackedSpecimenGeometry extends BakedGeometryRow { readonly expand: boolean }
export interface PackedSpecimenRow {
  readonly key: string;
  readonly parts: readonly { readonly material: string; readonly geometry: PackedSpecimenGeometry }[];
}
export interface PackedSpecimenBake {
  readonly bin: string; readonly bytes: number; readonly rows: readonly PackedSpecimenRow[];
}
/** Stable wire key: model identity and the authored parameter property order. */
export function specimenKey(id: string, params: object): string { return `${id} ${JSON.stringify(params)}`; }
interface PackedBakeState { readonly bytes: Uint8Array; readonly offsets: readonly number[] }

/** A packed specimen binary is immutable; builds decode fresh attributes just as the bake declares. */
export function createPackedSpecimens(input: unknown): {
  readonly use: (raw: Uint8Array) => void;
  readonly load: () => Promise<void>;
  readonly parts: (key: string, ctx: ModelContext, materials: Readonly<Record<string, SpecimenMaterialRow>>) => readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[] | null;
} {
  jsonData(input);
  const bake = v.parse(PackedSpecimenSchema, input);
  let state: PackedBakeState | undefined, pending: Promise<void> | undefined;
  const use = (bytes: Uint8Array): void => {
    if (bytes.length !== bake.bytes) throw new Error(`Specimen byte count differs: ${bake.bin}`);
    let offset = 0;
    const offsets: number[] = [];
    for (const row of bake.rows) for (const part of row.parts) { offsets.push(offset); offset += bakedGeometryBytes(part.geometry); }
    if (offset !== bytes.length) throw new Error(`Specimen rows do not cover binary: ${bake.bin}`);
    state = { bytes, offsets }; pending = Promise.resolve();
  };
  return { use,
    load: () => {
      pending ??= (async (): Promise<void> => {
        use(await fetchLaneBake(bake.bin));
      })();
      return pending;
    },
    parts: (key, ctx, materialRows) => {
      const index = bake.rows.findIndex(row => row.key === key), row = bake.rows[index];
      if (state === undefined || row === undefined) return null;
      const loaded = state;
      let first = 0;
      for (let i = 0; i < index; i++) first += bake.rows[i]?.parts.length ?? 0;
      return row.parts.map((part, i) => {
        let geometry = readBakedGeometry(loaded.bytes, loaded.offsets[first + i] ?? 0, part.geometry);
        if (part.geometry.expand) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
        const material = Object.hasOwn(materialRows, part.material) ? materialRows[part.material] : undefined;
        if (material === undefined) throw new Error(`Missing specimen material: ${part.material}`);
        return { geometry, material: specimenMaterial(ctx.sky, material) };
      });
    },
  };
}

/** Complete model declaration: parameters and specimen selection are data, with no shard callback. */
export type SpecimenModelRow = v.InferOutput<typeof SpecimenCatalogueSchema>[number];
/** Bind a named parameter map to an ordered catalogue. Definitions register immediately; assets remain lazy. */
export function defineSpecimenCatalogue<Params extends { readonly [K in keyof Params]: object }>(input: unknown, packedInput?: unknown, materialRowsInput: unknown = {}): { readonly model: <K extends keyof Params & string>(key: K) => ModelDef<Params[K]>; readonly usePacked: (bytes: Uint8Array) => void } {
  jsonData(input);
  jsonData(materialRowsInput);
  const packed = packedInput === undefined ? undefined : createPackedSpecimens(packedInput);
  const materialRows = v.parse(v.record(v.string(), SpecimenMaterialSchema), materialRowsInput);
  const rows = v.parse(SpecimenCatalogueSchema, input);
  if (rows.length > 1024 || new Set(rows.map(row => row.key)).size !== rows.length || new Set(rows.map(row => row.model.id)).size !== rows.length) throw new Error('Specimen catalogue must be bounded and unique');
  const parameterKey=(value:object):string=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0));
  for(const row of rows)if(row.source.kind==='selection'&&new Set(row.source.variants.map(variant=>parameterKey(variant.params))).size!==row.source.variants.length)throw new Error('Duplicate specimen selection');
  const definitions = new Map<string, ModelDef<object>>();
  for (const row of rows) {
    const build = (ctx: ModelContext, params: object): ModelBuild => {
      const source = row.source.kind==='selection'?row.source.variants.find(candidate=>parameterKey(candidate.params)===parameterKey(params))?.source:row.source;
      if(source===undefined)throw new Error(`No authored specimen: ${row.model.id}`);
      if(source.kind==='inline'){
        const decodedBytes=unzlibSync(Uint8Array.from(atob(source.data),character=>character.codePointAt(0)??0));
        if(decodedBytes.length!==bakedGeometryBytes(source.geometry))throw new Error('Inline specimen byte count differs');
        const decoded=readBakedGeometry(decodedBytes,0,source.geometry),geometry=source.geometry.expand?decoded.toNonIndexed():decoded;
        if(geometry!==decoded){decoded.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();}
        const part={geometry,material:specimenMaterial(ctx.sky,source.material),castShadow:true,receiveShadow:true};
        queueMicrotask(()=>{announceModelReady(row.model.id);});
        return source.representation==='parts'?[part]:new THREE.Group().add(Object.assign(new THREE.Mesh(part.geometry,part.material),{castShadow:true,receiveShadow:true}));
      }
      if (source.kind === 'owned') {
        const variant = source.variants.find(candidate => parameterKey(candidate.params) === parameterKey(params));
        if (variant === undefined) throw new Error(`No authored specimen: ${row.model.id}`);
        const material = specimenMaterial(ctx.sky, source.material);
        return loadingSpecimen(row.model.id, variant.size, async () => {
          const intake = createOwnedGeometry(variant.url); await intake.load();
          const mesh = new THREE.Mesh(intake.take(), material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
        });
      }
      const group = new THREE.Group();
      const fill = (): boolean => {
        if (packed === undefined) throw new Error(`Missing packed specimens: ${row.model.id}`);
        const parts = packed.parts(specimenKey(row.model.id, params), ctx, materialRows);
        if (parts === null) return false;
        for (const part of parts) { const mesh = new THREE.Mesh(part.geometry, part.material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
        queueMicrotask(() => { announceModelReady(row.model.id); }); return true;
      };
      if (source.kind === 'asset') {
        void (async (): Promise<void> => {
          try {
            const asset = await loadBoundSpecimen(ctx.sky, source.asset);
            const mesh = new THREE.Mesh(asset.geometry, asset.material); mesh.castShadow = true; mesh.receiveShadow = true;
            group.add(mesh); announceModelReady(row.model.id);
          } catch (error: unknown) { console.warn(`[models] ${row.model.id}: specimen asset failed`, error); }
        })();
      } else if (!fill()) {
        if (packed === undefined) throw new Error(`Missing packed specimens: ${row.model.id}`);
        const pendingBake = packed;
        void (async (): Promise<void> => {
          try { await pendingBake.load(); if (!fill()) console.warn(`[models] no baked specimen ${row.model.id}`); }
          catch (error: unknown) { console.error(`[models] ${row.model.id}: specimen bake failed`, error); }
        })();
      }
      return group;
    };
    const { surface: modelSurface, seed, variants, specimenYaw, ...metadata } = row.model;
    // Placement owners read this inert marker; the host remains the only specimen builder.
    if (row.source.kind === 'asset' && row.source.asset.instance !== undefined) {
      const { instance, material: binding } = row.source.asset;
      const look = { ...(binding.rim === undefined ? {} : { rim: binding.rim }),
        ...(binding.bands === undefined ? {} : { bands: binding.bands }),
        ...(binding.sway === undefined ? {} : { sway: binding.sway }),
        ...(binding.color === undefined ? {} : { color: binding.color }) };
      Object.assign(build, { gen: { id: row.model.id, name: instance.name, lod: instance.lod, look } });
    }
    definitions.set(row.key, defineModel<object>({ ...metadata, build,
      ...(modelSurface === undefined ? {} : { surface: modelSurface }), ...(seed === undefined ? {} : { seed }),
      ...(variants === undefined ? {} : { variants }), ...(specimenYaw === undefined ? {} : { specimenYaw }),
      ...(row.colliders === undefined ? {} : { colliders: () => (row.colliders ?? []).map(collider => {
        const { surface, yaw, ...shape } = collider;
        return Object.assign(shape, surface === undefined ? {} : { surface }, yaw === undefined ? {} : { yaw });
      }) }),
    }));
  }
  // Parameter types are supplied by the authoring definitions; only this host installs executable fields.
  return { usePacked: bytes => { if (packed === undefined) throw new Error('Catalogue has no packed specimens'); packed.use(bytes); }, model: <K extends keyof Params & string>(key: K): ModelDef<Params[K]> => {
    const definition = definitions.get(key);
    if (definition === undefined) throw new Error(`Missing catalogue model: ${key}`);
    const { defaults, variants, ...base } = definition;
    return { ...base, defaults: defaults as Params[K],
      ...(variants === undefined ? {} : { variants: variants.map(variant => ({ id: variant.id, label: variant.label, params: variant.params as Partial<Params[K]> })) }),
    };
  } };
}
