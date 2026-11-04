// oxlint-disable-next-line import/no-nodejs-modules -- The author build owns the generated runtime copy.
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Runtime inventory paths are local project-relative paths.
import { dirname, relative, resolve, sep } from 'node:path';
import { parseSync } from 'vite';
import * as v from 'valibot';
import { hashImmutableBytes } from './immutable';
import { readBoundedFile } from './sourceReader';
import { runtimeMirrorIssues, type RuntimeMirror } from './runtimeMirrors';
import type { OutputIndex } from '@wildshard/format/outputIndex';
import { validateDefinedSection } from './sections';

export interface RuntimeCopyFile { readonly path: string; readonly hash: string; readonly bytes: number; readonly lines: number }
export interface RuntimeCopy { readonly files: readonly RuntimeCopyFile[]; readonly lines: number }

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

/** Build step 5: check the emitted custom sections against their built schemas and the declared mirrors, from the
 * emitted inventory only, never the author folder. A client-plan product ships no runtime TypeScript (LD9), so no
 * copied module is compiled or evaluated. */
export function proveRuntimeData(destination: string, index: OutputIndex, mirrors: readonly RuntimeMirror[]): void {
  // a client-plan output lists no copied TypeScript (the index schema caps it at none); this proof never accepts one
  if (index.runtime !== null && index.runtime.files.length > 0) throw new Error('Runtime proof requires a client-plan output with no copied TypeScript');
  const read = (file: { readonly path: string; readonly hash: string; readonly bytes: number }): Uint8Array => {
    const bytes = readBoundedFile(resolve(destination, file.path), file.bytes);
    if (bytes.length !== file.bytes || hashImmutableBytes(bytes) !== file.hash) throw new Error(`Runtime proof input changed: ${file.path}`);
    return bytes;
  };
  const sections = new Map<string, unknown>();
  for (const file of index.sections.filter(row => row.name.startsWith('custom/'))) {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(file)));
    sections.set(file.name, value);
  }
  const builtSchemas = new Map<string, Uint8Array>();
  for (const section of index.sections.filter(row => row.name.startsWith('custom/'))) {
    const schema = index.schemas.find(row => row.path === section.schema);
    if (schema === undefined) throw new Error(`Missing built schema: ${section.name}`);
    builtSchemas.set(section.name, read(schema));
  }
  validateRuntimeData(sections, undefined, mirrors, undefined, builtSchemas);
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

/** A client-plan product ships no runtime TypeScript (LD9 retired the copied-runtime entry): runtime/ may hold only
 * declaration files (`.d.ts`), never executable source, and the owned destination/runtime directory is cleared so no
 * earlier copy can linger. Symlinks and non-TypeScript files are refused before anything is deleted. */
export function writeRuntimeFiles(project: string, destination: string): RuntimeCopy {
  const root = realpathSync(project), target = resolve(destination);
  if (target === root || target.startsWith(`${root}${sep}`) || root.startsWith(`${target}${sep}`)) throw new Error('Runtime output must be separate from its author project');
  const runtime = resolve(root, 'runtime'), output = resolve(target, 'runtime');
  const walk = (folder: string): void => {
    if (lstatSync(folder).isSymbolicLink()) throw new Error('Runtime cannot contain symlinks');
    for (const item of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = resolve(folder, item.name), path = relative(root, file).split(sep).join('/');
      if (item.isSymbolicLink()) throw new Error(`Runtime cannot contain symlinks: ${path}`);
      if (item.isDirectory()) { walk(file); continue; }
      if (!item.isFile() || !/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.ts$/u.test(path)) throw new Error(`Runtime accepts TypeScript files only: ${path}`);
      if (!path.endsWith('.d.ts')) throw new Error(`Client-plan runtime cannot contain executable source: ${path}`);
    }
  };
  if (existsSync(runtime)) walk(runtime);
  // Reject symlinked output ancestors before deleting anything.
  for (let folder = output; ; folder = dirname(folder)) {
    if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw new Error('Runtime output cannot contain symlinks');
    if (folder === dirname(folder)) break;
  }
  if (existsSync(output)) rmSync(output, { recursive: true });
  return { files: [], lines: 0 };
}
