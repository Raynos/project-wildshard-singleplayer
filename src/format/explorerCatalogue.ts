import * as v from 'valibot';
import { isJsonData } from './json';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const count = v.pipe(finite, v.integer(), v.minValue(0));
const pipeline = v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0']);
const meta = {
  id: v.exactOptional(text), name: v.exactOptional(text), file: v.exactOptional(text),
  category: v.exactOptional(v.picklist(['buildings', 'nature', 'creatures', 'people', 'gear', 'props'])),
  pipeline: v.exactOptional(v.union([pipeline, v.pipe(v.array(pipeline), v.minLength(1), v.maxLength(16))])),
  surface: v.exactOptional(v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth'])),
  copies: v.exactOptional(count), planned: v.exactOptional(count),
  drawnAs: v.exactOptional(v.picklist(['single', 'merged', 'instanced', 'skinned', 'batched'])),
};
/** Client-only ordered references to existing model definitions. No executable
 * builders, reflected owners or private model format can cross this boundary. */
export const ExplorerCatalogueSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Explorer catalogue requires plain JSON'),
  v.strictObject({ version: v.literal(1), entries: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ ...meta, kind: v.literal('species'), species: text, spawnOnly: v.exactOptional(v.boolean()) }),
    v.strictObject({ ...meta, kind: v.literal('rigs'), library: text }),
    v.strictObject({ ...meta, kind: v.literal('held'), item: text }),
    v.strictObject({ ...meta, kind: v.literal('npc'), npc: text }),
    v.strictObject({ ...meta, kind: v.literal('scene'), part: text }),
    v.strictObject({ ...meta, kind: v.literal('library'), library: text, model: text }),
    v.strictObject({ ...meta, kind: v.literal('posed'), file: text, source: v.exactOptional(v.literal('product')) }),
    v.strictObject({ ...meta, kind: v.literal('figure'), file: text, figure: text }),
    v.strictObject({ ...meta, kind: v.literal('kit-figure'), file: text, figure: text }),
    v.strictObject({ ...meta, kind: v.literal('equipment') }),
    v.strictObject({ ...meta, kind: v.literal('specimen'), books:v.strictObject({phone:text,desktop:text}), model:text,tierCopies:v.exactOptional(v.strictObject({phone:count,desktop:count})) }),
    v.strictObject({ ...meta, kind: v.literal('engine'), model: v.picklist(['swim-hands', 'training-dummy', 'hoverboard']) }),
  ])), v.maxLength(256)) }),
  v.check(rows => { const ids = rows.entries.flatMap(row => row.id === undefined ? [] : [row.id]); return new Set(ids).size === ids.length; }, 'Duplicate Explorer identity'));
export type ExplorerCatalogue = v.InferOutput<typeof ExplorerCatalogueSchema>;
export type ExplorerEntryRow = ExplorerCatalogue['entries'][number];
/** Refuse unknown fields, executable values and duplicate identities at build. */
export function parseExplorerCatalogue(input: unknown): ExplorerCatalogue { return v.parse(ExplorerCatalogueSchema, input); }
