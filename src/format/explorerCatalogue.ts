import * as v from 'valibot';
import { isJsonData } from './json';
import { SocketRigCreatureSchema } from './socketRigCreature';
import { FigureAtlasSchema } from './figures';
import { MountedSpecimenSchema } from './mountedSpecimenRows';

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
export const ExplorerCatalogueSchema: v.GenericSchema<ExplorerCatalogueInput, ExplorerCatalogue> = v.pipe(v.unknown(), v.check(isJsonData, 'Explorer catalogue requires plain JSON'),
  v.strictObject({ version: v.literal(1), entries: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ ...meta, kind: v.literal('species'), species: text, spawnOnly: v.exactOptional(v.boolean()) }),
    v.strictObject({ ...meta, kind: v.literal('rigs'), library: text }),
    v.strictObject({ ...meta, kind: v.literal('held'), item: text }),
    v.strictObject({ ...meta, kind: v.literal('npc'), npc: text }),
    v.strictObject({ ...meta, kind: v.literal('scene'), part: text }),
    v.strictObject({ ...meta, kind: v.literal('library'), library: text, model: text }),
    v.strictObject({ ...meta, kind: v.literal('collection'), library: text, model: text }),
    v.strictObject({ ...meta, kind: v.literal('scene-model'), library: text, model: text }),
    v.strictObject({ ...meta, kind: v.literal('posed'), file: text, source: v.exactOptional(v.literal('product')) }),
    v.strictObject({ ...meta, kind: v.literal('figure'), file: text, figure: text }),
    v.strictObject({ ...meta, kind: v.literal('kit-figure'), file: text, figure: text }),
    /** a quest figure card drawn from merged figure atlases instead of kit parts (G601 C5): one card, a variant per atlas */
    v.strictObject({ ...meta, kind: v.literal('kit-figure'), atlases: v.pipe(v.record(text, v.strictObject({ label: text, phone: FigureAtlasSchema, desktop: FigureAtlasSchema })),
      v.check(rows => Object.keys(rows).length > 0, 'at least one figure atlas'), v.maxEntries(16)) }),
    v.strictObject({ ...meta, kind: v.literal('socket-creature'), rows: SocketRigCreatureSchema }),
    v.strictObject({ ...meta, kind: v.literal('equipment') }),
    v.strictObject({ ...meta, kind: v.literal('specimen'), books:v.strictObject({phone:text,desktop:text}), model:text,tierCopies:v.exactOptional(v.strictObject({phone:count,desktop:count})) }),
    // a cloud body's specimen (game/boss/encounterView `cloudBodySpecimen`) from its product rows (format/encounterRows CloudSpecimenSchema)
    v.strictObject({ ...meta, kind: v.literal('cloud'), json: text }),
    // G603 L10: a rider seated on a species rig (game models/mountedSpecimen `defineMountedSpecimen`)
    v.strictObject({ ...meta, kind: v.literal('mounted'), specimen: MountedSpecimenSchema }),
    v.strictObject({ ...meta, kind: v.literal('engine'), model: v.picklist(['swim-hands', 'training-dummy', 'hoverboard']) }),
  ])), v.maxLength(256)) }),
  v.check(rows => { const ids = rows.entries.flatMap(row => row.id === undefined ? [] : [row.id]); return new Set(ids).size === ids.length; }, 'Duplicate Explorer identity'));

export type ExplorerEntryRow = ExplorerCatalogue['entries'][number];
/** Refuse unknown fields, executable values and duplicate identities at build. */
export function parseExplorerCatalogue(input: unknown): ExplorerCatalogue { return v.parse(ExplorerCatalogueSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type ExplorerCatalogueInput = unknown;
export interface ExplorerCatalogue {
    version: 1;
    entries: (({
        kind: 'species';
        species: string;
        spawnOnly?: boolean;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'rigs';
        library: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'held';
        item: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'npc';
        npc: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'scene';
        part: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'library';
        library: string;
        model: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'collection';
        library: string;
        model: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'scene-model';
        library: string;
        model: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'posed';
        file: string;
        source?: 'product';
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'figure';
        file: string;
        figure: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'kit-figure';
        file: string;
        figure: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'kit-figure';
        atlases: Record<string, {
            label: string;
            phone: v.InferOutput<typeof FigureAtlasSchema>;
            desktop: v.InferOutput<typeof FigureAtlasSchema>;
        }>;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'socket-creature';
        rows: v.InferOutput<typeof SocketRigCreatureSchema>;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'equipment';
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'specimen';
        books: {
            phone: string;
            desktop: string;
        };
        model: string;
        tierCopies?: {
            phone: number;
            desktop: number;
        };
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'cloud';
        json: string;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'mounted';
        specimen: v.InferOutput<typeof MountedSpecimenSchema>;
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }) | ({
        kind: 'engine';
        model: 'swim-hands' | 'training-dummy' | 'hoverboard';
    } & {
        id?: string;
        name?: string;
        file?: string;
        category?: 'buildings' | 'nature' | 'creatures' | 'people' | 'gear' | 'props';
        pipeline?: ('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0') | (('code' | 'blender' | 'trellis' | 'hunyuan' | 'cc0')[]);
        surface?: 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water' | 'wood' | 'metal' | 'flesh' | 'shell' | 'ground' | 'edge' | 'felt' | 'earth';
        copies?: number;
        planned?: number;
        drawnAs?: 'single' | 'merged' | 'instanced' | 'skinned' | 'batched';
    }))[];
}
