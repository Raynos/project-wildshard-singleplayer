import type { Ktx2DeviceCosts } from './ktx2Cost';
import { AdmissionLateSchema, lateLibraryRootsValid, type AdmissionLate } from './admissionLate';
/** Versioned, renderer-free disk contract shared by the writer and network reader. */
import { isOutputIndex, outputBlobPath } from './outputAddress';
import { OUTPUT_SECTIONS, assembleOutputTransport, isPlatformDataSection, type OutputHostSectionName } from './outputFields';
import * as v from 'valibot';
import { assertCellBounds } from './cellBounds';
import { ShardfileFieldSchemas, parseShardfile, type Shardfile } from './shardSchema';
import { LegacyRuntimeSchema, ClientPlanRuntimeSchema } from './runtime';
import { RuntimeSpawnsSchema } from './runtimeSpawns';
import { RowsSchema } from './rows';
import { ShardHashSchema, ShardNaturalSchema, IdentitySchema, RequiresSchema, FilesSchema, type ShardIdentityInput, type ShardRequiresInput, type ShardReferencesInput, type ShardIdentity, type ShardRequires, type ShardReferences } from './shardSections';
import { SHARDFILE_VERSION } from './version';
import { isJsonData, isJsonDataWithFileSchemas } from './json';
import { clientOwnershipRules } from './clientOwnership';
import { PLATFORM_DATA_SECTIONS } from './platformDataSections';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';

const path = v.pipe(v.string(), v.maxLength(240), v.regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/u));
const sectionName = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*\/[a-zA-Z][a-zA-Z0-9_-]*$/u));
const measuredFile = { path, hash: ShardHashSchema, bytes: ShardNaturalSchema };
const section = v.strictObject({ ...measuredFile, name: sectionName, schema: v.pipe(v.string(), v.maxLength(240)) });
const costs = v.omit(FilesSchema.pipe[0].item, ['kind']).entries;
const fileSchema = v.strictObject({ ...costs, path, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'tile', 'bin', 'image']), name: v.exactOptional(v.pipe(v.string(), v.maxLength(240))), tier: v.exactOptional(v.picklist(['phone', 'desktop'])), variantOf: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(240))), commons: v.exactOptional(v.literal(true)), jsonSchema: v.exactOptional(v.record(v.string(), v.unknown())) });
const runtime = v.union([
  v.strictObject({ ...v.omit(LegacyRuntimeSchema.pipe[0], ['spawns']).entries, trust: v.literal('first-party'), files: v.array(v.strictObject({ ...measuredFile, lines: ShardNaturalSchema })), lines: ShardNaturalSchema }),
  v.strictObject({ ...v.omit(ClientPlanRuntimeSchema.pipe[0], ['spawns']).entries, trust: v.literal('first-party'), files: v.pipe(v.array(v.strictObject({ ...measuredFile, lines: ShardNaturalSchema })), v.maxLength(0)), lines: v.literal(0) }),
]);
/** Format 2 inventories every emitted byte except its index and validation receipt. */
export const OutputIndexSchema: v.GenericSchema<OutputIndexRowsInput, OutputIndexRows> & { readonly entries: { readonly [Key in keyof OutputIndexRows]-?: v.GenericSchema<OutputIndexRowsInput[Key], OutputIndexRows[Key]> } } = v.strictObject({
  format: v.literal('wildshard.shardfile'), formatVersion: v.literal(2), sdk: v.literal('0.2'), version: v.literal(SHARDFILE_VERSION),
  identity: IdentitySchema, build: v.strictObject({ sourceHash: ShardHashSchema, validator: v.pipe(v.string(), v.minLength(1), v.maxLength(160)) }), requires: RequiresSchema,
  admission: v.strictObject({ budgets: ShardfileFieldSchemas.budgets, serverBudget: ShardfileFieldSchemas.serverBudget, authorCaps: ShardfileFieldSchemas.authorCaps, critical: ShardfileFieldSchemas.critical, library: ShardfileFieldSchemas.library, late: v.exactOptional(AdmissionLateSchema) }),
  sections: v.pipe(v.array(section), v.maxLength(256)), schemas: v.pipe(v.array(v.strictObject(measuredFile)), v.maxLength(128)),
  files: v.pipe(v.array(fileSchema), v.maxLength(8192)), runtime: v.nullable(runtime),
  ktx2Costs: v.exactOptional(v.pipe(v.record(ShardHashSchema,v.strictObject({rgba:ShardNaturalSchema,astc:ShardNaturalSchema,bc7:ShardNaturalSchema})),v.check(rows=>Object.keys(rows).length<=8192,'bounded texture cost table'))),
  /** iPhone downloads I5: content-hashed concatenations of the small sections, schemas and files, so a reader can fetch
   *  one pack instead of hundreds of files; every member keeps its own listed path, hash and size */
  packs: v.exactOptional(v.pipe(v.array(v.strictObject({ ...measuredFile, entries: v.pipe(v.array(v.strictObject({
    hash: ShardHashSchema, offset: ShardNaturalSchema, bytes: ShardNaturalSchema })), v.minLength(1), v.maxLength(8192)) })), v.maxLength(64))),
});
export type OutputIndex = v.InferOutput<typeof OutputIndexSchema>;
export type OutputFile = OutputIndex['files'][number];
const OUTPUT_DATA_SECTIONS: typeof PLATFORM_DATA_SECTIONS=PLATFORM_DATA_SECTIONS;
/** Compile-time coverage is checked against the public platform-section registry. */
export type OutputPlatformSectionName = OutputHostSectionName | keyof typeof OUTPUT_DATA_SECTIONS;
/** Parse the supported major and refuse duplicate, escaping or noncanonical inventory paths. */
export function parseOutputIndex(input: unknown): OutputIndex {
  if (!isJsonDataWithFileSchemas(input)) throw new Error('Output index must contain plain JSON only');
  return parseOutputIndexRows(input);
}
/** Check plain data before detecting the disk envelope; legacy models return null.
 * Index admission shares this single bounded walk with its strict inventory parse. */
export function parseOutputDescriptorIndex(input: unknown): OutputIndex | null {
  if (!isJsonDataWithFileSchemas(input)) throw new Error('Shardfile descriptor requires bounded plain JSON');
  return isOutputIndex(input) ? parseOutputIndexRows(input) : null;
}
function parseOutputIndexRows(input: unknown): OutputIndex {
  const index = v.parse(OutputIndexSchema, input), paths = new Set(['shard.json', 'validation.json']), names = new Set<string>();
  if (index.ktx2Costs !== undefined) {
    const textures = new Map(index.files.filter(row=>row.kind==='ktx2' && row.commons!==true).map(row=>[row.hash,row]));
    for (const [hash,cost] of Object.entries(index.ktx2Costs)) {
      const file = textures.get(hash);
      if (file===undefined || cost.rgba>file.gpu || cost.astc>cost.rgba*4 || cost.bc7>cost.rgba*4) throw new Error('Invalid KTX2 device cost table');
    }
  }
  if (index.sections.reduce((total, entry) => total + entry.bytes, 0) > limits.sourceBytes) throw new Error('Output sections exceed the source byte cap');
  for (const entry of [...index.sections, ...index.schemas, ...index.files, ...index.runtime?.files ?? []]) {
    if (entry.path.split('/').some(part => part === '.' || part === '..') || paths.has(entry.path)) throw new Error('Duplicate or escaping output path');
    paths.add(entry.path);
  }
  for (const entry of index.sections) {
    if (names.has(entry.name) || entry.path !== `sections/${entry.name}.json`) throw new Error('Duplicate or mismatched section path');
    names.add(entry.name);
    if (entry.name.startsWith('custom/')) {
      if (entry.schema !== `schemas/${entry.name}.schema.json` || !index.schemas.some(row => row.path === entry.schema)) throw new Error('Custom section needs its listed schema');
    } else if ((!OUTPUT_SECTIONS.some(row => row.name === entry.name) && !isPlatformDataSection(entry.name)) || entry.schema !== `wildshard:${entry.name}@1`) throw new Error('Unknown platform section schema');
  }
  for (const entry of index.schemas) if (!index.sections.some(row => row.schema === entry.path)) throw new Error('Unreferenced custom schema');
  const refs = new Set<string>(), logical = new Set<string>();
  for (const entry of index.files) {
    outputBlobPath(entry);
    if (entry.jsonSchema !== undefined && (entry.kind !== 'json' || entry.name === undefined)) throw new Error('JSON schema requires a named JSON blob');
    const ref = `${entry.commons === true ? 'commons:' : ''}${entry.hash}`;
    if (refs.has(ref)) throw new Error('Duplicate output blob reference'); refs.add(ref);
    if (entry.name !== undefined) { if (logical.has(entry.name)) throw new Error('Duplicate logical blob name'); logical.add(entry.name); }
    // a tiered file is one device tier's named, non-critical download (the other tier's selection drops it)
    if ((entry.tier !== undefined || entry.variantOf !== undefined) && (entry.name === undefined || entry.commons === true || entry.critical)) throw new Error('A tiered or variant output file is a named, non-critical product file');
  }
  const library = new Set(v.parse(ShardfileFieldSchemas.library, index.admission.library));
  if (!lateLibraryRootsValid(index.admission.late ?? [], refs, library)) throw new Error('Late output file must be a declared library root');
  // I5: a pack lives beside the blobs, is listed once, and holds only listed members at their exact sizes, in order
  const members = new Map([...index.sections, ...index.schemas].map(entry => [entry.hash, entry.bytes] as const));
  for (const entry of index.files) members.set(entry.hash, entry.compressed);
  for (const pack of index.packs ?? []) {
    if (pack.path !== `blobs/pack/${pack.hash}.pack` || paths.has(pack.path)) throw new Error('Duplicate or mismatched pack path');
    paths.add(pack.path);
    let end = 0;
    for (const entry of pack.entries) {
      if (entry.offset !== end || members.get(entry.hash) !== entry.bytes) throw new Error('Pack member outside its listed inventory');
      end = entry.offset + entry.bytes;
    }
    if (end !== pack.bytes) throw new Error('Pack size differs from its members');
  }
  for (const entry of index.runtime?.files ?? []) if (!/^runtime\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.ts$/u.test(entry.path)) throw new Error('Runtime output must be TypeScript inside runtime/');
  return index;
}
/** Validate both legacy envelopes and independently authored platform values. */
export function validateOutputSection(name:string,value:unknown):unknown{assertCellBounds(value,name);return isPlatformDataSection(name)?v.parse(OUTPUT_DATA_SECTIONS[name].schema,value):parseOutputSection(name,value);}
/** Check each platform section against the same defining field schemas as the monolith. */
export function parseOutputSection(name: string, input: unknown): Record<string, unknown> {
  assertCellBounds(input, name);
  const mapping = OUTPUT_SECTIONS.find(row => row.name === name);
  if (mapping === undefined) throw new Error('Unknown platform section');
  if (!isJsonData(input) || typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Section must contain JSON fields');
  const expected = mapping.row !== undefined ? ['rows'] : mapping.spawns === true ? ['runtime'] : mapping.fields;
  if (Object.keys(input).some(key => !expected.includes(key as keyof Shardfile))) throw new Error('Section contains an undeclared field');
  for (const field of mapping.fields) if (Object.hasOwn(input, field)) v.parse(ShardfileFieldSchemas[field], Reflect.get(input, field));
  if (mapping.row !== undefined) {
    const row = v.parse(v.strictObject({[mapping.row]: RowsSchema.pipe[2].entries[mapping.row]}), Reflect.get(input, 'rows'));
    return {rows:row};
  }
  if (mapping.spawns === true) return {runtime:v.parse(v.strictObject({spawns:RuntimeSpawnsSchema}),Reflect.get(input,'runtime'))};
  return Object.fromEntries(Object.entries(input));
}
/** Reconstruct checked host fields by default; exact build-hash readers may explicitly skip schemas. */
export function assembleOutputFields(index: OutputIndex, sections: ReadonlyMap<string, unknown>, checkSections = true): Record<string, unknown> {
  return assembleOutputTransport(index, sections, checkSections ? {
    bounds: (name, value) => assertCellBounds(value, name),
    platform: (name, value) => { v.parse(OUTPUT_DATA_SECTIONS[name].schema, value); },
    fields: parseOutputSection,
  } : undefined);
}
/** The default untrusted reader always checks sections and the full host schema. */
export function assembleOutputShardfile(input: unknown, sections: ReadonlyMap<string, unknown>): Shardfile {
  const source = parseShardfile(assembleOutputFields(parseOutputIndex(input), sections));
  const errors = clientOwnershipRules(source, sections); if (errors.length > 0) throw new Error(errors.join('; '));
  return source;
}


/** Exact admitted data, independent of validator implementation metadata. */
interface OutputIndexRowsInputFields {
    format: "wildshard.shardfile";
    formatVersion: 2;
    sdk: "0.2";
    version: "0.1";
    identity: ShardIdentityInput;
    build: {
        sourceHash: string;
        validator: string;
    };
    requires: ShardRequiresInput;
    ktx2Costs?: Record<string, Ktx2DeviceCosts>;
    admission: {
        budgets: unknown;
        serverBudget: unknown;
        authorCaps: unknown;
        critical: unknown;
        library: unknown;
        late?: AdmissionLate;
    };
    sections: {
        name: string;
        schema: string;
        path: string;
        hash: string;
        bytes: number;
    }[];
    schemas: {
        path: string;
        hash: string;
        bytes: number;
    }[];
    files: {
        path: string;
        kind: "audio" | "glb" | "ktx2" | "json" | "wasm" | "image" | "tile" | "bin";
        name?: string;
        tier?: 'phone' | 'desktop';
        variantOf?: string;
        commons?: true;
        jsonSchema?: Record<string, unknown>;
        critical: boolean;
        hash: string;
        compressed: number;
        decoded: number;
        gpu: number;
        triangles: number;
        draws: number;
        dependencies: ShardReferencesInput;
    }[];
    packs?: {
        path: string;
        hash: string;
        bytes: number;
        entries: {
            hash: string;
            offset: number;
            bytes: number;
        }[];
    }[];
    runtime: {
        trust: "first-party";
        files: {
            lines: number;
            path: string;
            hash: string;
            bytes: number;
        }[];
        lines: number;
        entry: string;
        cost?: {
            imagesFirst?: {
                webContentMB: number;
                glMB: number;
                engineBaseMB: number;
                residentBaseMB?: number;
                rev: string;
                device: string;
                evidence: string;
            } | undefined;
            webContentMB: number;
            glMB: number;
            engineBaseMB: number;
            residentBaseMB?: number;
            rev: string;
            device: string;
            evidence: string;
        } | undefined;
        binds?: ("state" | "movers" | "modes" | "terrain" | "quests" | "ledger" | "items" | "props" | "clientChannels" | "spawns" | "loot")[] | undefined;
    } | {
        trust: "first-party";
        files: {
            lines: number;
            path: string;
            hash: string;
            bytes: number;
        }[];
        lines: 0;
        kind: "client-plan";
        cost: {
            imagesFirst?: {
                webContentMB: number;
                glMB: number;
                engineBaseMB: number;
                residentBaseMB?: number;
                rev: string;
                device: string;
                evidence: string;
            } | undefined;
            webContentMB: number;
            glMB: number;
            engineBaseMB: number;
            residentBaseMB?: number;
            rev: string;
            device: string;
            evidence: string;
        };
        binds: ("state" | "movers" | "modes" | "terrain" | "quests" | "ledger" | "items" | "props" | "clientChannels" | "spawns" | "loot")[];
    } | null;
}
export type OutputIndexRowsInput = { [Key in keyof OutputIndexRowsInputFields]: OutputIndexRowsInputFields[Key] };
interface OutputIndexRowsFields {
    format: "wildshard.shardfile";
    formatVersion: 2;
    sdk: "0.2";
    version: "0.1";
    identity: ShardIdentity;
    build: {
        sourceHash: string;
        validator: string;
    };
    requires: ShardRequires;
    ktx2Costs?: Record<string, Ktx2DeviceCosts>;
    admission: {
        budgets: unknown;
        serverBudget: unknown;
        authorCaps: unknown;
        critical: unknown;
        library: unknown;
        late?: AdmissionLate;
    };
    sections: {
        name: string;
        schema: string;
        path: string;
        hash: string;
        bytes: number;
    }[];
    schemas: {
        path: string;
        hash: string;
        bytes: number;
    }[];
    files: {
        path: string;
        kind: "audio" | "glb" | "ktx2" | "json" | "wasm" | "image" | "tile" | "bin";
        name?: string;
        tier?: 'phone' | 'desktop';
        variantOf?: string;
        commons?: true;
        jsonSchema?: Record<string, unknown>;
        critical: boolean;
        hash: string;
        compressed: number;
        decoded: number;
        gpu: number;
        triangles: number;
        draws: number;
        dependencies: ShardReferences;
    }[];
    packs?: {
        path: string;
        hash: string;
        bytes: number;
        entries: {
            hash: string;
            offset: number;
            bytes: number;
        }[];
    }[];
    runtime: {
        trust: "first-party";
        files: {
            lines: number;
            path: string;
            hash: string;
            bytes: number;
        }[];
        lines: number;
        entry: string;
        cost?: {
            imagesFirst?: {
                webContentMB: number;
                glMB: number;
                engineBaseMB: number;
                residentBaseMB?: number;
                rev: string;
                device: string;
                evidence: string;
            } | undefined;
            webContentMB: number;
            glMB: number;
            engineBaseMB: number;
            residentBaseMB?: number;
            rev: string;
            device: string;
            evidence: string;
        } | undefined;
        binds?: ("state" | "movers" | "modes" | "terrain" | "quests" | "ledger" | "items" | "props" | "clientChannels" | "spawns" | "loot")[] | undefined;
    } | {
        trust: "first-party";
        files: {
            lines: number;
            path: string;
            hash: string;
            bytes: number;
        }[];
        lines: 0;
        kind: "client-plan";
        cost: {
            imagesFirst?: {
                webContentMB: number;
                glMB: number;
                engineBaseMB: number;
                residentBaseMB?: number;
                rev: string;
                device: string;
                evidence: string;
            } | undefined;
            webContentMB: number;
            glMB: number;
            engineBaseMB: number;
            residentBaseMB?: number;
            rev: string;
            device: string;
            evidence: string;
        };
        binds: ("state" | "movers" | "modes" | "terrain" | "quests" | "ledger" | "items" | "props" | "clientChannels" | "spawns" | "loot")[];
    } | null;
}
export type OutputIndexRows = { [Key in keyof OutputIndexRowsFields]: OutputIndexRowsFields[Key] };
