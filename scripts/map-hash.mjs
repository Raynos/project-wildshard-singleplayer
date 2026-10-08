// The baked map's staleness key (SF66, G246 / G247): a hash of the files that place a shard's world. A shard's map image
// is baked from the world (scripts/bake-maps.mjs) and stamped with this hash in src/shards/<slug>/look/map.baked.json; the
// gate test (test/baked-maps.test.ts) recomputes it, so a world change without a rebake fails before it deploys.
// Node only, no git (the Vercel tree has no .git): file paths and contents, sorted.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** what places a shard's world, relative to its folder; a shard may name its own in look/map.json ("inputs") */
export const DEFAULT_MAP_INPUTS = ['shard.config.ts', 'layout.ts', 'world', 'generators', 'models'];
/** the full cell the bake covers: CHUNK_SIZE (src/engine/core/config.ts) metres square, centred on the origin */
export const MAP_METRES = 500;

/**
 * A shard's own map settings, src/shards/<slug>/look/map.json (optional): "inputs" (paths that place its world, in place of
 * DEFAULT_MAP_INPUTS) and "hide" (mesh name patterns the bake leaves out, a trailing * a prefix: a cloud sea over the
 * world, a backdrop), and "clipBelow" (metres: nothing under this height is drawn, a cloud sea under floating islands),
 * "heightHide" (names left out of the height pass only: a painted layer that may colour the void but is not ground) and
 * "style" (G252: the stylizer's colour table and rules, scripts/map-stylize.py; a palette change rebakes, since this file is
 * part of the hash), with a "why".
 * @param {string} shardDir @returns {{inputs: string[], hide: string[], heightHide: string[], clipBelow: number | null, style: ({kind: string} & Record<string, unknown>) | null}}
 */
export function mapSettings(shardDir) {
  const own = join(shardDir, 'look', 'map.json');
  if (!existsSync(own)) return { inputs: DEFAULT_MAP_INPUTS, hide: [], heightHide: [], clipBelow: null, style: null };
  const parsed = JSON.parse(readFileSync(own, 'utf8'));
  const list = (key) => {
    const value = parsed[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) throw new Error(`${own}: ${key} must be a string list`);
    return value;
  };
  if (typeof parsed.why !== 'string' || parsed.why.length === 0) throw new Error(`${own}: say why ("why")`);
  if (parsed.clipBelow !== undefined && typeof parsed.clipBelow !== 'number') throw new Error(`${own}: clipBelow must be metres`);
  const style = parsed.style ?? null;
  if (style !== null && (typeof style !== 'object' || !['isle', 'void', 'ground'].includes(style.kind))) throw new Error(`${own}: style.kind must be isle, void or ground`);
  return { inputs: list('inputs') ?? DEFAULT_MAP_INPUTS, hide: list('hide') ?? [], heightHide: list('heightHide') ?? [], clipBelow: parsed.clipBelow ?? null, style };
}
/** @param {string} shardDir */
export const mapInputs = (shardDir) => mapSettings(shardDir).inputs;

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out); else if (entry.isFile()) out.push(path);
  }
}

/** The hash of a shard's map inputs: every file under each input (that exists), path and bytes. @param {string} shardDir */
export function mapTilesHash(shardDir) {
  const root = resolve(shardDir), files = [];
  for (const input of [...mapInputs(root), 'look/map.json']) { // the bake's own settings count too
    const path = join(root, input);
    if (!existsSync(path)) continue;
    if (statSync(path).isDirectory()) walk(path, files); else files.push(path);
  }
  const hash = createHash('sha256');
  for (const file of files.map((f) => relative(root, f).split('\\').join('/')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    hash.update(file); hash.update('\0'); hash.update(readFileSync(join(root, file))); hash.update('\0');
  }
  return hash.digest('hex');
}

/** Every shard folder with a shardfile project. @param {string} repoRoot @returns {{slug: string, dir: string}[]} */
export function mapShards(repoRoot) {
  const shards = resolve(repoRoot, 'src/shards');
  return readdirSync(shards, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(shards, entry.name, 'shard.config.ts')))
    .map((entry) => ({ slug: entry.name, dir: join(shards, entry.name) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
