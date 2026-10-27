// The site's numbers, read from the game's own files when the site builds (E506 RD14, MR11 / MR12: "hand-copied
// numbers rot within days"). A plain script: no game imports, no plugin, no new dependency.
//   node site/tools/facts.ts > facts.json      what site/tools/deploy.sh does, from the checkout, before its clean export
//   readFacts(repo)                            what site/vite.config.ts does when SITE_FACTS names no such file
// COPY.md says {=name} where a number belongs (site/tools/copy.ts fills it); the grid pictures read `cells`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** one cell of the grid the site draws: a shard, or an open plot waiting for an author */
export interface FactCell { readonly x: number; readonly z: number; readonly slug: string; readonly plot: boolean }
export interface SiteFacts { readonly text: Readonly<Record<string, string>>; readonly cells: readonly FactCell[] }

const num = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

function record(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('site facts: expected a JSON object');
  return Object.fromEntries(Object.entries(v));
}
function list(v: unknown): unknown[] { if (!Array.isArray(v)) throw new Error('site facts: expected a JSON array'); return v; }
function number(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`site facts: ${what} is not a number`);
  return v;
}
/** `export const NAME = 123` (optionally typed) in a source file, read as text */
function constant(file: string, name: string): number {
  const m = new RegExp(String.raw`export const ${name}(?::[^=]+)?\s*=\s*([\d.]+)`, 'u').exec(readFileSync(file, 'utf8'));
  if (m === null) throw new Error(`site facts: no ${name} in ${file}`);
  return Number(m[1]);
}
const json = (file: string): Record<string, unknown> => record(JSON.parse(readFileSync(file, 'utf8')));

/** the single-player grid as the game assembles it with every shard on (the base cells, then the `devserver` row) */
function gridCells(repo: string): { cells: FactCell[]; pitch: number } {
  const grid = record(json(join(repo, 'src/game/grid/singleplayer.json')).grid);
  const at = new Map<string, FactCell>();
  for (const row of [...list(grid.cells), ...list(grid.devserver)]) {
    const r = record(row), cell = list(r.cell), slug = String(r.slug);
    const x = number(cell[0], 'cell x'), z = number(cell[1], 'cell z');
    at.set(`${x},${z}`, { x, z, slug, plot: slug.startsWith('open-plot-') });
  }
  return { cells: [...at.values()], pitch: number(grid.pitch, 'grid.pitch') };
}

/** shard.json schema paths: the generated reference's own inventory of ShardfileSchema (its `$` rows), run in the
 *  plain-Node loader the reference uses; it loads only src/format, all checked in */
function schemaPaths(repo: string): number {
  const code = "import { ShardfileSchema } from '@wildshard/format/shardSchema'; import { schemaInventory } from './scripts/docs/schema-reference.mjs';"
    + ' process.stdout.write(String(schemaInventory(ShardfileSchema).length));';
  const run = spawnSync(process.execPath, ['--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', code], { cwd: repo, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`site facts: the schema count failed: ${run.stderr}`);
  return number(Number(run.stdout), 'the schema count');
}

export function readFacts(repo: string): SiteFacts {
  const { cells, pitch } = gridCells(repo);
  const side = Math.round(Math.sqrt(cells.length));
  if (side * side !== cells.length) throw new Error(`site facts: ${cells.length} grid cells is not a square`);
  const size = constant(join(repo, 'src/format/contentBounds.ts'), 'CHUNK_SIZE');
  const road = constant(join(repo, 'src/engine/core/config.ts'), 'ROAD_WIDTH');
  const memory = json(join(repo, 'src/format/memoryGates.json'));
  const gap = pitch - size, shards = cells.filter((c) => !c.plot).length, plots = cells.length - shards;
  const gb = (mb: number): string => `${num(mb / 1000)} GB`;
  const text: Record<string, string> = {
    side: String(side),                                      // 5 (a 5 × 5)
    cells: String(cells.length),                             // 25
    cellSize: num(size),                                     // 500 (m)
    pitch: num(pitch),                                       // 562.5 (m, centre to centre)
    gap: num(gap),                                           // 62.5 (m round each cell)
    road: num(road),                                         // 15 (m of road in the gap)
    verge: num((gap - road) / 2),                            // 23.75 (m either side of the road)
    corner: num(Math.round(gap / Math.SQRT2)),               // 44 (m: the crossroads' four corners from its centre)
    shards: String(shards),
    shardsWord: WORDS[shards] ?? String(shards),
    plots: String(plots),
    memoryPlaying: gb(number(memory.explorerMB, 'explorerMB')),   // 1.2 GB a shard (Jake, G534 / G556)
    memoryLoading: gb(number(memory.loadingMB, 'loadingMB')),
    schemaPaths: num(schemaPaths(repo)),
  };
  return { text, cells };
}

/** COPY.md text with every {=name} replaced; an unknown name stops the build */
export function fillFacts(s: string, facts: SiteFacts): string {
  return s.replaceAll(/\{=(\w+)\}/gu, (_m, name: string) => {
    const v = facts.text[name];
    if (v === undefined) throw new Error(`site/COPY.md: no site fact {=${name}} (site/tools/facts.ts)`);
    return v;
  });
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  process.stdout.write(`${JSON.stringify(readFacts(resolve(import.meta.dirname, '../..')))}\n`);
}
