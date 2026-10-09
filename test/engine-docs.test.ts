// E357 Z2: docs/ENGINE.md keeps one section per 01-architecture §, and docs/SHARDS.md names the layout AG9 enforces.
// SF74 W13 (Jake, G281): the export index is a build output (docs/api/EXPORTS.md, written by `pnpm gen` through
// scripts/gen-api.mjs with the per-package tables and lint/api-surface.json, all gitignored), no longer an ENGINE.md
// appendix that every push regenerated.
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads committed docs and index sources.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Repository-relative paths.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiSurface, exportsPage } from '../scripts/gen-api.mjs';
import { APPENDIX_START } from '../scripts/generated-policy.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const ENGINE_DOC = 'docs/ENGINE.md';
const SHARDS_DOC = 'docs/SHARDS.md';

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

// The pre-push gate builds the Vercel tree, which drops docs/ (.vercelignore); CI's `pnpm test` runs on the
// full checkout, so these run there. A missing docs/ENGINE.md in a full checkout still fails ENGINE.md's own test.
const DOCS = existsSync(resolve(ROOT, 'docs'));
describe.skipIf(!DOCS)('docs/ENGINE.md (E357 Z2)', () => {
  const doc = DOCS ? read(ENGINE_DOC) : ''; // describe.skipIf still runs this body to collect

  it('links the generated export index instead of carrying it (SF74 W13)', () => {
    expect(doc.includes(APPENDIX_START)).toBe(false);
    expect(doc).toContain('(api/EXPORTS.md)');
  });

  it('the generated export index names every export of every package once per module', () => {
    const surface = apiSurface(ROOT), page = exportsPage(surface);
    for (const [layer, rows] of Object.entries(surface.indexes)) {
      expect(page).toContain(`### \`@wildshard/${layer}\``);
      const missing = rows.filter((row) => !page.includes(`\`${row.name}\``)).map((row) => row.name);
      expect(missing).toEqual([]);
    }
  });

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
