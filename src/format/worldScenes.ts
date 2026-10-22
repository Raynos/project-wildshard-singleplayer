import * as v from 'valibot';
import { WorldEntrySchema } from './worldEntry';
import { WorldSceneSurfaceSchema } from './worldSceneSurface';
import { isJsonData } from './json';
import { WorldSceneBindingsSchema } from './clientChannels';
import { WorldScenePlacementSchema } from './worldScenePlacement';
import { WorldSceneBatchSchema } from './worldSceneBatch';
import { WorldSceneWeldMaterialSchema, WorldSceneWeldSourceSchema } from './worldSceneWeld';
import { SceneDrawsSchema } from './sceneDraws';
import { SpecimenCatalogueSchema } from './specimenCatalogue';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const triple = v.tuple([finite, finite, finite]);
const bounded = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const strings = v.pipe(v.record(id, id), v.check(rows => Object.keys(rows).length <= 128));
const reference = v.strictObject({ library: id, model: id });
const tierFile = v.union([id, v.strictObject({ phone: id, desktop: id })]);
// Little-endian float32 columns read from a product blob: `count` rows of the row's width from `byteOffset`.
const packet = v.strictObject({ file: id, storage: v.literal('f32'), byteOffset: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0x7fffffff), v.check(offset => offset % 4 === 0, 'Packet offsets are float32-aligned')),
  count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8192)) });
const instanceValues = { values: v.exactOptional(bounded(finite, 32768)), packet: v.exactOptional(packet) };
const library = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('models'), file: id }),
  v.strictObject({ id, kind: v.literal('baked'), file: id }),
  v.strictObject({ id, kind: v.literal('owned'), models: bounded(v.strictObject({ id, tier: v.exactOptional(v.picklist(['phone', 'desktop'])), file: tierFile, segments: v.exactOptional(v.pipe(bounded(id, 15), v.minLength(1))), attributes: v.optional(strings, {}) }), 128) }),
  // Whole geometry already in the shardfile library: each model one partition id, the tiles (asset hashes) holding it,
  // optionally posed. `explorer` libraries stay out of the resident world; a specimen reads only its own tiles cold.
  v.strictObject({ id, kind: v.literal('whole'), load: v.exactOptional(v.literal('explorer')),
    models: bounded(v.strictObject({ id, part: id, files: v.pipe(bounded(id, 64), v.minLength(1)), matrix: v.exactOptional(v.pipe(v.array(finite), v.length(16))) }), 256) }),
  // A rest pool per file (tier-selected by name or by `tier`), its Float32 application channels renamed on load;
  // `publish` names every part as an owned geometry handle `<publish>.<part>`.
  v.strictObject({ id, kind: v.literal('pool'), publish: v.exactOptional(id), files: bounded(v.strictObject({ file: tierFile, tier: v.exactOptional(v.picklist(['phone', 'desktop'])), parts: bounded(id, 128),
    channels: v.exactOptional(bounded(v.strictObject({ name: id, source: id, width: v.picklist([1, 2, 3, 4]), parts: v.exactOptional(bounded(id, 128)) }), 16)) }), 32),
    painted: v.optional(bounded(v.strictObject({ id, file: id, geometry: id }), 32), []) }),
]);
const poolParts = (files: readonly { readonly tier?: 'phone' | 'desktop'; readonly parts: readonly string[] }[]): boolean => (['phone', 'desktop'] as const)
  .every(tier => { const parts = files.flatMap(file => file.tier === undefined || file.tier === tier ? file.parts : []); return new Set(parts).size === parts.length; });
const material = v.variant('kind', [WorldSceneSurfaceSchema,
  v.strictObject({ id, kind: v.literal('source'), load: v.optional(v.picklist(['resident', 'placement']), 'resident'), url: id, publishObject: v.exactOptional(id), aliases: v.optional(v.record(id, id), {}), part: v.optional(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(127)), 0),
    anisotropy: v.optional(v.pipe(finite, v.minValue(1), v.maxValue(16)), 1), anisotropyMaps: v.optional(bounded(v.picklist(['map', 'normalMap', 'roughnessMap', 'aoMap']), 4), ['map', 'normalMap']), envMapIntensity: v.optional(finite, 1),
    // the source's own PBR maps leave the CPU once uploaded
    gpuOnlyMaps: v.exactOptional(v.literal(true)) }),
  // a fresh material over an earlier section source's declared maps, in the weld's material grammar
  v.strictObject({ id, kind: v.literal('mapped'), material: v.omit(WorldSceneWeldMaterialSchema, ['id']) }),
  v.strictObject({ id, kind: v.literal('lowpoly'), variant: id, properties: v.optional(v.strictObject({ flatShading: v.exactOptional(v.boolean()), roughness: v.exactOptional(finite) }), {}) }),
  v.strictObject({ id, kind: v.literal('basic'), properties: v.strictObject({ vertexColors: v.exactOptional(v.boolean()), color: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff))), side: v.exactOptional(v.picklist([0, 1, 2])), transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(finite), depthWrite: v.exactOptional(v.boolean()), blending: v.exactOptional(v.picklist([0, 1, 2, 3, 4, 5])) }) }),
  v.strictObject({ id, kind: v.literal('look'), look: id, over: v.exactOptional(reference) }),
  v.strictObject({ id, kind: v.literal('standard'), sky: v.exactOptional(v.boolean()), properties: v.strictObject({ color: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff))), roughness: v.exactOptional(finite),
    metalness: v.exactOptional(finite), transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(finite), depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) }) }),
]);
const contactSurface = v.exactOptional(v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']));
const box = v.strictObject({ surface: contactSurface, kind: v.literal('box'), x: finite, y: finite, z: finite, hx: v.pipe(finite, v.minValue(0)), hy: v.pipe(finite, v.minValue(0)), hz: v.pipe(finite, v.minValue(0)), yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })) });
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const point = v.strictObject({ x: finite, y: finite, z: finite });
const treads = v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: v.pipe(finite, v.minValue(0)), count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)), surface: v.exactOptional(surface) });
const hull = v.strictObject({ surface: contactSurface, kind: v.literal('hull'), x: finite, y: finite, z: finite, points: v.pipe(bounded(finite, 24576), v.minLength(12), v.check(points => points.length % 3 === 0)), yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })) });
const registry = v.strictObject({ id, name: id, file: id, category: v.picklist(['ground', 'nature', 'buildings', 'props']), part: id,
  colliders: bounded(v.variant('kind', [box, treads, hull]), 2048), surface: v.exactOptional(surface), mode: v.exactOptional(v.picklist(['foot', 'board', 'swim', 'ride'])), solidFloor: v.optional(v.boolean(), false), active: v.exactOptional(id) });
const instance = v.strictObject({ id, position: v.exactOptional(triple), rotation: v.exactOptional(triple) });
const step = v.strictObject({ id, cube: v.exactOptional(v.picklist(['standalone', 'cell'])), load: v.exactOptional(v.literal('explorer')), scene: v.exactOptional(id), variants: v.exactOptional(v.strictObject({ standalone: id, cell: id })),
  draws: v.exactOptional(SceneDrawsSchema),
  models: v.exactOptional(v.pipe(v.record(id, reference), v.check(rows => Object.keys(rows).length <= 128))),
  textures: v.exactOptional(v.pipe(v.record(id, reference), v.check(rows => Object.keys(rows).length <= 128))),
  baked: v.exactOptional(v.pipe(v.record(id, reference), v.check(rows => Object.keys(rows).length <= 128))),
  collectMaterials: v.exactOptional(bounded(id, 16)),
  lights: v.exactOptional(bounded(v.strictObject({ id, color: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff)), intensity: finite, distance: finite, decay: finite }), 16)),
  geometry: v.optional(v.pipe(v.record(id, reference), v.check(rows => Object.keys(rows).length <= 128)), {}),
  materials: v.optional(strings, {}), registry: v.optional(bounded(registry, 128), []),
  publish: v.optional(WorldSceneBindingsSchema, {}), repeat: v.exactOptional(bounded(instance, 128)),
  // per-instance values, inline or a product packet: a geometry attribute (`name`, the default target), the mesh's own
  // instanceColor (RGB) or its instanceMatrix (replacing the recipe's matrices)
  instanceAttributes: v.optional(bounded(v.pipe(v.union([v.strictObject({ part: id, name: id, target: v.exactOptional(v.literal('geometry')), width: v.picklist([1, 2, 3, 4]), ...instanceValues }),
    v.strictObject({ part: id, target: v.literal('instanceColor'), width: v.literal(3), ...instanceValues }), v.strictObject({ part: id, target: v.literal('instanceMatrix'), width: v.literal(16), ...instanceValues })]),
  v.check(row => (row.values === undefined) !== (row.packet === undefined), 'Instance values are inline or a packet')), 32), []),
  bounds: v.optional(bounded(v.strictObject({ part: id, sphere: v.strictObject({ center: triple, radius: v.pipe(finite, v.minValue(0)) }) }), 128), []),
});
// Textures lent to compiled looks before the world builds: an image (its pixel size optionally lent as a vec2 param),
// JPEG layers (each with an optional alpha JPEG, else ½) read back into one repeating, mipmapped RGBA8 array, or a
// product's own KTX2 blob for the tier, sampled by its row, GPU-only once uploaded and optionally published as a handle; or
// a baked volume (a deflated RGBA8 3D texture per tier and world variant, with its box `min`, inverse extent `inv` and
// `maximum`) lent to its looks' params with those numbers and published as `<publish>` (texture), `.min`, `.inv`, `.maximum`.
const wrap = v.exactOptional(v.picklist([1000, 1001, 1002]));
// the look sampler row (format/materials.ts TextureSamplersSchema): wrap, anisotropy, filter, file or GPU mips
const sampler = v.strictObject({ wrap: v.exactOptional(v.picklist(['repeat', 'clamp', 'mirror'])), anisotropy: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16))),
  filter: v.exactOptional(v.picklist(['linear', 'nearest'])), mips: v.exactOptional(v.picklist(['file', 'gpu'])) });
const voxels = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(512));
const volume = v.strictObject({ file: id, size: v.tuple([voxels, voxels, voxels]), min: triple, inv: triple, maximum: finite });
const tierVolumes = v.strictObject({ phone: volume, desktop: volume });
const lentTexture = v.variant('kind', [
  v.strictObject({ kind: v.literal('image'), looks: v.pipe(bounded(id, 32), v.minLength(1)), param: id, url: id, srgb: v.exactOptional(v.boolean()), wrapS: wrap, wrapT: wrap,
    anisotropy: v.exactOptional(v.pipe(finite, v.minValue(1), v.maxValue(16))), sizeParam: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('layers'), looks: v.pipe(bounded(id, 32), v.minLength(1)), param: id, base: id, label: id,
    size: v.strictObject({ phone: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(4096)), desktop: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(4096)) }),
    anisotropy: v.pipe(finite, v.minValue(1), v.maxValue(16)), layers: v.pipe(bounded(v.strictObject({ name: id, alpha: v.boolean() }), 64), v.minLength(1)) }),
  v.strictObject({ kind: v.literal('product'), looks: v.optional(bounded(id, 32), []), param: v.exactOptional(id), file: v.strictObject({ phone: id, desktop: id }), label: id,
    colour: v.exactOptional(v.picklist(['srgb', 'linear'])), sampler, publish: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('volume'), looks: v.pipe(bounded(id, 32), v.minLength(1)), label: id, publish: id,
    params: v.strictObject({ texture: id, min: id, inv: id, maximum: id }), files: v.strictObject({ standalone: tierVolumes, cell: tierVolumes }) }),
]);
const unique = (rows: readonly { readonly id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
/** Client-only static assembly. Recipes, slots and named references are bounded plain data. */
export const WorldScenesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'World scenes require plain JSON'),
  v.strictObject({ version: v.literal(1), libraries: bounded(library, 32), materials: bounded(material, 128), steps: bounded(step, 64), catalogue: v.exactOptional(id),
    // the declared world entry (format/worldEntry): the ordered rows the world build runs over these scenes
    entry: v.exactOptional(WorldEntrySchema),
    // G3: code-built specimen models (the shard's specimen catalogue rows) its placements may name beside the site catalogue's
    specimens: v.exactOptional(SpecimenCatalogueSchema),
    dressing: v.exactOptional(v.strictObject({phone:id,desktop:id})),
    cosmeticDraws: v.exactOptional(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(1000000))),
    batches: v.optional(bounded(WorldSceneBatchSchema, 32), []), lent: v.optional(bounded(lentTexture, 32), []),
    welds: v.optional(bounded(WorldSceneWeldSourceSchema, 32), []),
    placements: v.optional(bounded(v.union([WorldScenePlacementSchema, v.strictObject({ id, file: id, tier: v.exactOptional(v.picklist(['phone', 'desktop'])) })]), 128), []) }),
  v.check(row => unique(row.libraries) && unique(row.materials) && unique(row.steps) && unique(row.batches) && unique(row.welds) && unique(row.placements) && (row.placements.length === 0 || row.catalogue !== undefined)
    && row.libraries.every(entry => entry.kind === 'models' || entry.kind === 'baked' || (entry.kind === 'owned' || entry.kind === 'whole' ? unique(entry.models) : poolParts(entry.files) && unique(entry.painted) && entry.painted.every(model => entry.files.some(file => file.parts.includes(model.geometry)))))
    && row.steps.every(entry => entry.registry.every(piece => piece.active === undefined || piece.mode === undefined) && (entry.scene === undefined) !== (entry.variants === undefined) && (entry.repeat === undefined || unique(entry.repeat))
      && (entry.lights === undefined || unique(entry.lights)) && (entry.collectMaterials === undefined || new Set(entry.collectMaterials).size === entry.collectMaterials.length)), 'Unique scene identities and exactly one recipe source'),
  // a mapped material's maps come from a resident source row before it
  v.check(row => row.materials.every((entry, index) => entry.kind !== 'mapped' || entry.material.source === undefined
    || row.materials.slice(0, index).some(earlier => earlier.kind === 'source' && earlier.load === 'resident' && earlier.id === entry.material.source?.material)), 'Mapped scene materials map an earlier resident source'));
type ParsedWorldScenes = v.InferOutput<typeof WorldScenesSchema>;
export type WorldScenesSection = Omit<ParsedWorldScenes, 'placements' | 'batches' | 'welds' | 'lent'> & { readonly placements?: ParsedWorldScenes['placements']; readonly batches?: ParsedWorldScenes['batches']; readonly welds?: ParsedWorldScenes['welds']; readonly lent?: ParsedWorldScenes['lent'] };
export type WorldSceneLentTexture = ParsedWorldScenes['lent'][number];
/** Reject executable values, duplicate identities and unknown fields before allocating visuals. */
export function parseWorldScenes(input: unknown): ParsedWorldScenes { return v.parse(WorldScenesSchema, input); }

/** Select declared presentation membership before decoding or allocating any library/batch.
 * Unmarked rows remain shared; recipe/profile variants inside a tier retain their existing selectors. */
export function worldScenesForTier(section: WorldScenesSection, tier: 'phone' | 'desktop'): WorldScenesSection {
  const active = (row: { readonly tier?: 'phone' | 'desktop' }): boolean => row.tier === undefined || row.tier === tier;
  const libraries: WorldScenesSection['libraries'] = [];
  for (const entry of section.libraries) libraries.push(entry.kind === 'owned' ? { ...entry, models: entry.models.filter(active) }
    : entry.kind === 'pool' ? { ...entry, files: entry.files.filter(active) } : entry);
  return { ...section, libraries, batches: section.batches?.filter(active) ?? [], placements: section.placements?.filter(active) ?? [] };
}
