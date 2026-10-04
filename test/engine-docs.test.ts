// E357 Z2: docs/ENGINE.md lists every export of the packages' public modules, and docs/SHARDS.md names the layout AG9
// enforces. Regenerate the export appendix after a public module changes (node scripts/gen-api.mjs first):
//   ENGINE_DOC_WRITE=1 pnpm exec vitest run test/engine-docs.test.ts
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads committed docs and index sources.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Repository-relative paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The opt-in rewrite switch for the generated appendix.
import { env } from 'node:process';
import { describe, expect, it } from 'vitest';
import { APPENDIX_END, APPENDIX_START, engineAppendix } from '../scripts/generated-policy.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const ENGINE_DOC = 'docs/ENGINE.md';
const SHARDS_DOC = 'docs/SHARDS.md';
const START = APPENDIX_START;
const END = APPENDIX_END;
/** E434: no index files — a package's public surface is every export of every module its package.json `exports` lists,
 *  read from lint/api-surface.json (scripts/gen-api.mjs builds it with the TypeScript checker; `gen-api --check` keeps it
 *  current), grouped by the module to import each name from. */
const SURFACE = 'lint/api-surface.json';

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

interface IndexExports { alias: string; file: string; groups: Map<string, string[]> }
interface SurfaceRow { name: string; from: string }
const isRows = (v: unknown): v is SurfaceRow[] => Array.isArray(v) && v.every((r: unknown) => typeof r === 'object' && r !== null && 'name' in r && 'from' in r);

function allIndexes(): IndexExports[] {
  const surface: unknown = JSON.parse(read(SURFACE));
  const indexes = typeof surface === 'object' && surface !== null && 'indexes' in surface ? surface.indexes : null;
  if (typeof indexes !== 'object' || indexes === null) throw new Error(`${SURFACE}: no indexes`);
  return Object.entries(indexes).map(([layer, rows]) => {
    if (!isRows(rows)) throw new Error(`${SURFACE}: ${layer} is not a list of { name, from } rows`);
    const groups = new Map<string, string[]>();
    for (const r of rows) {
      const list = groups.get(r.from) ?? [];
      if (!list.includes(r.name)) list.push(r.name);
      groups.set(r.from, list);
    }
    return { alias: `@wildshard/${layer}`, file: `src/${layer}/package.json`, groups };
  });
}
const names = (ix: IndexExports): Set<string> => new Set([...ix.groups.values()].flat());

function appendix(indexes: readonly IndexExports[]): string {
  return engineAppendix({ indexes: Object.fromEntries(indexes.map((ix) => [ix.alias.slice('@wildshard/'.length), [...ix.groups].flatMap(([from, list]) => list.map((name) => ({ name, from })))])) });
}

/** The names a doc's appendix lists under one index heading (module paths and prose excluded). */
function listed(block: string, alias: string): Set<string> {
  const heading = `### \`${alias}\` (`;
  const at = block.indexOf(heading);
  if (at === -1) return new Set();
  const rest = block.slice(at + heading.length);
  const stop = rest.indexOf('\n### ');
  const section = stop === -1 ? rest : rest.slice(0, stop);
  const found = new Set<string>();
  for (const line of section.split('\n')) {
    const item = /^- `[^`]+`: (.*)$/u.exec(line)?.[1];
    if (item === undefined) continue;
    for (const m of item.matchAll(/`(\w+)`/gu)) found.add(m[1] ?? '');
  }
  return found;
}

// The pre-push gate builds the Vercel tree, which drops docs/ (.vercelignore); CI's `pnpm test` runs on the
// full checkout, so these run there. A missing docs/ENGINE.md in a full checkout still fails ENGINE.md's own test.
const DOCS = existsSync(resolve(ROOT, 'docs'));
describe.skipIf(!DOCS)('docs/ENGINE.md (E357 Z2)', () => {
  const indexes = allIndexes();
  if (env['ENGINE_DOC_WRITE'] === '1') {
    const doc = read(ENGINE_DOC);
    const from = doc.indexOf(START), to = doc.indexOf(END);
    if (from === -1 || to === -1) throw new Error(`${ENGINE_DOC}: the export markers are missing`);
    writeFileSync(resolve(ROOT, ENGINE_DOC), doc.slice(0, from) + appendix(indexes) + doc.slice(to + END.length));
  }
  const doc = DOCS ? read(ENGINE_DOC) : ''; // describe.skipIf still runs this body to collect

  it('has the generated export appendix', () => {
    expect(doc.includes(START) && doc.includes(END)).toBe(true);
  });

  for (const ix of indexes) {
    it(`mentions every export of ${ix.alias} (and no stale name)`, () => {
      const block = doc.slice(doc.indexOf(START), doc.indexOf(END));
      const want = names(ix), have = listed(block, ix.alias);
      const missing = [...want].filter((n) => !have.has(n));
      const stale = [...have].filter((n) => !want.has(n));
      const hint = 'run ENGINE_DOC_WRITE=1 pnpm exec vitest run test/engine-docs.test.ts, then describe any new API in its section';
      expect({ missing, stale, hint: missing.length + stale.length > 0 ? hint : '' }).toEqual({ missing: [], stale: [], hint: '' });
    });
  }

  it('has one section per 01-architecture §', () => {
    const sections = ['0', '1', '2', '3', '4', '5', '5a', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
    const missing = sections.filter((s) => !new RegExp(`^## ${s}\\. `, 'mu').test(doc));
    expect(missing).toEqual([]);
  });
});

describe.skipIf(!DOCS)('docs/SHARDS.md and the shard READMEs (E357 Z2, E362 AG22)', () => {
  const layout = JSON.parse(read('lint/shard-layout.json')) as { requiredFiles: string[]; allowedFiles: string[]; folders: string[] };
  const shards = DOCS ? read(SHARDS_DOC) : '';

  it('names every file and folder the AG9 layout check knows', () => {
    const want = [...layout.requiredFiles, ...layout.allowedFiles, ...layout.folders.map((f) => `${f}/`)];
    expect(want.filter((name) => !shards.includes(`\`${name}\``))).toEqual([]);
  });

  it('every shard folder, the template included, has a README.md', () => {
    const slugs = readdirSync(resolve(ROOT, 'src/shards'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(slugs.length).toBeGreaterThanOrEqual(5);
    expect(slugs.filter((slug) => !existsSync(resolve(ROOT, 'src/shards', slug, 'README.md')))).toEqual([]);
  });
});
