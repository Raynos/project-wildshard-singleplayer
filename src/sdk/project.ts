// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI verifies and writes local build products.
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source assets inside the author project.
import { resolve, sep } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Encode a compiled config as a Node module URL.
import { Buffer } from 'node:buffer';
import { build } from 'vite';
import { parseShardfile, type Shardfile } from './shardfile';
import { validationRevision, validationSourceBytes } from '@wildshard/game/shardfile/validationReceipt';
import { preflightDeclaredCosts, validateShardfileAssets } from '@wildshard/game/shardfile/validate';
import { preflightShardfile } from '@wildshard/game/shardfile/preflight';
import { preflightAssetGraph } from '@wildshard/game/shardfile/assetGraph';
import { readBoundedFile } from './sourceReader';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { MemoryAdmission } from '@wildshard/game/grid/memoryAdmission';
import { projectPerformancePolicy } from './performancePolicy';
import { checkProjectRuntime } from './runtimePerformance';
import { performanceReport, performanceReportLines, performanceTargetIssues } from './reportCard';
import { bakeAuthoredWorld } from './bake/authoredWorld';
import { parseWorldSource } from './worldSource';
import { compileBehaviourSource } from './behaviourSource';

/** Stable JSON encoding: sorted object keys, no timestamps or host paths. */
export function canonicalJson(value: unknown): string { return encodeCanonicalJson(value); }
/** Hash of immutable wire bytes; this is also their output filename. */
export function contentHash(bytes: Uint8Array): string { return hashImmutableBytes(bytes); }

/** Validate graph closure costs and actual bytes through the same admission used by the browser loader. */
export function validateProject(input: unknown, assets: ReadonlyMap<string, Uint8Array>, project?: string): Shardfile {
  const source = parseShardfile(input), policy = projectPerformancePolicy(project, source);
  preflightDeclaredCosts(source, offlineMemory(policy));
  enforceTargets(source, policy);
  return validateShardfileAssets(source, assets, contentHash, offlineMemory(policy));
}
function offlineMemory(policy: 'warn' | 'refuse'): MemoryAdmission | undefined { return policy === 'warn' ? new MemoryAdmission(() => true) : undefined; }
function enforceTargets(source: Shardfile, policy: 'warn' | 'refuse'): void {
  if (!performanceTargetIssues(source, policy).some(issue => issue.severity === 'refusal')) return;
  const unmeasured = { scripts: { p95Micros: 0, maxMicros: 0, samples: 0 }, fuel: { p95: 0, max: 0, samples: 0 } };
  throw new Error(performanceReportLines(performanceReport(source, unmeasured, policy)).join('\n'));
}

async function projectModule(project: string): Promise<{ shard: Shardfile; commons: unknown; baked?: ReadonlyMap<string, Uint8Array> }> {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: resolve(project, 'shard.config.ts'), formats: ['es'], fileName: 'config' }, rolldownOptions: { external: [/^node:/u] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built) || (Array.isArray(result) && result.length !== 1)) throw new Error('config build produced unexpected output');
  const chunks = built.output.filter((out) => out.type === 'chunk');
  if (chunks.length !== 1) throw new Error('config must bundle as one module');
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('config chunk missing');
  const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof loaded !== 'object' || loaded === null || !('default' in loaded)) throw new Error('config has no default export');
  let declaration: unknown = loaded.default;
  let shard: Shardfile;
  const baked = new Map<string, Uint8Array>(), root = realpathSync(project);
  const sourcePath = (path: string): string => {
    const resolved = realpathSync(resolve(root, path));
    if (!resolved.startsWith(`${root}${sep}`)) throw new Error('Authored source resolves outside the author project'); return resolved;
  };
  if ('behaviour' in loaded) {
    const compiled = await compileBehaviourSource(loaded.behaviour, declaration, path => new TextDecoder('utf-8', { fatal: true }).decode(readBoundedFile(sourcePath(path), 1_000_000)));
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
  return { shard, commons: 'commons' in loaded ? loaded.commons : undefined, baked };
}
/** Compile a trusted local TypeScript config; only its serialisable default export enters the product. */
export async function readProject(project: string): Promise<Shardfile> { return (await projectModule(project)).shard; }

/** Compile authored geometry and read its remaining immutable inputs without writing hashes into the author folder. */
export async function readProjectAssets(project: string): Promise<{ shard: Shardfile; assets: Map<string, Uint8Array> }> {
  const loaded = await projectModule(project), pinned = new Map(pinnedCommons(loaded.commons, loaded.shard, project));
  for (const [hash, bytes] of loaded.baked ?? []) pinned.set(hash, bytes);
  return { shard: loaded.shard, assets: projectAssets(project, loaded.shard, 'project', pinned) };
}

function pinnedCommons(input: unknown, source: Shardfile, project: string): ReadonlyMap<string, Uint8Array> | undefined {
  if (input === undefined) return undefined;
  preflightDeclaredCosts(source, offlineMemory(projectPerformancePolicy(project, source)));
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
  preflightDeclaredCosts(shard, offlineMemory(projectPerformancePolicy(project, shard)));
  enforceTargets(shard, projectPerformancePolicy(project, shard));
  const read = (hash: string, size: number, folder: string): Uint8Array => {
    const bytes = pinned?.get(hash) ?? readBoundedFile(resolve(project, layout === 'project' ? folder : '.', hash), size);
    if (bytes.length !== size) throw new Error('Project asset differs from its declared wire size'); return bytes;
  };
  return new Map([...shard.files.map((f) => [f.hash, read(f.hash, f.compressed, 'assets')] as const), ...shard.requires.commons.map((h) => [`commons:${h}`, read(h, shard.requires.commonsWire[h] ?? 0, 'commons')] as const)]);
}
/** Build a deterministic shard.json, immutable files and the distributed normal client when present. */
export async function buildProject(project: string, output?: string, options: { devserver?: boolean; client?: string | null; admit?: (shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, policy: 'warn' | 'refuse') => Promise<void> } = {}): Promise<Shardfile> {
  const loaded = await readProjectAssets(project), assets = loaded.assets, shard = validateProject(loaded.shard, assets, project);
  await options.admit?.(shard, assets, projectPerformancePolicy(project, shard));
  const destination = output ?? resolve(project, 'public/shardfiles', shard.identity.slug);
  shard.files.sort((a, b) => a.hash.localeCompare(b.hash)); shard.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  mkdirSync(destination, { recursive: true });
  const emitted = new Set<string>();
  for (const [ref, bytes] of assets) {
    const hash = ref.replace('commons:', ''); if (emitted.has(hash)) continue;
    writeFileSync(resolve(destination, hash), bytes); emitted.add(hash);
  }
  writeFileSync(resolve(destination, 'shard.json'), canonicalJson(shard));
  // Informational for arbitrary SDK products; the first-party client pins its own build's receipts.
  writeFileSync(resolve(destination, 'validation.json'), canonicalJson({ revision: validationRevision(), sourceHash: contentHash(validationSourceBytes(shard)), worst: preflightDeclaredCosts(shard, offlineMemory(projectPerformancePolicy(project, shard))).worst }));
  const directory = import.meta.dirname;
  const clientFolder = options.devserver === true ? 'client-devserver' : 'client';
  const client = options.client === null ? undefined : options.client ?? [resolve(directory, clientFolder), resolve(directory, 'dist', clientFolder)].find((path) => existsSync(resolve(path, 'index.html')));
  if (client !== undefined) {
    cpSync(client, destination, { recursive: true });
    const json = canonicalJson(shard).replaceAll('<', String.raw`\u003c`);
    const html = readFileSync(resolve(destination, 'index.html'), 'utf8').replace('</head>', `<script id="ws-shardfile" type="application/json">${json}</script></head>`);
    writeFileSync(resolve(destination, 'index.html'), html);
  }
  return shard;
}
/** Create the canonical SDK project layout without replacing existing work. */
export function newProject(project: string, slug: string): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(slug) || existsSync(project)) throw new Error('new requires a fresh directory and kebab-case slug');
  for (const folder of ['generators', 'data', 'behaviour', 'quests', 'assets']) mkdirSync(resolve(project, folder), { recursive: true });
  writeFileSync(resolve(project, 'shard.config.ts'), `import { emptyShardfile } from '@wildshard/sdk/author';\nexport default emptyShardfile(${canonicalJson({ slug, name: slug, author: 'Local author', revision: 1, seed: 1 }).trim()});\n`);
  writeFileSync(resolve(project, 'README.md'), `# ${slug}

Performance first: run wildshard build and wildshard validate after each content slice.

- Complete worst-grid memory: 1,000 MB playing / 1,800 MB loading are the only hard memory caps. Category resident targets are tradeable warnings.
- New/outside projects refuse wire/render target overages: critical 2 MB, library 8 MB; fine/coarse tiles 0.3/0.2 MB, 8/2 draws, 40,000/10,000 triangles; far proxy 1 MB, 1 draw, 8,000 triangles.
- Check SF59 graph cost and measured script CPU/fuel. Build observes 60 ticks; validate runs the full simulation/entry proof.
- Custom runtime: no per-frame allocation, raw renderer/scene/WebGL, DOM, timers, fetch or unbounded loops.
- Both-surface frame floor: desktop 60 fps / Simulator 30 fps; shard CPU p95 at most 4.167 / 8.333 ms per frame.
- Estimated playable time is unique playable bytes at 1 MB/s + 1 s setup, not a phone reading. Measure cold fetch/decode/compile/admission/first frame.

A good report says PASS (refuse), includes measured script samples, and has no refusals. An 8,000,001-byte library is REFUSED against the 8,000,000-byte wire target before product emission.

Completion checklist: build/validate clean; costs truthful; worst totals fit; busiest/approach views fit; graph and script budgets fit; custom runtime lint clean; both-surface CPU/frame receipts green; cold loading measured. Add content through the SDK and repeat.
`);
}
