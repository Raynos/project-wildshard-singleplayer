/**
 * Named prop materials (SHARD-PLATFORM SF55, G211): the data half of the GLB material adapter for authored (Blender)
 * worlds. Without it, every declared prop mesh draws with `props.family` and one per-model colour texture (the default
 * path, unchanged). With it, `props.materials` maps each baked GLB `material.name` (the source glTF material's exact name,
 * which the world bake keeps) to an admitted `look.materials` ID (or a platform family default) plus that surface's KTX2
 * texture slots and their glTF samplers: colour, normal (with its scale), metallic-roughness, occlusion (with its strength)
 * and emissive.
 *
 * - **No silent slot:** a mapped name whose material family cannot draw a slot is refused here (painterly reads no
 *   metallic-roughness; emissive reads only colour), and a graph material takes a slot only into its own texture param of
 *   the same name. A GLB material name absent from the map refuses its install (`checkPropMaterialNames`, and the engine
 *   installer at parse time).
 * - **Charged by the tiles:** every slot file is a KTX2 dependency of a declared props GLB, so the tile (or library) claim
 *   that leases the GLB already carries its textures.
 * - **One sampler per file:** a texture file is one GPU texture; two bindings may share a file only with equal samplers, and
 *   a slot file is never also a `look.materials` texture (whose sampler is the platform's default).
 *
 * The schema lives here, outside the format file (format ownership: sp-x5 wires `materials: v.exactOptional(PropMaterialsSchema)`
 * into `PropsSchema` and calls `validatePropMaterials` from the props reference check).
 */
import * as v from 'valibot';
import { FAMILY_IDS } from '@wildshard/engine/render/families/params';
import { materialTextureRefs, type MaterialsSchema } from './materials';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
/** A glTF material name as Blender exports it: exact, case-sensitive, spaces and numeric suffixes kept. */
const glbName = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^\P{Cc}+$/u, 'no control characters'), v.check((name) => name.trim() === name, 'no edge whitespace'), v.check((name) => !['__proto__', 'prototype', 'constructor'].includes(name), 'reserved name'));
/** glTF sampler enums (WebGL constants), as the world normalizer admits them. */
const wrap = v.picklist([33071, 33648, 10497]);
/** `anisotropy` (G227): the texture's anisotropic filtering samples, 1 (off) to 16, capped by the device (a hero prop's 4) */
const sampler = { file: ref, wrapS: v.optional(wrap, 10497), wrapT: v.optional(wrap, 10497), minFilter: v.optional(v.nullable(v.picklist([9728, 9729, 9984, 9985, 9986, 9987])), null), magFilter: v.optional(v.nullable(v.picklist([9728, 9729])), null), anisotropy: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)), 1) };
const slot = v.strictObject(sampler);
const finite = v.pipe(v.number(), v.finite());
/** The texture slots a named prop material may bind. */
export const PROP_MATERIAL_SLOTS = ['colour', 'normal', 'metallicRoughness', 'occlusion', 'emissive'] as const;
/** One texture slot name. */
export type PropMaterialSlot = (typeof PROP_MATERIAL_SLOTS)[number];
const binding = v.strictObject({
  id,
  colour: v.optional(v.nullable(slot), null),
  normal: v.optional(v.nullable(v.strictObject({ ...sampler, scale: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(4)), 1) })), null),
  metallicRoughness: v.optional(v.nullable(slot), null),
  occlusion: v.optional(v.nullable(v.strictObject({ ...sampler, strength: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(1)), 1) })), null),
  emissive: v.optional(v.nullable(slot), null),
});
/** `props.materials`: baked GLB material name → admitted material ID and its texture slots (1–256 names). */
export const PropMaterialsSchema = v.pipe(v.record(glbName, binding), v.check((rows) => { const n = Object.keys(rows).length; return n >= 1 && n <= 256; }, '1–256 named prop materials'));
/** Admitted named prop materials. */
export type PropMaterials = v.InferOutput<typeof PropMaterialsSchema>;
/** One admitted binding. */
export type PropMaterialBinding = PropMaterials[string];
/** One admitted texture slot with its sampler (and the normal scale / occlusion strength where the slot has one). */
export type PropTextureSlot = NonNullable<PropMaterialBinding['colour']> & { readonly scale?: number; readonly strength?: number };

const read = new WeakMap<object, PropMaterials | undefined>();
/**
 * A props section's named materials, admitted (undefined: the one-family path). Reads the additive `materials` field
 * whether or not the format's `PropsSchema` declares it yet, and validates it once per props object.
 */
export function propMaterialsOf(props: object): PropMaterials | undefined {
  if (read.has(props)) return read.get(props);
  const raw: unknown = 'materials' in props ? props.materials : undefined;
  const value = raw === undefined ? undefined : v.parse(PropMaterialsSchema, raw);
  read.set(props, value); return value;
}

/** A binding's filled slots, in slot order. */
export function propMaterialSlots(row: PropMaterialBinding): [PropMaterialSlot, PropTextureSlot][] {
  return PROP_MATERIAL_SLOTS.flatMap((name): [PropMaterialSlot, PropTextureSlot][] => { const value = row[name]; return value === null ? [] : [[name, value]]; });
}
/** Every texture file the named prop materials bind (the client transcodes them with the catalogue). */
export function propMaterialTextureRefs(materials: PropMaterials | undefined): string[] {
  return materials === undefined ? [] : [...new Set(Object.values(materials).flatMap((row) => propMaterialSlots(row).map(([, value]) => value.file)))];
}
/** How a slot's texels are read: colour and emissive are sRGB, the rest numeric data. */
export function propSlotUse(name: PropMaterialSlot): 'colour' | 'data' { return name === 'colour' || name === 'emissive' ? 'colour' : 'data'; }

/** The slots each material family can draw; a graph draws a slot only through its own texture param of that name. */
const FAMILY_SLOTS: Readonly<Record<string, readonly PropMaterialSlot[]>> = {
  pbr: PROP_MATERIAL_SLOTS, toon: PROP_MATERIAL_SLOTS, painterly: ['colour', 'normal', 'occlusion', 'emissive'], emissive: ['colour'],
};
const samplerKey = (s: PropTextureSlot): string => `${s.wrapS}/${s.wrapT}/${s.minFilter ?? '-'}/${s.magFilter ?? '-'}/${s.anisotropy}`;

/**
 * Check named prop materials against the look catalogue and the admitted files: each ID resolves (an authored entry or a
 * family default), each slot is one its family draws, each file is a KTX2 dependency of a declared props GLB in one
 * colour / data role with one sampler, and never also a catalogue texture; `props.textures` stays empty (`models` is
 * every declared props GLB: tiles, panels, models and the far proxy). Throws the first refusal, naming it.
 */
export function validatePropMaterials(materials: PropMaterials, context: {
  look: v.InferOutput<typeof MaterialsSchema>; models: readonly string[]; textures: readonly { model: string }[];
  files: readonly { hash: string; kind: string; dependencies: readonly string[] }[];
}): void {
  // the per-model colour texture is the one-family path's; with named materials every texture is a slot
  if (context.textures.length > 0) throw new Error('props.materials replaces props.textures: bind each texture as a named material slot');
  const files = new Map(context.files.map((file) => [file.hash, file]));
  const declared = new Set(context.models.flatMap((model) => files.get(model)?.dependencies ?? []));
  const catalogue = new Set(materialTextureRefs(context.look)), roles = new Map<string, string>(), samplers = new Map<string, string>();
  for (const [name, row] of Object.entries(materials)) {
    const entry = Object.hasOwn(context.look, row.id) ? context.look[row.id] : undefined;
    const family = entry?.family ?? FAMILY_IDS.find((f) => f === row.id);
    if (family === undefined) throw new Error(`props material "${name}": ${row.id} is not an admitted material ID`);
    for (const [slotName, value] of propMaterialSlots(row)) {
      if (family === 'graph') {
        const param = entry?.family === 'graph' ? entry.graph.params?.[slotName] : undefined;
        if (param?.type !== 'texture') throw new Error(`props material "${name}": graph ${row.id} has no texture param "${slotName}" for its ${slotName} slot`);
      } else if (!(FAMILY_SLOTS[family] ?? []).includes(slotName)) throw new Error(`props material "${name}": the ${family} family draws no ${slotName} slot`);
      const file = files.get(value.file);
      if (file?.kind !== 'ktx2' || !declared.has(value.file)) throw new Error(`props material "${name}": its ${slotName} texture must be a KTX2 dependency of a declared props GLB`);
      if (catalogue.has(value.file)) throw new Error(`props material "${name}": its ${slotName} texture is also a look.materials texture (one sampler per file)`);
      // a graph reads every texture param in the colour role (clientGraphs): its slots take that role
      const role = family === 'graph' ? 'colour' : propSlotUse(slotName), seenRole = roles.get(value.file);
      if (seenRole !== undefined && seenRole !== role) throw new Error(`props material "${name}": one texture cannot mix colour and numeric data roles`);
      roles.set(value.file, role);
      const key = samplerKey(value), seenSampler = samplers.get(value.file);
      if (seenSampler !== undefined && seenSampler !== key) throw new Error(`props material "${name}": one texture file takes one sampler`);
      samplers.set(value.file, key);
    }
  }
}

/** An admitted GLB's JSON document (its JSON chunk only; run after the bounded GLB parser admitted the bytes). */
function glbDocument(bytes: Uint8Array): object {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('invalid GLB header');
  const doc: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))));
  if (typeof doc !== 'object' || doc === null) throw new Error('invalid GLB JSON');
  return doc;
}
const rowsOf = (value: unknown, key: string): unknown[] => { const rows: unknown = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined; return Array.isArray(rows) ? rows : []; };
/** The material names an admitted self-contained GLB declares ('' for an unnamed one). */
export function glbMaterialNames(bytes: Uint8Array): string[] {
  return rowsOf(glbDocument(bytes), 'materials').map((row) => { const name: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, 'name') : undefined; return typeof name === 'string' ? name : ''; });
}
/**
 * Refuse a props GLB that names (or leaves unnamed) a material the map does not carry, or has a primitive without a
 * material: with named materials on, nothing draws a guessed surface.
 */
export function checkPropMaterialNames(materials: PropMaterials, bytes: Uint8Array): void {
  for (const name of glbMaterialNames(bytes)) if (!Object.hasOwn(materials, name)) throw new Error(`props GLB material "${name || '(unnamed)'}" is not in props.materials`);
  for (const mesh of rowsOf(glbDocument(bytes), 'meshes')) for (const primitive of rowsOf(mesh, 'primitives')) {
    if (typeof primitive !== 'object' || primitive === null || typeof Reflect.get(primitive, 'material') !== 'number') throw new Error('props GLB primitive has no material');
  }
}
