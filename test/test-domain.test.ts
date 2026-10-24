// oxlint-disable-next-line import/no-nodejs-modules -- Run the real linter on isolated production and test files.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and clean only the tiny lint fixture.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed CLI and fixture paths explicitly.
import { dirname, resolve } from 'node:path';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { TEST_DOMAIN_RUNTIME_RULES } from '../lint/wildshard-plugin.js';

test('colocated fixtures keep product guards in production and architecture guards in tests', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/test-domain-'));
  const put = (path: string, source: string): string => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); return file; };
  const config = put('config.json', JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: {
    ...Object.fromEntries(TEST_DOMAIN_RUNTIME_RULES.map(name => [`wildshard/${name}`, 'error'])),
    'wildshard/layer': 'error', 'wildshard/no-module-mock': 'error', 'wildshard/no-production-test-import': 'error',
  } }));
  const run = (files: readonly string[]): ReturnType<typeof spawnSync> => spawnSync(resolve('node_modules/.bin/oxlint'),
    ['--threads=1', '--no-ignore', '-c', config, '-f', 'json', ...files], { encoding: 'utf8', timeout: 10_000 });
  const code = 'const label = "Pine loot"; const node = document.createElement("div"); node.textContent = "Play now"; node.innerHTML = document.title; document.body.appendChild(node); export { label };';
  const rejected: { file: string; rules: readonly string[] }[] = [];
  const refuses = (path: string, source: string, rules: readonly string[]): void => { rejected.push({ file: put(path, source), rules }); };
  try {
    const builder = 'import binaryen from "binaryen"; export const wasm = binaryen;';
    const allowed = run([put('src/engine/core/fixture.test.ts', code), put('src/engine/test/helper.ts', code), put('src/format/binary.test.ts', builder)]);
    expect(allowed.status, String(allowed.error ?? '') + String(allowed.stdout) + String(allowed.stderr)).toBe(0);
    refuses('src/engine/core/fixture.ts', code, ['engine-words', 'no-inline-ui-string', 'no-authored-html', 'no-global-listener-patch', 'no-raw-hud']);
    refuses('src/engine/core/boundary.test.ts', 'import {value} from "../../game/value"; import {vi} from "vitest"; vi.mock("./value"); export {value};', ['layer', 'no-module-mock']);
    refuses('src/format/binary.ts', builder, ['layer']);
    refuses('src/format/upward.test.ts', 'import {value} from "../engine/value"; export {value};', ['layer']);
    const statements = ['import "./fixture.test";', 'export * from "./fixture.test.ts";', 'void import("./fixture.test.js");', 'export type Value = typeof import("./fixture.test");',
      'import "../test/helper";', 'export * from "../test/helper";', 'void import("../test/helper");', 'export type Helper = typeof import("../test/helper");'];
    statements.forEach((source, index) => { refuses(`src/engine/core/importer-${index}.ts`, source, ['no-production-test-import']); });
    const result = run(rejected.map(row => row.file));
    expect(result.status, String(result.error ?? '') + String(result.stdout) + String(result.stderr)).toBe(1);
    const output = v.parse(v.object({ diagnostics: v.array(v.object({ filename: v.string(), code: v.string() })) }), JSON.parse(String(result.stdout)));
    for (const row of rejected) {
      const codes = output.diagnostics.filter(diagnostic => resolve(diagnostic.filename) === row.file).map(diagnostic => diagnostic.code);
      for (const rule of row.rules) expect(codes, row.file).toContain(`wildshard(${rule})`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
