// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI verifies and writes local build products.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve source assets inside the author project.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Content addresses are SHA-256 of the exact wire bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Encode a compiled config as a Node module URL.
import { Buffer } from 'node:buffer';
import { build } from 'vite';
import { CONTENT_CAPS as C } from '@wildshard/engine/core/config';
import { admitScript, type ScriptAdmission } from '@wildshard/engine/script/admission';
import { SCRIPT_LIMITS } from '@wildshard/engine/script/host';
import { worstContentCost } from '@wildshard/game/shardfile/budget';
import { parseShardfile, type Shardfile } from './shardfile';
import { assetCost } from './assets';

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

/** Validate graph closure costs, actual assets and the worst resident disc before writing a product. */
export function validateProject(input: unknown, assets: ReadonlyMap<string, Uint8Array>): Shardfile {
  const s = parseShardfile(input), files = new Map(s.files.map((f) => [f.hash, f]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const id = pending.pop(); if (id === undefined || found.has(id)) continue; found.add(id);
      if (!id.startsWith('commons:')) pending.push(...(files.get(id)?.dependencies ?? []));
    }
    return found;
  };
  const sum = (roots: readonly string[], excluded: ReadonlySet<string> = new Set()): { resident: number; compressed: number; triangles: number; draws: number } => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const id of closure(roots)) {
      if (id.startsWith('commons:') || excluded.has(id)) continue;
      const f = files.get(id); if (f === undefined) throw new Error('missing dependency');
      resident += f.decoded + f.gpu; compressed += f.compressed; triangles += f.triangles; draws += f.draws;
    }
    return { resident, compressed, triangles, draws };
  };
  let commons = 0;
  const commonsCosts = new Map<string, ReturnType<typeof assetCost>>(), admissions = new Map<string, ScriptAdmission>();
  for (const hash of s.requires.commons) {
    const bytes = assets.get(`commons:${hash}`); if (bytes === undefined || contentHash(bytes) !== hash) throw new Error('unavailable commons asset');
    const kind = bytes[0] === 171 ? 'ktx2' : bytes[0] === 103 ? 'glb' : bytes[0] === 82 ? 'audio' : 'binary';
    const cost = assetCost(kind, bytes); commons += cost.decoded + cost.gpu; commonsCosts.set(`commons:${hash}`, cost);
  }
  for (const f of s.files) {
    const bytes = assets.get(f.hash); if (bytes === undefined || bytes.length !== f.compressed || contentHash(bytes) !== f.hash) throw new Error('file hash or wire size mismatch');
    const actual = assetCost(f.kind, bytes);
    if (f.kind === 'wasm') admissions.set(f.hash, admitScript(bytes));
    if (actual.decoded > f.decoded || actual.gpu > f.gpu || actual.triangles > f.triangles || actual.draws > f.draws) throw new Error('asset cost declaration understated');
  }
  const library = closure(s.library);
  if (s.sim.scripts.some((id) => !id.startsWith('commons:') && files.get(id)?.kind !== 'wasm')) throw new Error('script reference is not an admitted Wasm file');
  for (const t of s.tiles) {
    const roots = closure(t.files);
    if (t.lod === 1 && [...roots].some((r) => library.has(r))) throw new Error('coarse dependency on library');
    const cost = sum(t.files, library);
    if (cost.resident > t.decoded + t.gpu || cost.compressed > t.compressed || cost.triangles > t.triangles || cost.draws > t.draws) throw new Error('tile dependency cost understated');
  }
  if (s.far !== null) {
    if ([...closure(s.far.files)].some((r) => library.has(r))) throw new Error('far dependency on library');
    const cost = sum(s.far.files);
    if (cost.resident > s.far.decoded + s.far.gpu || cost.compressed > s.far.compressed || cost.triangles > s.far.triangles || cost.draws > s.far.draws) throw new Error('far dependency cost understated');
  }
  for (const [roots, budget] of [[s.library, s.budgets.library], [s.critical, s.budgets.sim]] as const) {
    const cost = sum(roots); if (cost.resident > budget.resident || cost.compressed > budget.compressed) throw new Error('bundle dependency budget understated');
  }
  const critical = closure(s.critical), criticalCost = sum(s.critical);
  let criticalResident = criticalCost.resident, criticalWire = criticalCost.compressed;
  for (const ref of critical) if (ref.startsWith('commons:')) {
    const bytes = assets.get(ref), actual = commonsCosts.get(ref);
    if (bytes === undefined || actual === undefined) throw new Error('unavailable critical commons');
    criticalResident += actual.decoded + actual.gpu; criticalWire += bytes.length;
  }
  if (criticalWire > C.sim.compressed || criticalWire > s.budgets.sim.compressed || s.sim.scripts.some((r) => !critical.has(r)) || [...critical].some((r) => library.has(r))) throw new Error('critical bundle cap, declared wire budget, render-library dependency or script omitted');
  let scriptMemory = 0;
  for (const module of new Set(s.sim.scripts)) {
    let admission = admissions.get(module);
    if (admission === undefined) {
      const bytes = assets.get(module); if (bytes === undefined) throw new Error('unavailable script');
      admission = admitScript(bytes); admissions.set(module, admission);
    }
    // One guest per module: live, last-good and in-flight copies at the admitted growth ceiling.
    scriptMemory += admission.maximumPages * 65536 * 3;
  }
  if (s.sim.scripts.length > SCRIPT_LIMITS.instances || scriptMemory > SCRIPT_LIMITS.memoryBytes || criticalResident + scriptMemory > s.budgets.sim.resident || criticalResident + scriptMemory > s.serverBudget.memory) throw new Error('script memory budget understated or above host cap');
  const cost = worstContentCost(s, commons);
  if (cost.playing > C.playing || cost.loading > C.loading) throw new Error(`worst-location total exceeds envelope: ${cost.playing}`);
  return s;
}

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
/** Read content-addressed source assets inside the project's assets and commons directories. */
export function projectAssets(project: string, shard: Shardfile): Map<string, Uint8Array> {
  return new Map([...shard.files.map((f) => [f.hash, readFileSync(resolve(project, 'assets', f.hash))] as const), ...shard.requires.commons.map((h) => [`commons:${h}`, readFileSync(resolve(project, 'commons', h))] as const)]);
}
/** Build a deterministic shard.json, immutable files and the distributed normal client when present. */
export async function buildProject(project: string, output?: string): Promise<Shardfile> {
  const raw = await readProject(project), assets = projectAssets(project, raw), shard = validateProject(raw, assets);
  const destination = output ?? resolve(project, 'public/shardfiles', shard.identity.slug);
  shard.files.sort((a, b) => a.hash.localeCompare(b.hash)); shard.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  mkdirSync(destination, { recursive: true });
  for (const [hash, bytes] of assets) writeFileSync(resolve(destination, hash.replace('commons:', '')), bytes);
  writeFileSync(resolve(destination, 'shard.json'), canonicalJson(shard));
  const directory = import.meta.dirname;
  const client = [resolve(directory, 'client'), resolve(directory, 'dist/client')].find((path) => existsSync(resolve(path, 'index.html')));
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
