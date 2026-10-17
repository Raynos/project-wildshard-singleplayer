import * as THREE from 'three';
import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadTexture } from '@wildshard/engine/core/assets';
import { TIER, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { defineModel, announceModelReady, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { painterlyMaterial, painterlyKnobs } from '@wildshard/engine/world/painterly';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { bakedGeometryBytes, readBakedGeometry, fetchLaneBake, type BakedGeometryRow } from '../plugin/geometry';

const finite = v.pipe(v.number(), v.finite());
const whole = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(268435456));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const assetPath = v.pipe(text, v.regex(/^\/assets\/[a-zA-Z0-9/_.-]+$/u), v.check(path => !path.split('/').includes('..'), 'asset path stays within assets'));
const paramsSchema = v.record(v.string(), v.unknown());
const surfaceSchema = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const texture = v.strictObject({ url: assetPath, phoneUrl: assetPath, name: text });
const materialSchema = v.strictObject({ id: text, family: v.picklist(['lowpoly', 'painterly']), variant: v.optional(text),
  rim: v.optional(finite), bands: v.optional(finite), sway: v.optional(finite), floor: v.optional(finite),
  color: v.optional(v.union([v.string(), finite, v.tuple([finite, finite, finite])])), texture: v.optional(texture) });
const slot = v.pipe(whole, v.maxValue(128));
const assetSchema = v.strictObject({ url: assetPath, phoneUrl: v.optional(assetPath), material: materialSchema,
  geometrySlot: v.optional(slot), materialSlot: v.optional(slot), retainedAttribute: v.optional(text),
  instance: v.optional(v.strictObject({ name: text, lod: v.picklist(['near', 'far']) })) });
const pipeline = v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0']);
const model = v.strictObject({ id: text, name: text, file: text, category: v.picklist(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']),
  pipeline: v.union([pipeline, v.pipe(v.array(pipeline), v.maxLength(16))]), surface: v.optional(surfaceSchema), defaults: paramsSchema,
  variants: v.optional(v.pipe(v.array(v.strictObject({ id: text, label: text, params: paramsSchema })), v.maxLength(256))),
  seed: v.optional(finite), specimenYaw: v.optional(finite) });
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
  yaw: v.optional(finite), surface: v.optional(surfaceSchema) });
/** Complete JSON wire schema. It deliberately has no executable fields or extension callbacks. */
export const SpecimenCatalogueSchema = v.pipe(v.array(v.strictObject({ key: text, model,
  colliders: v.optional(v.pipe(v.array(box), v.maxLength(1024))),
  source: v.variant('kind', [v.strictObject({ kind: v.literal('packed') }), v.strictObject({ kind: v.literal('asset'), asset: assetSchema }),
    v.strictObject({ kind: v.literal('owned'), material: materialSchema, variants: v.pipe(v.array(v.strictObject({ params: paramsSchema, url: assetPath, size: v.tuple([finite, finite, finite]) })), v.maxLength(256)) })]),
})), v.maxLength(1024));
const geometrySchema = v.strictObject({ attrs: v.pipe(v.array(v.tuple([text, v.picklist(['f32', 'f16', 'u16', 'i8', 'u8']), whole, v.boolean()])), v.maxLength(32)),
  count: whole, index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: whole, box: v.boolean(), expand: v.boolean() });
/** Packed bake metadata may also retain the generator's notice, part name and slot. */
export const PackedSpecimenSchema = v.object({ bin: assetPath, bytes: whole,
  rows: v.pipe(v.array(v.object({ key: text, parts: v.pipe(v.array(v.object({ material: text, geometry: geometrySchema })), v.maxLength(64)) })), v.maxLength(4096)) });
const jsonData = (input: unknown): void => { if (!isJsonData(input)) throw new Error('Specimen declarations require plain JSON data'); };

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
  const row = v.parse(materialSchema, input);
  if (row.family === 'lowpoly') return lowPolyLookMaterial(sky, row.variant ?? 'default');
  let bySky = materials.get(sky);
  if (bySky === undefined) { bySky = new Map(); materials.set(sky, bySky); }
  const cached = bySky.get(row.id);
  if (cached !== undefined) return cached;
  const color = typeof row.color === 'object' ? new THREE.Color().setRGB(...row.color) : row.color ?? 0xffffff;
  const material = painterlyMaterial(sky, { vertexColors: true, rim: row.rim ?? 0.35, bands: row.bands ?? 0.8,
    sway: row.sway ?? 0, color, ...(map === undefined ? {} : { map }) });
  if (row.floor !== undefined) { const knobs = painterlyKnobs(material); if (knobs !== undefined) knobs.uPFloorAmt.value = row.floor; }
  if (row.texture !== undefined) {
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
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
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
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
  const key = `${assetUrl(row)}|${row.geometrySlot ?? 0}|${row.materialSlot ?? 0}|${row.material.id}`;
  let pending = bySky.get(key);
  if (pending === undefined) {
    pending = loadSpecimenAsset(row).then(asset => {
      const out = { ...asset, material: specimenMaterial(sky, row.material, asset.map) };
      const cache = bySky; cacheUntilDisposed(out, () => { cache.delete(key); });
      return out;
    });
    bySky.set(key, pending);
  }
  return pending;
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
  const materialRows = v.parse(v.record(v.string(), materialSchema), materialRowsInput);
  const rows = v.parse(SpecimenCatalogueSchema, input);
  if (rows.length > 1024 || new Set(rows.map(row => row.key)).size !== rows.length || new Set(rows.map(row => row.model.id)).size !== rows.length) throw new Error('Specimen catalogue must be bounded and unique');
  const definitions = new Map<string, ModelDef<object>>();
  for (const row of rows) {
    const build = (ctx: ModelContext, params: object): THREE.Object3D => {
      const source = row.source;
      if (source.kind === 'owned') {
        const key = (value: object): string => JSON.stringify(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
        const variant = source.variants.find(candidate => key(candidate.params) === key(params));
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
        announceModelReady(row.model.id); return true;
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
