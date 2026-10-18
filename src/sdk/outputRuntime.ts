// oxlint-disable-next-line import/no-nodejs-modules -- The author build owns the generated runtime copy.
import { existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Runtime inventory paths are local project-relative paths.
import { dirname, relative, resolve, sep } from 'node:path';
import { build, parseSync } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- Build-only schema evaluation never ships executable output.
import { Buffer } from 'node:buffer';
import * as v from 'valibot';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { hashImmutableBytes } from './immutable';
import { readBoundedFile } from './sourceReader';
import { runtimeMirrorIssues, type RuntimeMirror } from './runtimeMirrors';
import type { OutputIndex } from '@wildshard/format/outputIndex';
import { validateDefinedSection } from './sections';

export interface RuntimeCopyFile { readonly path: string; readonly hash: string; readonly bytes: number; readonly lines: number }
export interface RuntimeCopy { readonly files: readonly RuntimeCopyFile[]; readonly lines: number; readonly entry?: 'runtime/index.ts' }
/** The build orchestration supplies its boundary checker and migration policy. The
 * published SDK never imports a checkout's lint scripts or baseline. Paths passed
 * to check are relative to the author project, including the runtime/ prefix. */
export interface RuntimeCopyOptions {
  readonly check: (path: string, source: string) => readonly { readonly message: string }[];
}

function syncSchema(input: unknown): input is v.GenericSchema {
  return typeof input === 'object' && input !== null && 'kind' in input && input.kind === 'schema'
    && 'type' in input && typeof input.type === 'string' && 'reference' in input && typeof input.reference === 'function'
    && 'expects' in input && typeof input.expects === 'string' && 'async' in input && input.async === false
    && '~run' in input && typeof input['~run'] === 'function';
}

/** Build step 5 checks the copied module namespaces, never source-side substitutes.
 * Orchestration imports these TS modules only after the boundary check. Every
 * custom section must have its matching runtime schema; every declared schema
 * must have emitted data. Mirrors reuse the defining canonical comparer. */
export function validateRuntimeData(sections: ReadonlyMap<string, unknown>,
  copiedSections: Readonly<Record<string, unknown>> | undefined,
  mirrors: readonly RuntimeMirror[], copiedConstants: Readonly<Record<string, unknown>> | undefined,
  builtSchemas?: ReadonlyMap<string, Uint8Array>): void {
  const custom = [...sections.keys()].filter(name => name.startsWith('custom/'));
  const registry = copiedSections?.['SECTIONS'];
  if (copiedSections === undefined && builtSchemas !== undefined) {
    for (const name of custom) {
      const schema = builtSchemas.get(name);
      if (schema === undefined) throw new Error(`Custom section has no built schema: ${name}`);
      validateDefinedSection(schema, sections.get(name));
    }
    validateRuntimeData(new Map(), undefined, mirrors, copiedConstants);
    return;
  }
  if (custom.length > 0 && (typeof registry !== 'object' || registry === null || Array.isArray(registry))) throw new Error('Custom sections require runtime/sections.ts SECTIONS');
  const entries = typeof registry === 'object' && registry !== null && !Array.isArray(registry) ? Object.entries(registry) : [];
  for (const [name, schema] of entries) {
    if (!name.startsWith('custom/') || !sections.has(name)) throw new Error(`Runtime schema has no emitted custom section: ${name}`);
    if (!syncSchema(schema)) throw new Error(`Runtime section needs a synchronous Valibot schema: ${name}`);
    v.parse(schema, sections.get(name));
  }
  for (const name of custom) if (!entries.some(([key]) => key === name)) throw new Error(`Custom section has no runtime schema: ${name}`);
  if (mirrors.length > 0 && copiedConstants === undefined) throw new Error('Declared mirrors require runtime/const.ts');
  const issues = runtimeMirrorIssues(mirrors, copiedConstants ?? {});
  if (issues.length > 0) throw new Error(issues.join('\n'));
}

/** Execute only copied schema/constant modules as a Node build proof. The temporary
 * compilation stays in memory; runtime/index.ts is never evaluated or bundled for
 * delivery. All inputs come from the emitted inventory, never the author folder. */
export async function proveRuntimeData(destination: string, index: OutputIndex, mirrors: readonly RuntimeMirror[]): Promise<void> {
  const read = (file: { readonly path: string; readonly hash: string; readonly bytes: number }): Uint8Array => {
    const bytes = readBoundedFile(resolve(destination, file.path), file.bytes);
    if (bytes.length !== file.bytes || hashImmutableBytes(bytes) !== file.hash) throw new Error(`Runtime proof input changed: ${file.path}`);
    return bytes;
  };
  for (const file of index.runtime?.files ?? []) read(file);
  const sections = new Map<string, unknown>();
  for (const file of index.sections.filter(row => row.name.startsWith('custom/'))) {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(file)));
    sections.set(file.name, value);
  }
  const namespace = async (path: string): Promise<Readonly<Record<string, unknown>> | undefined> => {
    if (!index.runtime?.files.some(file => file.path === path)) return undefined;
    const result = await build({ configFile: false, publicDir: false, logLevel: 'silent',
      build: { write: false, minify: false, lib: { entry: resolve(destination, path), formats: ['es'], fileName: 'runtime-proof' },
        rolldownOptions: { platform: 'node', external: [/^node:/u] } } });
    const output = Array.isArray(result) ? result[0] : result;
    if (output === undefined || !('output' in output) || Array.isArray(result) && result.length !== 1) throw new Error('Runtime proof produced unexpected output');
    const chunks = output.output.filter(chunk => chunk.type === 'chunk');
    const chunk = chunks[0];
    if (chunks.length !== 1 || chunk === undefined) throw new Error('Runtime proof must compile to one build-only module');
    const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
    if (typeof loaded !== 'object' || loaded === null) throw new Error('Runtime proof module has no namespace');
    return loaded as Readonly<Record<string, unknown>>;
  };
  const builtSchemas = new Map<string, Uint8Array>();
  for (const section of index.sections.filter(row => row.name.startsWith('custom/'))) {
    const schema = index.schemas.find(row => row.path === section.schema);
    if (schema === undefined) throw new Error(`Missing built schema: ${section.name}`);
    builtSchemas.set(section.name, read(schema));
  }
  validateRuntimeData(sections, await namespace('runtime/sections.ts'), mirrors, await namespace('runtime/const.ts'), builtSchemas);
}

/** Parser comment ranges preserve strings, regexes and template literal text.
 * Only nonblank lines after comment removal count; byte output is never edited. */
export function runtimeCodeLines(source: string, path = 'runtime/index.ts'): number {
  const parsed = parseSync(path, source);
  if (parsed.errors.length > 0) throw new Error(`Invalid runtime TypeScript: ${path}`);
  const chunks: string[] = []; let cursor = 0;
  for (const { start, end } of parsed.comments) {
    chunks.push(source.slice(cursor, start), source.slice(start, end).replaceAll(/[^\n]/gu, ' ')); cursor = end;
  }
  chunks.push(source.slice(cursor));
  return chunks.join('').split('\n').filter(line => line.trim()).length;
}

/** Copy only TypeScript under runtime/ verbatim, without following an import closure. Check
 * every source before replacing the owned destination/runtime directory. Missing
 * runtime is data-only; a nonempty runtime requires its declared index.ts entry. */
export function writeRuntimeFiles(project: string, destination: string, options: RuntimeCopyOptions): RuntimeCopy {
  const root = realpathSync(project), target = resolve(destination);
  if (target === root || target.startsWith(`${root}${sep}`) || root.startsWith(`${target}${sep}`)) throw new Error('Runtime output must be separate from its author project');
  const runtime = resolve(root, 'runtime'), output = resolve(target, 'runtime');
  const pending: { row: RuntimeCopyFile; bytes: Uint8Array }[] = [];
  const walk = (folder: string): void => {
    if (lstatSync(folder).isSymbolicLink()) throw new Error('Runtime cannot contain symlinks');
    for (const item of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = resolve(folder, item.name), path = relative(root, file).split(sep).join('/');
      if (item.isSymbolicLink()) throw new Error(`Runtime cannot contain symlinks: ${path}`);
      if (item.isDirectory()) { walk(file); continue; }
      if (!item.isFile() || !/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.ts$/u.test(path)) throw new Error(`Runtime accepts TypeScript files only: ${path}`);
      const bytes = readBoundedFile(file, limits.sourceBytes), source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const issues = options.check(path, source);
      if (issues.length > 0) throw new Error(issues.map(issue => `${path}: ${issue.message}`).join('\n'));
      pending.push({ row: { path, hash: hashImmutableBytes(bytes), bytes: bytes.length, lines: runtimeCodeLines(source, path) }, bytes });
    }
  };
  if (existsSync(runtime)) walk(runtime);
  if (pending.length > 0 && !pending.some(file => file.row.path === 'runtime/index.ts')) throw new Error('Runtime requires runtime/index.ts');
  // Reject symlinked output ancestors before deleting or writing anything. An
  // existing generated runtime is replaced so removed source files cannot linger.
  for (let folder = output; ; folder = dirname(folder)) {
    if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw new Error('Runtime output cannot contain symlinks');
    if (folder === dirname(folder)) break;
  }
  if (existsSync(output)) rmSync(output, { recursive: true });
  for (const file of pending) { const path = resolve(target, file.row.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, file.bytes); }
  const files = pending.map(file => file.row).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { files, lines: files.reduce((total, file) => total + file.lines, 0), ...(files.length === 0 ? {} : { entry: 'runtime/index.ts' as const }) };
}
