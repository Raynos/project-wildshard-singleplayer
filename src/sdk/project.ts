// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI verifies and writes local build products.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source assets inside the author project.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Content addresses are SHA-256 of the exact wire bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Encode a compiled config as a Node module URL.
import { Buffer } from 'node:buffer';
import { build } from 'vite';
import { parseShardfile, type Shardfile } from './shardfile';
import { preflightDeclaredCosts, validateShardfileAssets } from '@wildshard/game/shardfile/validate';
import { preflightShardfile } from '@wildshard/game/shardfile/preflight';
import { preflightAssetGraph } from '@wildshard/game/shardfile/assetGraph';
import { readBoundedFile } from './sourceReader';

/** Stable JSON encoding: sorted object keys, no timestamps or host paths. */
export function canonicalJson(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (typeof input === 'object' && input !== null) return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, val]) => [key, canonical(val)]));
    return input;
  };
  return `${JSON.stringify(canonical(value))}\n`;
}
/** Hash of immutable wire bytes; this is also their output filename. */
export function contentHash(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }

/** Validate graph closure costs and actual bytes through the same admission used by the browser loader. */
export function validateProject(input: unknown, assets: ReadonlyMap<string, Uint8Array>): Shardfile { return validateShardfileAssets(input, assets, contentHash); }

/** Compile a trusted local TypeScript config; only its serialisable default export enters the product. */
export async function readProject(project: string): Promise<Shardfile> {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: resolve(project, 'shard.config.ts'), formats: ['es'], fileName: 'config' }, rolldownOptions: { external: [/^node:/u] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built) || (Array.isArray(result) && result.length !== 1)) throw new Error('config build produced unexpected output');
  const chunks = built.output.filter((out) => out.type === 'chunk');
  if (chunks.length !== 1) throw new Error('config must bundle as one module');
  const chunk = chunks[0]; if (chunk === undefined) throw new Error('config chunk missing');
  const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof loaded !== 'object' || loaded === null || !('default' in loaded)) throw new Error('config has no default export');
  return parseShardfile(loaded.default);
}
/** Preflight and read bounded immutable files from an author project or flat built product. */
export function projectAssets(project: string, shard: Shardfile, layout: 'project' | 'product' = 'project'): Map<string, Uint8Array> {
  preflightShardfile(shard); preflightAssetGraph(shard);
  preflightDeclaredCosts(shard);
  return new Map([...shard.files.map((f) => [f.hash, readBoundedFile(resolve(project, layout === 'project' ? 'assets' : '.', f.hash), f.compressed)] as const), ...shard.requires.commons.map((h) => [`commons:${h}`, readBoundedFile(resolve(project, layout === 'project' ? 'commons' : '.', h), shard.requires.commonsWire[h] ?? 0)] as const)]);
}
/** Build a deterministic shard.json, immutable files and the distributed normal client when present. */
export async function buildProject(project: string, output?: string, options: { devserver?: boolean; client?: string | null } = {}): Promise<Shardfile> {
  const raw = await readProject(project), assets = projectAssets(project, raw), shard = validateProject(raw, assets);
  const destination = output ?? resolve(project, 'public/shardfiles', shard.identity.slug);
  shard.files.sort((a, b) => a.hash.localeCompare(b.hash)); shard.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  mkdirSync(destination, { recursive: true });
  for (const [hash, bytes] of assets) writeFileSync(resolve(destination, hash.replace('commons:', '')), bytes);
  writeFileSync(resolve(destination, 'shard.json'), canonicalJson(shard));
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
  writeFileSync(resolve(project, 'README.md'), `# ${slug}\n\nBuild with wildshard build; add content through the SDK.\n`);
}
