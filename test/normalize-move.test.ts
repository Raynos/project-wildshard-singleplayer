import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-side codemod test reads committed syntax fixtures.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated fixture trees use the system temporary directory.
import { tmpdir } from 'node:os';
import { applyEdits, collisions, resolveImport, rewriteGlobs, rewriteImport, rewriteImports, rewritePaths } from '../scripts/normalize/core.mjs';
import { planMove, selectedMoves, type MoveMap } from '../scripts/normalize/move.mjs';
import { classify, type ClassifiedRow } from '../scripts/normalize/classify.mjs';

const moves = new Map([
  ['src/world/View.ts', 'src/engine/world/View.ts'],
  ['src/world/Widget.ts', 'src/engine/world/Widget.ts'],
  ['src/core/helper.ts', 'src/engine/core/helper.ts'],
  ['src/core/job.ts', 'src/engine/core/job.ts'],
  ['src/ui/panel.css', 'src/game/panel.css'],
  ['src/chunks/pine-hollow/hero.webp', 'src/shards/pine-hollow/hero.webp'],
]);
const files = new Set(moves.keys());
const fixture = (name: string): string => readFileSync(`test/fixtures/normalize/${name}.txt`, 'utf8');

describe('F6 import rewrite', () => {
  it('recomputes relative imports within a layer and preserves package imports', () => {
    expect(rewriteImport('src/world/View.ts', 'src/engine/world/View.ts', '../core/helper', files, moves)).toBe('../core/helper');
    expect(rewriteImport('src/world/View.ts', 'src/engine/world/View.ts', 'three', files, moves)).toBe('three');
    expect(rewriteImport('src/world/View.ts', 'src/engine/world/View.ts', './missing', files, moves)).toBe('./missing');
  });
  it('uses aliases across layers, and for tests, retaining assets and query suffixes', () => {
    expect(rewriteImport('src/world/View.ts', 'src/engine/world/View.ts', '../ui/panel.css?inline', files, moves)).toBe('#game/panel.css?inline');
    expect(rewriteImport('src/world/View.ts', 'src/engine/world/View.ts', '../chunks/pine-hollow/hero.webp?url', files, moves)).toBe('#shards/pine-hollow/hero.webp?url');
    expect(rewriteImport('test/view.test.ts', 'test/shards/pine-hollow/view.test.ts', '../src/core/job.ts?worker&inline', files, moves)).toBe('#engine/core/job?worker&inline');
  });
  it('recognizes aliases and strips only TypeScript extensions', () => {
    expect(resolveImport('test/x.ts', '#engine/core/job?worker&inline', new Set(moves.values()))).toBe('src/engine/core/job.ts');
    expect(resolveImport('test/x.ts', '#shards/pine-hollow/hero.webp?url', new Set(moves.values()))).toBe('src/shards/pine-hollow/hero.webp');
  });
  it('rewrites static, type, export, side-effect and dynamic imports without touching comments', () => {
    const result = rewriteImports('src/world/View.ts', 'src/engine/world/View.ts', fixture('imports'), files, moves);
    expect(result).toContain("import type { Widget } from './Widget'");
    expect(result).toContain("export { helper } from '../core/helper'");
    expect(result).toContain("import '#game/panel.css?inline'");
    expect(result).toContain("import('../core/job?worker&inline')");
    expect(result).toContain("import('#shards/pine-hollow/hero.webp?url')");
    expect(result).toContain("// import('./fake')");
  });
  it('is unchanged on a second rewrite against the destination tree', () => {
    const first = rewriteImports('src/world/View.ts', 'src/engine/world/View.ts', fixture('imports'), files, moves);
    expect(rewriteImports('src/engine/world/View.ts', 'src/engine/world/View.ts', first, new Set(moves.values()), new Map())).toBe(first);
  });
});

describe('F6 virtual-tree preflight', () => {
  const map: MoveMap = {
    files: [
      { from: 'src/world/A.ts', f6: 'src/engine/world/A.ts', final: 'src/kit/A.ts', row: 'F6 → S2.3' },
      { from: 'src/dead.ts', f6: null, final: null, row: 'F7' },
    ],
    tests: [{ from: 'test/a.test.ts', f6: 'test/shards/pine-hollow/a.test.ts', final: 'test/shards/pine-hollow/a.test.ts', row: 'F6' }],
    globs: [], manual: [],
  };
  it('selects F6 and later-row moves and recognizes completed moves', () => {
    expect([...selectedMoves(map, 'F6', new Set(['src/world/A.ts', 'src/dead.ts', 'test/a.test.ts'])).moves]).toEqual([
      ['src/world/A.ts', 'src/engine/world/A.ts'], ['test/a.test.ts', 'test/shards/pine-hollow/a.test.ts'],
    ]);
    expect([...selectedMoves(map, 'S2.3', new Set(['src/engine/world/A.ts'])).moves]).toEqual([['src/engine/world/A.ts', 'src/kit/A.ts']]);
    expect(selectedMoves(map, 'F6', new Set(['src/engine/world/A.ts', 'test/shards/pine-hollow/a.test.ts'])).missing).toEqual([]);
  });
  it('recomputes moved tests imports to unmoved public assets and tools, and is idempotent', () => {
    const root = mkdtempSync(`${tmpdir()}/normalize-fixture-`);
    function write(file: string, text: string): void {
      const target = `${root}/${file}`;
      mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
      writeFileSync(target, text);
    }
    try {
      write('src/world/A.ts', 'export const a = 1;\n');
      write('scripts/helper.mjs', 'export const helper = 1;\n');
      write('public/asset.bin', 'data');
      write('test/a.test.ts', "import { a } from '../src/world/A';\nimport { helper } from '../scripts/helper.mjs';\nimport bytes from '../public/asset.bin?inline';\n");
      const first = planMove(map, 'F6', root);
      expect(first.report.unresolvedImports).toEqual([]);
      expect(first.contents.get('test/shards/pine-hollow/a.test.ts')).toContain("from '../../../scripts/helper.mjs'");
      expect(first.contents.get('test/shards/pine-hollow/a.test.ts')).toContain("from '../../../public/asset.bin?inline'");
      expect(first.contents.get('test/shards/pine-hollow/a.test.ts')).toContain("from '#engine/world/A'");
      for (const entry of first.report.gitMoves) rmSync(`${root}/${entry.from}`);
      for (const [file, text] of first.contents) write(file, text);
      const second = planMove(map, 'F6', root);
      expect(second.report.gitMoves).toEqual([]);
      expect(second.report.rewrites).toEqual([]);
      expect(second.report.unresolvedImports).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('F6 classifier', () => {
  it('checks importer ownership, named content, gates and mechanism overrides, and reports drift', () => {
    const root = mkdtempSync(`${tmpdir()}/normalize-classifier-`);
    const rows: ClassifiedRow[] = [
      { from: 'src/chunks/pine-hollow/install.ts', f6: 'src/shards/pine-hollow/install.ts', final: 'src/shards/pine-hollow/install.ts', rule: 'T', row: 'F6' },
      { from: 'src/models/Only.ts', f6: 'src/shards/pine-hollow/models/Only.ts', final: 'src/shards/pine-hollow/models/Only.ts', rule: 'I', row: 'F6' },
      { from: 'src/models/glb.ts', f6: 'src/engine/models/glb.ts', final: 'src/engine/models/glb.ts', rule: 'M', row: 'F6' },
      { from: 'src/world/Forest.ts', f6: 'src/shards/pine-hollow/world/Forest.ts', final: 'src/shards/pine-hollow/world/Forest.ts', rule: 'G', row: 'F6' },
      { from: 'src/world/PineTest.ts', f6: 'src/shards/pine-hollow/world/PineTest.ts', final: 'src/shards/pine-hollow/world/PineTest.ts', rule: 'N', row: 'F6' },
      { from: 'src/main.ts', f6: 'src/main.ts', final: 'src/main.ts', rule: 'ROOT', row: 'F6' },
      { from: 'src/dead.ts', f6: null, final: null, rule: 'D', row: 'F7' },
    ];
    function write(file: string, text: string): void {
      const target = `${root}/${file}`;
      mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
      writeFileSync(target, text);
    }
    try {
      write('src/chunks/pine-hollow/install.ts', "import { Only } from '../../models/Only'; import { glb } from '../../models/glb';\n");
      write('src/models/Only.ts', 'export class Only {}');
      write('src/models/glb.ts', 'export const glb = 1;');
      write('src/world/Forest.ts', 'export class Forest {}');
      write('src/world/PineTest.ts', 'export const PineTest = 1;');
      write('src/main.ts', "import { Forest } from './world/Forest'; import { PineTest } from './world/PineTest'; const x = isPine ? new Forest() : null; use(PineTest);\n");
      expect(classify({ files: rows }, root)).toEqual([]);
      write('src/main.ts', "import { Only } from './models/Only'; import { Forest } from './world/Forest'; import { PineTest } from './world/PineTest'; use(Only, Forest, PineTest);\n");
      write('src/core/new.ts', 'export const fresh = 1;');
      rmSync(`${root}/src/world/PineTest.ts`);
      const findings = classify({ files: rows }, root);
      expect(findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'unmapped file', file: 'src/core/new.ts', destination: 'src/engine/core/new.ts' }),
        expect.objectContaining({ kind: 'missing file', file: 'src/world/PineTest.ts' }),
        expect.objectContaining({ kind: 'rule disagreement', file: 'src/models/Only.ts' }),
        expect.objectContaining({ kind: 'rule disagreement', file: 'src/world/Forest.ts' }),
      ]));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('F6 paths, globs and collision preflight', () => {
  it('matches longest-first on path boundaries, including templates and comments', () => {
    const paths = new Map([['src/world/Thing.ts', 'src/engine/world/Thing.ts'], ['src/world/Thing', 'src/kit/Thing']]);
    const result = rewritePaths(fixture('paths'), paths);
    expect(result).toContain("'src/engine/world/Thing.ts'");
    expect(result).toContain('`src/engine/world/Thing.ts?raw`');
    // oxlint-disable-next-line eslint/no-template-curly-in-string -- Assert preserved template syntax, not interpolation in this test.
    expect(result).toContain('`${root}/src/engine/world/Thing.ts`');
    expect(result).toContain('// src/engine/world/Thing.ts');
    expect(result).toContain("'src/world/Thing.tsx'");
    expect(result).toContain("'src/world/Thing.ts/child'");
    expect(result).toContain("'other-src/world/Thing.ts'");
    expect(result).toContain("'/src/engine/world/Thing.ts'");
  });
  it('does not cascade substitutions into newly emitted destinations', () => {
    expect(rewritePaths('src/a.ts src/b.ts', new Map([['src/a.ts', 'src/b.ts'], ['src/b.ts', 'src/c.ts']]))).toBe('src/b.ts src/c.ts');
  });
  it('only rewrites the selected glob row and preserves call options and unrelated globs', () => {
    const text = "const a = import.meta.glob<string>(['./a/*.jpg'], { eager: true }); const b = import.meta.glob('./b/*.ts');";
    const rows = [{ file: 'src/boot/x.ts', row: 'F6', from: ['./a/*.jpg'], to: ['../../shards/*/thumbs/*.jpg'] }];
    const result = rewriteGlobs('src/boot/x.ts', text, rows, 'F6');
    expect(result).toContain('glob<string>(["../../shards/*/thumbs/*.jpg"], { eager: true })');
    expect(result).toContain("glob('./b/*.ts')");
    expect(rewriteGlobs('src/boot/x.ts', result, rows, 'F6')).toBe(result);
  });
  it('refuses occupied, duplicate and case-only destinations', () => {
    expect(collisions(new Map([['src/a.ts', 'src/B.ts']]), new Set(['src/a.ts', 'src/b.ts']))).toHaveLength(1);
    expect(collisions(new Map([['src/a.ts', 'src/x.ts'], ['src/b.ts', 'src/X.ts']]), new Set(['src/a.ts', 'src/b.ts']))).toHaveLength(1);
    expect(collisions(new Map([['src/a.ts', 'src/A.ts']]), new Set(['src/a.ts']))).toHaveLength(1);
    expect(collisions(moves, files)).toEqual([]);
  });
  it('rejects overlapping syntax edits', () => {
    expect(() => applyEdits('abc', [{ start: 0, end: 2, text: 'x' }, { start: 1, end: 3, text: 'y' }])).toThrow('Overlapping');
  });
});
