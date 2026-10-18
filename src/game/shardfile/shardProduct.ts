import * as v from 'valibot';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { CustomSectionName, PlatformSectionName, PlatformSections, SectionName } from '@wildshard/format/sections';
import { validateCustomSchema } from './customSchema';

/**
 * The runtime data API (SHARD-PLATFORM P2a, spec progress/shard-platform/p2a-runtime-data-api/README.md): what a shard's
 * standalone `runtime/` reads from its built output instead of importing source `data/` (G448, G449).
 *
 * The loader builds one product per admitted shard and hands it to the plugin as `ctx.product` (and to a headless entry
 * as `product`). Every `boot` and `enter` section is fetched, hash-checked and decoded before the first hook runs, so
 * `section()` and `strings()` are synchronous lookups. The loader checks every custom section's emitted schema
 * before hooks run (G491); explicit registry reads also parse, and `check: true` deep-freezes values. Blobs are
 * read by logical name, asynchronously, through the shard's verified asset reader.
 */
export interface ShardProduct {
  readonly slug: string;
  readonly revision: number;
  /**
   * Today's in-memory shardfile, assembled by the loader from the sections: hand it to hosts that take a `Shardfile`
   * (`prepareClientWorld`, `bindQuestPageInteractions`, `prepareRuntimePlan` …). Runtime code reads data with `section()`.
   */
  readonly shardfile: Shardfile;
  /** Does the index list this section? Use it for a section a shard may leave out; `section()` refuses a missing one. */
  readonly has: (name: SectionName) => boolean;
  /** A section's value: platform sections typed by `@wildshard/format/sections`, custom ones by the runtime's registry. */
  readonly section: SectionReader;
  /** The named strings from `ui/strings`, all at once; refuses listing every missing key. */
  readonly strings: <const K extends string>(keys: readonly K[]) => ProductStrings<K>;
  /** Does the index name this blob (`models/roc.glb`, `behaviour/director.wasm`)? */
  readonly hasFile: (name: string) => boolean;
  /** A blob's verified bytes by logical name (cached by the shard's asset reader). */
  readonly file: (name: string) => Promise<Uint8Array>;
  /** Build-validated named JSON, typed by a generated declaration and decoded from verified bytes. */
  readonly json: <T>(name: string) => Promise<T>;
  /** A blob's content-addressed URL by logical name, for loaders that only take a URL. Prefer `file()`. */
  readonly url: (name: string) => string;
}

/** `ShardProduct.section`. Values are shared between readers: treat them as read-only. */
export interface SectionReader {
  /** Build-validated custom data, typed by a generated declaration; no runtime schema is imported. */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- The caller supplies its generated type because build validation erases the runtime schema argument.
  <T>(name: CustomSectionName): T;
  /** A platform section's value, typed by `@wildshard/format/sections`. */
  <K extends PlatformSectionName>(name: K): PlatformSections[K];
  /**
   * A custom section's value, typed by the runtime's own schema registry (`runtime/sections.ts` `SECTIONS`). The build
   * parses the emitted JSON with that same registry entry, so the type is proven at build and trusted here.
   */
  <R extends CustomSectionSchemas, K extends keyof R & CustomSectionName>(name: K, schemas: R): v.InferOutput<R[K]>;
}

/** A runtime's custom section schemas, keyed by section name (`runtime/sections.ts`: `export const SECTIONS = {…}`). */
export type CustomSectionSchemas = Readonly<Record<CustomSectionName, v.GenericSchema>>;
/** The strings a runtime asked for, by key. */
export type ProductStrings<K extends string> = Readonly<Record<K, string>>;

/** Why a product read refused. Every refusal is a build or wiring error, so callers let it fail the load. */
export type ProductRefusal = 'absent' | 'missing-section' | 'stream-section' | 'missing-strings' | 'missing-file' | 'schema';

/** A refused product read: the shard, the section, strings or file asked for, and why. */
export class ProductError extends Error {
  readonly slug: string;
  readonly item: string;
  readonly reason: ProductRefusal;
  constructor(slug: string, item: string, reason: ProductRefusal, detail: string) {
    super(`${slug}: ${detail}`);
    this.name = 'ProductError'; this.slug = slug; this.item = item; this.reason = reason;
  }
}

/** One named blob: its content hash (what the reader verifies) and its content-addressed URL. */
export interface ProductFile { readonly hash: string; readonly url: string; readonly jsonSchema?: Readonly<Record<string, unknown>> }
/** What the loader (browser or Node) gives `createShardProduct`. */
export interface ShardProductInput {
  readonly slug: string;
  readonly revision: number;
  readonly shardfile: Shardfile;
  /** every section the loader fetched, hash-checked and decoded, by name (`OutputDescriptor.sections`) */
  readonly sections: ReadonlyMap<string, unknown>;
  /** sections the index lists that the loader left to their host to stream (not decoded here) */
  readonly streamed?: ReadonlySet<string>;
  /** every blob the index names, by logical name */
  readonly files: ReadonlyMap<string, ProductFile>;
  /** the verified reader: bytes for a hash, checked against it (`ClientAssets.read`, or a Node file read) */
  readonly read: (hash: string) => Promise<Uint8Array>;
  /** parse custom sections on read and deep-freeze values (tests and validation; never a shipped page) */
  readonly check?: boolean;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Build the product the loader passes to a runtime. Pure: it fetches nothing and decodes nothing itself. */
export function createShardProduct(input: ShardProductInput): ShardProduct {
  const { slug, sections, files, check = false } = input, streamed = input.streamed ?? new Set<string>();
  const parsed = new Map<string, unknown>();
  const value = (name: string): unknown => {
    if (streamed.has(name)) throw new ProductError(slug, name, 'stream-section', `section ${name} streams; read it through its host`);
    if (!sections.has(name)) throw new ProductError(slug, name, 'missing-section', `the built shard has no section ${name}`);
    const entry = sections.get(name);
    return check ? deepFreeze(entry) : entry;
  };
  const named = (name: string): ProductFile => {
    const file = files.get(name);
    if (file === undefined) throw new ProductError(slug, name, 'missing-file', `the built shard names no file ${name}`);
    return file;
  };
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Match the explicit generated-type overload without a runtime schema argument.
  function section<T>(name: CustomSectionName): T;
  function section<K extends PlatformSectionName>(name: K): PlatformSections[K];
  function section<R extends CustomSectionSchemas, K extends keyof R & CustomSectionName>(name: K, schemas: R): v.InferOutput<R[K]>;
  function section(name: string, schemas?: CustomSectionSchemas): unknown {
    if (schemas === undefined) return value(name);
    const done = parsed.get(name);
    if (done !== undefined) return done;
    const schema = schemas[name as CustomSectionName];
    if (schema === undefined) throw new ProductError(slug, name, 'schema', `runtime/sections.ts declares no schema for ${name}`);
    const result = v.safeParse(schema, value(name));
    if (!result.success) throw new ProductError(slug, name, 'schema', `section ${name} refuses its runtime schema: ${v.summarize(result.issues)}`);
    parsed.set(name, deepFreeze(result.output));
    return result.output;
  }
  function json<T>(name: string): Promise<T>;
  async function json(name: string): Promise<unknown> {
    const file = named(name);
    const decoded: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await input.read(file.hash)));
    if (file.jsonSchema !== undefined) validateCustomSchema(file.jsonSchema, decoded);
    return input.check === true ? deepFreeze(decoded) : decoded;
  }
  return {
    slug, revision: input.revision, shardfile: input.shardfile, section, json,
    has: name => sections.has(name) || streamed.has(name),
    strings: <const K extends string>(keys: readonly K[]): ProductStrings<K> => {
      if (keys.length === 0) return Object.freeze({}) as ProductStrings<K>;
      const table: Readonly<Record<string, string>> = sections.has('ui/strings') ? section('ui/strings') : {};
      const missing = keys.filter(key => table[key] === undefined);
      if (missing.length > 0) throw new ProductError(slug, missing.join(','), 'missing-strings', `ui/strings has no ${missing.join(', ')}`);
      return Object.freeze(Object.fromEntries(keys.map(key => [key, table[key] ?? '']))) as ProductStrings<K>;
    },
    hasFile: name => files.has(name),
    file: name => {
      try { return input.read(named(name).hash); } catch (error) { return Promise.reject(error instanceof Error ? error : new Error(String(error))); }
    },
    url: name => named(name).url,
  };
}

/**
 * The product of a shard with no built output (a frozen `-legacy` entry, or a session that has not loaded one): every
 * read refuses with `absent`, so a runtime that needs data fails its load with the slug and the fix.
 */
export function absentShardProduct(slug: string): ShardProduct {
  const absent = (item: string): never => {
    throw new ProductError(slug, item, 'absent', `no built shard was loaded for this entry (run \`wildshard build ${slug}\`)`);
  };
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- An absent product retains the same generated-type overload and always refuses.
  function section<T>(name: CustomSectionName): T;
  function section<K extends PlatformSectionName>(name: K): PlatformSections[K];
  function section<R extends CustomSectionSchemas, K extends keyof R & CustomSectionName>(name: K, schemas: R): v.InferOutput<R[K]>;
  function section(name: string): never { return absent(name); }
  return {
    slug, revision: 0, get shardfile(): Shardfile { return absent('shardfile'); }, section,
    has: () => false, hasFile: () => false,
    strings: keys => absent(keys.join(',')),
    file: name => Promise.reject(new ProductError(slug, name, 'absent', `no built shard was loaded for this entry (run \`wildshard build ${slug}\`)`)),
    json: name => Promise.reject(new ProductError(slug, name, 'absent', `no built shard was loaded for this entry (run \`wildshard build ${slug}\`)`)),
    url: name => absent(name),
  };
}
