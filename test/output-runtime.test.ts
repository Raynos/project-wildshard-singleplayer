// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own their temporary source and output directories.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture paths stay under the owned tmp directory.
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { runtimeCodeLines, validateRuntimeData, writeRuntimeFiles } from '@wildshard/sdk/outputRuntime';
import { hashImmutableBytes, encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { codeLines } from '../scripts/shard-platform.mjs';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';

const owned: string[] = [];
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture(): { project: string; output: string } {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(join(resolve('tmp'), 'runtime-copy-')); owned.push(root);
  const project = join(root, 'source'), output = join(root, 'out'); mkdirSync(project);
  return { project, output };
}
function put(project: string, path: string, source: string): void { const file = join(project, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); }
function check(path: string, source: string): readonly { message: string }[] {
  return shardfileBoundaryViolations(resolve('.'), `src/shards/probe/${path}`, source).filter(issue => issue.rule === 'runtime-standalone');
}
it('copies the full TS inventory verbatim with exact measurements and removes stale output', () => {
  const { project, output } = fixture(), source = "// keep CRLF and UTF-8: café\r\nimport { n } from './nested/value';\r\nexport default n;\r\n";
  put(project, 'runtime/index.ts', source); put(project, 'runtime/nested/value.ts', 'export const n = 3;\n');
  put(project, 'runtime/types.d.ts', 'declare const globalValue: number;\n');
  put(project, 'data/not-runtime.ts', 'throw new Error("not copied");');
  put(output, 'runtime/stale.ts', 'old'); put(output, 'sections/keep.json', '{}');
  const seen: string[] = [], copied = writeRuntimeFiles(project, output, { check: (path, text) => { seen.push(path); return check(path, text); } });
  expect(copied.entry).toBe('runtime/index.ts');
  expect(copied.files.map(file => file.path)).toEqual(['runtime/index.ts', 'runtime/nested/value.ts', 'runtime/types.d.ts']);
  expect(seen).toHaveLength(3);
  for (const file of copied.files) {
    const original = readFileSync(join(project, file.path));
    expect(readFileSync(join(output, file.path))).toEqual(original);
    expect(file).toEqual({ path: file.path, bytes: original.length, hash: hashImmutableBytes(original), lines: codeLines(original.toString(), file.path) });
  }
  expect(copied.lines).toBe(4); expect(existsSync(join(output, 'runtime/stale.ts'))).toBe(false);
  expect(existsSync(join(output, 'data'))).toBe(false); expect(readFileSync(join(output, 'sections/keep.json'), 'utf8')).toBe('{}');
  expect(writeRuntimeFiles(project, output, { check })).toEqual(copied);
});
it('uses the ruler comment law for templates, regexes, strings and multiline comments', () => {
  const sources = ['// alone\n/* block\n * alone */\nexport const x = 1; // tail\n',
    `export const x = \`/* not a comment */\n// still text\n\${1 /* real */ + 2}\`;\n`,
    'const pattern = /[/*]+/u;\nexport const x = "// text";\n', '\uFEFF// BOM\r\nexport const x = 1;\r\n'];
  for (const source of sources) expect(runtimeCodeLines(source)).toBe(codeLines(source));
  expect(() => runtimeCodeLines('export const = ;')).toThrow('Invalid runtime');
});
it('refuses escaping imports, non-TS and symlinks before changing a previous output', () => {
  const { project, output } = fixture(); put(output, 'runtime/retained.ts', 'previous');
  put(project, 'runtime/index.ts', "import '../data/value';\n");
  expect(() => writeRuntimeFiles(project, output, { check })).toThrow();
  expect(readFileSync(join(output, 'runtime/retained.ts'), 'utf8')).toBe('previous');
  put(project, 'runtime/index.ts', 'export default 1;'); put(project, 'runtime/a.json', '{}');
  expect(() => writeRuntimeFiles(project, output, { check })).toThrow('TypeScript files only');
  rmSync(join(project, 'runtime/a.json')); symlinkSync(join(output, 'runtime/retained.ts'), join(project, 'runtime/link.ts'));
  expect(() => writeRuntimeFiles(project, output, { check })).toThrow('symlinks');
  expect(readFileSync(join(output, 'runtime/retained.ts'), 'utf8')).toBe('previous');
});
it('supports data-only projects and refuses incomplete entries and overlapping output', () => {
  const { project, output } = fixture(); expect(writeRuntimeFiles(project, output, { check })).toEqual({ files: [], lines: 0 });
  put(project, 'runtime/helper.ts', 'export const x = 1;');
  expect(() => writeRuntimeFiles(project, output, { check })).toThrow('runtime/index.ts');
  expect(() => writeRuntimeFiles(project, join(project, 'out'), { check })).toThrow('separate');
});

it('checks copied custom registries and constants against the emitted data before boot', () => {
  const sections = new Map<string, unknown>([['custom/probe',[1,2]],['ui/card',{}]]);
  const registry = { SECTIONS: { 'custom/probe': v.array(v.number()) } };
  const mirrors = [defineMirror('COUNT',2)];
  expect(() => validateRuntimeData(sections,registry,mirrors,{COUNT:2})).not.toThrow();
  expect(() => validateRuntimeData(sections,undefined,mirrors,{COUNT:2})).toThrow('SECTIONS');
  expect(() => validateRuntimeData(sections,{SECTIONS:{}},mirrors,{COUNT:2})).toThrow('no runtime schema');
  expect(() => validateRuntimeData(sections,{SECTIONS:{'custom/probe':v.string()}},mirrors,{COUNT:2})).toThrow();
  expect(() => validateRuntimeData(new Map(),registry,[],{})).toThrow('no emitted custom section');
  expect(() => validateRuntimeData(sections,registry,mirrors,{COUNT:3})).toThrow('COUNT');
  expect(() => validateRuntimeData(sections,registry,mirrors,undefined)).toThrow('runtime/const.ts');
});

it('admits immutable built schemas without shipping a registry and still checks mirrors', () => {
  const sections = new Map<string, unknown>([['custom/probe', [1, 2]]]);
  const bytes = new TextEncoder().encode(encodeCanonicalJson({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'array', items: { type: 'number' } }));
  const schemas = new Map([['custom/probe', bytes]]);
  expect(() => validateRuntimeData(sections, undefined, [], undefined, schemas)).not.toThrow();
  expect(() => validateRuntimeData(new Map([['custom/probe', ['wrong']]]), undefined, [], undefined, schemas)).toThrow('refuses');
  expect(() => validateRuntimeData(sections, undefined, [], undefined, new Map())).toThrow('no built schema');
  expect(() => validateRuntimeData(sections, undefined, [defineMirror('COUNT', 2)], { COUNT: 3 }, schemas)).toThrow('COUNT');
});

it('admits the compiled Driftwood source without copying retired runtime data', () => {
  const { output } = fixture();
  expect(writeRuntimeFiles(resolve('src/shards/driftwood-isle'), output, { check, clientPlan: true })).toEqual({ files: [], lines: 0 });
});
