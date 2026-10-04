// oxlint-disable-next-line import/no-nodejs-modules -- Cold generator fixtures execute the CLI.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Select the current Node executable for CLI regression coverage.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator integration fixtures own temporary directories.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator fixtures stay outside the shared working tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Generator fixtures require host filesystem paths.
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { genShards, manifestClosure, manifestContract } from '../scripts/gen-shards.mjs';
import { splitKtx2 } from '../scripts/ktx2-tables.mjs';

describe('shard generation', () => {
  it('runs cold CLI discovery without importing manifests or requiring generated boot modules', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-cold-'));
    try {
      mkdirSync(join(root, 'scripts'));
      mkdirSync(join(root, 'src/shards/cold'), { recursive: true });
      for (const file of ['gen-shards.mjs', 'gen-shard-words.mjs', 'gen-budget-derivations.mjs']) writeFileSync(join(root, 'scripts', file), readFileSync(resolve('scripts', file)));
      symlinkSync(resolve('node_modules'), join(root, 'node_modules'));
      writeFileSync(join(root, 'src/shards/cold/manifest.ts'), "import { bytes } from './bytes.generated'; export default { slug: 'cold', name: 'Cold', bytes }; ");
      // Nothing *.generated exists yet, and budget inputs must not be loaded during discovery.
      expect(() => execFileSync(process.execPath, [join(root, 'scripts/gen-shards.mjs')], { cwd: root, stdio: 'pipe' })).not.toThrow();
      expect(readFileSync(join(root, 'src/shards.generated.ts'), 'utf8')).toContain("./shards/cold/manifest");
      expect(readFileSync(join(root, 'lint/shard-words.generated.json'), 'utf8')).toContain('"cold"');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('follows static runtime imports and re-exports, excluding types and lazy plugin thunks', () => {
    const root = mkdtempSync(join(tmpdir(), 'manifest-closure-'));
    try {
      const dir = join(root, 'src/shards/new-shard'); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'manifest.ts'), "import { data } from './data'; import type { Shape } from './types'; export default { data, load: () => import('./plugin') }; ");
      writeFileSync(join(dir, 'data.ts'), "export { more } from './more'; export type { Shape } from './types';");
      writeFileSync(join(dir, 'more.ts'), 'export const more = 1;');
      writeFileSync(join(dir, 'types.ts'), 'export interface Shape {}');
      writeFileSync(join(dir, 'plugin.ts'), 'throw new Error("must stay lazy");');
      expect(manifestClosure(root)['new-shard']).toEqual(['src/shards/new-shard/data.ts', 'src/shards/new-shard/manifest.ts', 'src/shards/new-shard/more.ts']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('keeps the exact ownership vocabulary when a plugin moves into its declared trusted runtime entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-runtime-'));
    try {
      const dir = join(root, 'src/shards/mine'); mkdirSync(join(dir, 'runtime'), { recursive: true });
      writeFileSync(join(dir, 'manifest.ts'), "export default { slug: 'mine', name: 'Mine' };");
      writeFileSync(join(dir, 'shard.config.ts'), "export default { runtime: { entry: 'runtime/index.ts' } };");
      const hooks = "export function kit(ctx) { ctx.rows.species([{ id: 'mine.creature' }]); ctx.rows.weapon({ id: 'mine.weapon' }); }";
      writeFileSync(join(dir, 'plugin.ts'), hooks); genShards(root);
      const file = join(root, 'lint/shard-words.generated.json'), before = readFileSync(file, 'utf8');
      writeFileSync(join(dir, 'runtime/index.ts'), hooks);
      writeFileSync(join(dir, 'plugin.ts'), "import Runtime from './runtime/index'; export default class Plugin extends Runtime {}");
      genShards(root); expect(readFileSync(file, 'utf8')).toBe(before);
      // Duplicate adapter registrations and unrelated helpers neither duplicate ids nor widen the vocabulary.
      writeFileSync(join(dir, 'plugin.ts'), hooks);
      writeFileSync(join(dir, 'runtime/helper.ts'), "export function kit(ctx) { ctx.rows.weapon({ id: 'not.admitted' }); }");
      genShards(root); expect(readFileSync(file, 'utf8')).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('keeps registered vocabulary through runtime-selected rows with their explicit nullish fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-selected-'));
    try {
      const dir = join(root, 'src/shards/mine'); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'manifest.ts'), "export default { slug: 'mine', name: 'Mine' };");
      writeFileSync(join(dir, 'species.ts'), "export const A = { id: 'mine.a' }; export const B = { id: 'mine.b' };");
      const imports = "import { A, B } from './species';";
      writeFileSync(join(dir, 'plugin.ts'), `${imports} export class Plugin { kit(ctx) { ctx.rows.species([A, B]); ctx.rows.weapon({ id: 'mine.weapon' }); } }`);
      genShards(root); const file = join(root, 'lint/shard-words.generated.json'), before = readFileSync(file, 'utf8');
      // Selection is trusted runtime code; generation must neither execute it nor scan unrelated runtime helpers.
      writeFileSync(join(dir, 'select.ts'), "export function select(ctx) { throw new Error('runtime must not execute'); }");
      writeFileSync(join(dir, 'plugin.ts'), `${imports} import { select } from './select'; export class Plugin { kit(ctx) { this.selection = select(ctx); ctx.rows.species(this.selection?.rows ?? [A, B]); ctx.rows.weapon({ id: 'mine.weapon' }); } }`);
      genShards(root); expect(readFileSync(file, 'utf8')).toBe(before);
      expect(() => genShards(root, true)).not.toThrow();
      // An entirely static selection still wins over an unused fallback, as it does at runtime.
      writeFileSync(join(dir, 'plugin.ts'), `${imports} export function kit(ctx) { ctx.rows.species([A] ?? [B]); ctx.rows.weapon({ id: 'mine.weapon' }); }`);
      genShards(root); expect(readFileSync(file, 'utf8')).toContain('"mine.a"');
      expect(readFileSync(file, 'utf8')).not.toContain('"mine.b"');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  // it parses every real shard's closure: under 2 s alone, over 5 s under coverage (CI), like pine-crags
  it('AG10: holds the manifest contract on every real shard (lazy plugin, closure budget, every field read)', () => {
    expect(manifestContract(resolve('.'), manifestClosure(resolve('.')), true)).toEqual([]);
  }, 20_000);
  it('AG10: refuses a static plugin, a missing lazy load and a closure over budget', () => {
    const root = mkdtempSync(join(tmpdir(), 'manifest-contract-'));
    try {
      mkdirSync(join(root, 'lint'));
      writeFileSync(join(root, 'lint/manifest-closure-budget.json'), JSON.stringify({ budgets: { default: 1 } }));
      for (const [slug, source] of [['eager', "import Plugin from './plugin'; export default { load: async () => ({ default: Plugin }) };"], ['fat', "import { a } from './a'; export default { a, load: () => import('./plugin') };"], ['good', "export default { load: () => import('./plugin') };"]] as const) {
        mkdirSync(join(root, 'src/shards', slug), { recursive: true });
        writeFileSync(join(root, 'src/shards', slug, 'manifest.ts'), source);
        writeFileSync(join(root, 'src/shards', slug, 'a.ts'), 'export const a = 1;');
        writeFileSync(join(root, 'src/shards', slug, 'plugin.ts'), 'export default class {}');
      }
      const failures = manifestContract(root, manifestClosure(root));
      expect(failures.filter((f) => f.includes('/eager/'))).toHaveLength(3);
      expect(failures.filter((f) => f.includes('/fat/'))).toEqual([expect.stringMatching(/over its budget 1/u)]);
      expect(failures.filter((f) => f.includes('/good/'))).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('discovers a new manifest and the hidden template without a KTX2 file; checks determinism and stale output', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-'));
    try {
      for (const slug of ['new-shard', '_template']) {
        const dir = join(root, 'src/shards', slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'manifest.ts'), 'export default {};');
      }
      mkdirSync(join(root, 'src/shards/not-a-shard'));
      genShards(root);
      const out = join(root, 'src/shards.generated.ts');
      const source = readFileSync(out, 'utf8');
      expect(source).toContain("from './shards/new-shard/manifest'");
      expect(readFileSync(join(root, 'src/game/shard/slugs.generated.ts'), 'utf8')).toContain('"_template" | "new-shard"');
      expect(source).not.toContain('ktx2');
      expect(source).not.toContain('not-a-shard');
      genShards(root);
      expect(readFileSync(out, 'utf8')).toBe(source);
      expect(() => genShards(root, true)).not.toThrow();
      unlinkSync(out);
      expect(() => genShards(root, true)).toThrow('stale');
      expect(() => genShards(root, true, true)).not.toThrow();
      expect(readFileSync(out, 'utf8')).toBe(source);
      writeFileSync(out, 'stale');
      expect(() => genShards(root, true)).toThrow('stale');
      expect(() => genShards(root, true, true)).toThrow('stale');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('partitions KTX2 by shard-owned source paths and preserves shared layer mappings', () => {
    const map = { phone: { '/assets/new-shard/a.glb': '/assets/gpu/new-shard/a.glb', '/assets/tex/shared.jpg#layer': '/assets/gpu/tex/shared.ktx2', '/assets/legacy/a.jpg': '/assets/gpu/legacy/a.ktx2' }, desktop: {} };
    const result = splitKtx2(map, [{ slug: 'new-shard', assetGlobs: ['public/assets/legacy/**'] }]);
    expect(result.get('new-shard')?.phone).toEqual({ '/assets/new-shard/a.glb': '/assets/gpu/new-shard/a.glb', '/assets/legacy/a.jpg': '/assets/gpu/legacy/a.ktx2' });
    expect(result.get('engine')?.phone).toEqual({ '/assets/tex/shared.jpg#layer': '/assets/gpu/tex/shared.ktx2' });
    expect(() => splitKtx2(map, [{ slug: 'new-shard' }, { slug: 'other', assetGlobs: ['public/assets/new-shard/**'] }])).toThrow('ambiguous');
  });

  it('updates only one vocabulary entry while another shard has malformed WIP', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-scoped-'));
    const put = (slug: string, file: string, source: string): void => {
      const dir = join(root, 'src/shards', slug); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, file), source);
    };
    try {
      put('mine', 'manifest.ts', "export default { slug: 'mine', name: 'Before', debugOptions: ['mine.old'], assetGlobs: ['public/assets/mine/**'] };");
      put('other', 'manifest.ts', "export default { slug: 'other', name: 'Committed Other', debugOptions: ['other.keep'], assetGlobs: ['public/assets/other/**'] };");
      put('other', 'plugin.ts', "export function kit(ctx) { ctx.rows.species({ id: 'other.creature' }); }");
      genShards(root);
      put('other', 'manifest.ts', 'export default { this is unfinished');
      put('other', 'plugin.ts', 'export function kit( unfinished');
      put('mine', 'manifest.ts', "export default { slug: 'mine', name: 'After', debugOptions: ['mine.new'], assetGlobs: ['public/assets/mine/v2/**'] };");
      put('mine', 'plugin.ts', "export function kit(ctx) { ctx.rows.weapon({ id: 'mine.whip' }); }");
      genShards(root, false, false, 'mine');
      const file = join(root, 'lint/shard-words.generated.json');
      const source = readFileSync(file, 'utf8'); const data: unknown = JSON.parse(source);
      expect(data).toMatchObject({ slugs: ['mine', 'other'], words: ['After', 'Committed Other', 'mine', 'mine.whip', 'other', 'other.creature'],
        shards: { mine: { name: 'After', ids: ['mine.whip'], settings: ['mine.new'], assets: ['public/assets/mine/v2/**'] },
          other: { name: 'Committed Other', ids: ['other.creature'], settings: ['other.keep'], assets: ['public/assets/other/**'] } } });
      expect(() => genShards(root, true, false, 'mine')).not.toThrow();
      expect(readFileSync(file, 'utf8')).toBe(source);
      expect(() => genShards(root)).toThrow('Cannot read shard vocabulary');
      expect(() => genShards(root, false, false, '../mine')).toThrow('unknown shard');
      expect(() => genShards(root, false, false, 'missing')).toThrow('unknown shard');
      expect(readFileSync(file, 'utf8')).toBe(source);
      put('fresh', 'manifest.ts', "export default { slug: 'fresh', name: 'Fresh' };");
      genShards(root, false, false, 'fresh');
      const added: unknown = JSON.parse(readFileSync(file, 'utf8'));
      expect(added).toMatchObject({ slugs: ['fresh', 'mine', 'other'], words: ['After', 'Committed Other', 'fresh', 'Fresh', 'mine', 'mine.whip', 'other', 'other.creature'] });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('requires an existing vocabulary for a scoped write and checks stale entries without writing', () => {
    const root = mkdtempSync(join(tmpdir(), 'gen-shards-scoped-init-'));
    try {
      const dir = join(root, 'src/shards/mine'); mkdirSync(dir, { recursive: true });
      const manifest = join(dir, 'manifest.ts'); writeFileSync(manifest, "export default { slug: 'mine', name: 'Before' };");
      expect(() => genShards(root, false, false, 'mine')).toThrow('scoped generation needs');
      genShards(root);
      const file = join(root, 'lint/shard-words.generated.json'), before = readFileSync(file, 'utf8');
      writeFileSync(manifest, "export default { slug: 'mine', name: 'After' };");
      expect(() => genShards(root, true, false, 'mine')).toThrow('stale lint/shard-words.generated.json');
      expect(readFileSync(file, 'utf8')).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
