import { mergeProjectSections } from './projectSections';
import { writeNewProject } from './newProject';
import { assertConfigBoundary } from './configBoundary';
// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI verifies and writes local build products.
import { cpSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source assets inside the author project.
import { resolve, sep } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Encode a compiled config as a Node module URL.
import { Buffer } from 'node:buffer';
import { build } from 'vite';
import { parseShardfile, type Shardfile } from './shardfile';
import { preflightAssetGraph, offlineMemoryAdmission } from "@wildshard/format/product";
import { preflightDeclaredCosts } from '@wildshard/format/assetAdmission';
import { preflightShardfile } from '@wildshard/format/preflight';

import { readBoundedFile } from './sourceReader';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';

import { projectPerformancePolicy } from './performancePolicy';
import { checkProjectRuntime } from './runtimePerformance';
import { admitProduct, assertProductTargets } from './productOutput';
import { bakeAuthoredWorld } from './bake/authoredWorld';
import { parseWorldSource } from './worldSource';
import { compileBehaviourSource } from './behaviourSource';
import { buildBehaviourProject } from './buildBehaviour';
import { packProjectMap, type ProjectMap } from './projectMap';
import { projectPlaceholders } from './bake/placeholders';
import type { ScriptAdmissionRows } from '@wildshard/format/scriptContract';
import { outputScriptAdmissionRows, outputPlatformPayloads, clearOutputProduct, writeOutputProduct, type OutputProductOptions } from './outputProduct';
import { prepareProjectOutput, mergeProjectBlobs, projectMirrors, type PreparedProjectOutput } from './projectOutput';
import type { RuntimeMirror } from './runtimeMirrors';
import { proveRuntimeData, writeRuntimeFiles, type RuntimeCopyOptions } from './outputRuntime';
import { readManifestSource, type ProjectManifestSource } from './projectManifest';
import { projectDecisionOptions } from './projectDecisions';
import { projectDecisionBudget } from './projectPolicy';

/** Stable JSON encoding: sorted object keys, no timestamps or host paths. */
export function canonicalJson(value: unknown): string { return encodeCanonicalJson(value); }
/** Hash of immutable wire bytes; this is also their output filename. */
export function contentHash(bytes: Uint8Array): string { return hashImmutableBytes(bytes); }

/** Validate graph closure costs and actual bytes through the same admission used by the browser loader. */
export function validateProject(input: unknown, assets: ReadonlyMap<string, Uint8Array>, project?: string, scripts: ScriptAdmissionRows = []): Shardfile {
  const source = parseShardfile(input);
  return admitProduct(source, assets, projectPerformancePolicy(project, source), scripts);
}

async function authorModule(project: string, file: string): Promise<Record<string, unknown>> {
  // The compiled declaration executes here; only its returned data is emitted.
  // Source-text inspection still enters the recorder's exact-content guard.
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [{name:'wildshard-author-execution',api:{wildshardInputIdentity:'execution'}}], build: { write: false, minify: false, lib: { entry: resolve(project, file), formats: ['es'], fileName: 'config' }, rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built) || (Array.isArray(result) && result.length !== 1)) throw new Error('config build produced unexpected output');
  const chunks = built.output.filter((out) => out.type === 'chunk');
  if (chunks.length !== 1) throw new Error('config must bundle as one module');
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('config chunk missing');
  assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
  const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof loaded !== 'object' || loaded === null) throw new Error('Author module has no exports');
  return Object.fromEntries(Object.entries(loaded));
}

/** SF88g: one declared output of a source folder that emits several products (`outputs` in shard.config.ts, keyed by slug). */
function outputDeclaration(loaded: Record<string, unknown>, output: string): unknown {
  const outputs = loaded['outputs'];
  if (typeof outputs !== 'object' || outputs === null || !Object.hasOwn(outputs, output)) throw new Error(`config declares no output ${output}`);
  return Reflect.get(outputs, output);
}

async function projectModule(project: string, decisionLegacyLines?: number, selected?: string): Promise<{ shard: Shardfile; commons: unknown; baked: ReadonlyMap<string, Uint8Array>; output: PreparedProjectOutput; mirrors: readonly RuntimeMirror[] }> {
  const loaded = await authorModule(project, 'shard.config.ts');
  if (!('default' in loaded)) throw new Error('config has no default export');
  let declaration: unknown = selected === undefined ? loaded['default'] : outputDeclaration(loaded, selected);
  let shard: Shardfile;
  const baked = new Map<string, Uint8Array>(), root = realpathSync(project);
  const sourcePath = (path: string): string => {
    const resolved = realpathSync(resolve(root, path));
    if (!resolved.startsWith(`${root}${sep}`)) throw new Error('Authored source resolves outside the author project'); return resolved;
  };
  if ('behaviour' in loaded) {
    const compiled = await compileBehaviourSource(loaded['behaviour'], declaration, path => new TextDecoder('utf-8', { fatal: true }).decode(readBoundedFile(sourcePath(path), 1_000_000)));
    declaration = compiled.declaration;
    for (const [hash, bytes] of compiled.assets) baked.set(hash, bytes);
  }
  if (typeof declaration === 'object' && declaration !== null && 'world' in declaration) {
    const world = parseWorldSource(declaration.world);
    const product = await bakeAuthoredWorld(declaration, readBoundedFile(sourcePath(world.glb), 256_000_000));
    shard = product.shard;
    for (const [hash, bytes] of product.assets) baked.set(hash, bytes);
  } else shard = parseShardfile(declaration);
  checkProjectRuntime(project, projectPerformancePolicy(project, shard));
  const sidecar = existsSync(resolve(project, 'generators/output.ts')) ? await authorModule(project, 'generators/output.ts') : undefined;
  if (sidecar !== undefined && ('output' in loaded || !('output' in sidecar))) throw new Error('Output sidecar requires one unambiguous output export');
  shard = mergeProjectSections(shard, sidecar?.['sections']);
  const output = await prepareProjectOutput(project, sidecar === undefined ? loaded['output'] : sidecar['output'], { source: shard, options: projectDecisionOptions(loaded['buildOptions'], projectDecisionBudget(project, decisionLegacyLines)) });
  // The CLI-only sidecar may declare the runtime/const.ts mirrors too (a browser config cannot import data/ values).
  if (sidecar !== undefined && 'mirrors' in loaded && 'mirrors' in sidecar) throw new Error('Runtime mirrors declared by both the config and its output sidecar');
  const mirrors = projectMirrors('mirrors' in loaded ? loaded['mirrors'] : sidecar !== undefined && 'mirrors' in sidecar ? sidecar['mirrors'] : undefined);
  return { shard, commons: 'commons' in loaded ? loaded['commons'] : undefined, baked, output, mirrors };
}

/** Compile authored geometry and read its remaining immutable inputs without writing hashes into the author folder. */
export async function readProjectAssets(project: string, map?: ProjectMap, manifestSource?: ProjectManifestSource, options: { decisionLegacyLines?: number; output?: string } = {}): Promise<{ shard: Shardfile; assets: Map<string, Uint8Array>; output: Omit<OutputProductOptions, 'runtime'>; mirrors: readonly RuntimeMirror[] }> {
  const loaded = await projectModule(project, options.decisionLegacyLines, options.output), pinned = new Map(pinnedCommons(loaded.commons, loaded.shard, project));
  for (const [hash, bytes] of loaded.baked) pinned.set(hash, bytes);
  for (const [hash, bytes] of loaded.output.assets) {
    const previous = pinned.get(hash);
    if (previous !== undefined && contentHash(previous) !== contentHash(bytes)) throw new Error('Output asset conflicts with baked input');
    pinned.set(hash, bytes);
  }
  const level = manifestSource === undefined || manifestSource.file === undefined && loaded.shard.manifest === undefined ? undefined : await readManifestSource(manifestSource, loaded.shard.manifest);
  if (level !== undefined && loaded.shard.manifest !== undefined && canonicalJson(loaded.shard.manifest) !== canonicalJson(level.authored)) throw new Error('Authored manifest differs from configured level metadata');
  const source = level === undefined ? loaded.shard : parseShardfile({ ...loaded.shard, manifest: level.manifest });
  const packed = map === undefined ? undefined : packProjectMap(source, map);
  if (packed !== undefined && map !== undefined) pinned.set(packed.hash, map.bytes);
  const shard = packed?.shard ?? source;
  const merged = mergeProjectBlobs(shard, pinned, [...loaded.output.blobs, ...(level?.blobs ?? [])], loaded.output.options.namedFiles);
  return { shard: merged.shard, assets: projectAssets(project, merged.shard, 'project', merged.assets),
    output: { ...loaded.output.options, namedFiles: merged.namedFiles }, mirrors: loaded.mirrors };
}

function pinnedCommons(input: unknown, source: Shardfile, project: string): ReadonlyMap<string, Uint8Array> | undefined {
  if (input === undefined) return undefined;
  preflightDeclaredCosts(source, offlineMemoryAdmission(projectPerformancePolicy(project, source)));
  if (typeof input !== 'object' || input === null || !('catalogue' in input) || !('assets' in input)) throw new Error('Build-only commons export needs a compiled catalogue');
  const catalogue = input.catalogue;
  if (typeof catalogue !== 'object' || catalogue === null || !('format' in catalogue) || catalogue.format !== 'wildshard.commons' || !('version' in catalogue) || catalogue.version !== 0 || !(input.assets instanceof Map)) throw new Error('Unsupported build-only commons catalogue');
  const assets = new Map<string, Uint8Array>();
  for (const hash of source.requires.commons) {
    const bytes: unknown = input.assets.get(hash);
    if (!(bytes instanceof Uint8Array) || bytes.length !== source.requires.commonsWire[hash] || contentHash(bytes) !== hash) throw new Error('Pinned commons export misses or changes a required asset');
    assets.set(hash, bytes);
  }
  return assets;
}
/** Preflight and read bounded immutable files from an author project or flat built product. */
export function projectAssets(project: string, shard: Shardfile, layout: 'project' | 'product' = 'project', pinned?: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  preflightShardfile(shard); preflightAssetGraph(shard);
  preflightDeclaredCosts(shard, offlineMemoryAdmission(projectPerformancePolicy(project, shard)));
  assertProductTargets(shard, projectPerformancePolicy(project, shard));
  const read = (hash: string, size: number, folder: string): Uint8Array => {
    const bytes = pinned?.get(hash) ?? readBoundedFile(resolve(project, layout === 'project' ? folder : '.', hash), size);
    if (bytes.length !== size) throw new Error('Project asset differs from its declared wire size'); return bytes;
  };
  return new Map([...shard.files.map((f) => [f.hash, read(f.hash, f.compressed, 'assets')] as const), ...shard.requires.commons.map((h) => [`commons:${h}`, read(h, shard.requires.commonsWire[h] ?? 0, 'commons')] as const)]);
}
/**
 * Build a deterministic shard.json, immutable files and the distributed normal client when present; a shardfile with a
 * terrain gains its far / near placeholders when `placeholders` is set (the CLI's default).
 */
export async function buildProject(project: string, output?: string, options: { decisionLegacyLines?: number; output?: string; outputFormat?: 2; manifest?: ProjectManifestSource; copyRuntime?: boolean; runtimeCheck?: RuntimeCopyOptions['check']; devserver?: boolean; client?: string | null; map?: ProjectMap; placeholders?: boolean; admit?: (shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, policy: 'warn' | 'refuse', sections: ReadonlyMap<string, unknown>) => Promise<void> } = {}): Promise<Shardfile> {
  await buildBehaviourProject(project);
  const loaded = await readProjectAssets(project, options.map, options.manifest, options), assets = loaded.assets;
  // G348: a shardfile with a terrain gets its far and near placeholders from its own terrain, tiles and look (`wildshard
  // build` asks for them; the first-party product builds keep theirs in the repo bake until the grid reads `near`)
  // a static import: the author CLI must bundle to one module (scripts/wildshard.mjs); the bakers' closure stays
  // renderer-free (the Node sim proofs import this module under the renderer-denying loader)
  const shard = validateProject(options.placeholders === true ? await projectPlaceholders(loaded.shard, assets) : loaded.shard, assets, project, outputScriptAdmissionRows(loaded.output.platform));
  // The decision rows travel with the moves they bind, so a headless admission resolves the same registries as the build.
  await options.admit?.(shard, assets, projectPerformancePolicy(project, shard), outputPlatformPayloads(loaded.output.platform));
  const destination = output ?? resolve(project, 'public/shardfiles', shard.identity.slug);
  const clientPlan = shard.runtime !== null && !('entry' in shard.runtime);
  if (options.copyRuntime === true || clientPlan) {
    const root = realpathSync(project), target = resolve(destination);
    if (target === root || target.startsWith(`${root}${sep}`) || root.startsWith(`${target}${sep}`)) throw new Error('Runtime output must be separate from its author project');
  }
  clearOutputProduct(destination);
  let descriptor: ReturnType<typeof writeOutputProduct>;
  try {
    const runtime = options.copyRuntime === true || clientPlan ? writeRuntimeFiles(project, destination, { check: options.runtimeCheck ?? (() => []), clientPlan }) : undefined;
    if (runtime !== undefined && (shard.runtime === null || !('entry' in shard.runtime)) !== (runtime.entry === undefined)) throw new Error('Copied runtime and trusted runtime declaration must agree');
    descriptor = writeOutputProduct(shard, assets, destination, { ...loaded.output, ...(runtime === undefined ? {} : { runtime }) });
    if (runtime !== undefined) await proveRuntimeData(destination, descriptor, loaded.mirrors);
  } catch (error) { clearOutputProduct(destination); throw error; }
  const directory = import.meta.dirname;
  const clientFolder = options.devserver === true ? 'client-devserver' : 'client';
  const client = options.client === null ? undefined : options.client ?? [resolve(directory, clientFolder), resolve(directory, 'dist', clientFolder)].find((path) => existsSync(resolve(path, 'index.html')));
  if (client !== undefined) {
    cpSync(client, destination, { recursive: true });
    const json = canonicalJson(descriptor).replaceAll('<', String.raw`\u003c`);
    const html = readFileSync(resolve(destination, 'index.html'), 'utf8').replace('</head>', `<script id="ws-shardfile" type="application/json">${json}</script></head>`);
    writeFileSync(resolve(destination, 'index.html'), html);
  }
  return shard;
}
/** Create the runtime-free source layout without replacing existing work. */
export function newProject(project: string, slug: string): void { writeNewProject(project, slug); }
