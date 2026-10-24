// oxlint-disable-next-line import/no-nodejs-modules -- Run the real linter on isolated production and test files.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and clean only the tiny lint fixture.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed CLI and fixture paths explicitly.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { TEST_DOMAIN_RUNTIME_RULES } from '../lint/wildshard-plugin.js';

test('colocated fixtures keep product guards in production and architecture guards in tests', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/test-domain-'));
  const put = (path: string, source: string): string => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); return file; };
  const config = put('config.json', JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: {
    ...Object.fromEntries(TEST_DOMAIN_RUNTIME_RULES.map(name => [`wildshard/${name}`, 'error'])),
    'wildshard/layer': 'error', 'wildshard/no-module-mock': 'error', 'wildshard/no-production-test-import': 'error',
  } }));
  const run = (file: string): ReturnType<typeof spawnSync> => spawnSync(resolve('node_modules/.bin/oxlint'), ['--no-ignore', '-c', config, file], { encoding: 'utf8', timeout: 10_000 });
  const code = 'const label = "Pine loot"; const node = document.createElement("div"); node.textContent = "Play now"; node.innerHTML = document.title; document.body.appendChild(node); export { label };';
  try {
    const fixture = put('src/engine/core/fixture.test.ts', code), production = put('src/engine/core/fixture.ts', code);
    const allowed = run(fixture); expect(allowed.status, String(allowed.stdout) + String(allowed.stderr)).toBe(0);
    const refused = run(production), output = String(refused.stdout) + String(refused.stderr);
    expect(refused.status).not.toBe(0);
    for (const name of ['engine-words', 'no-inline-ui-string', 'no-authored-html', 'no-global-listener-patch', 'no-raw-hud']) expect(output).toContain(name);
    const forbidden = put('src/engine/core/boundary.test.ts', 'import {value} from "../../game/value"; import {vi} from "vitest"; vi.mock("./value"); export {value};');
    const boundary = run(forbidden), messages = String(boundary.stdout) + String(boundary.stderr);
    expect(boundary.status).not.toBe(0); expect(messages).toContain('wildshard(layer)'); expect(messages).toContain('no-module-mock');
    const builder = 'import binaryen from "binaryen"; export const wasm = binaryen;';
    const formatFixture = run(put('src/format/binary.test.ts', builder));
    expect(formatFixture.status, String(formatFixture.stdout) + String(formatFixture.stderr)).toBe(0);
    const formatProduction = run(put('src/format/binary.ts', builder));
    expect(formatProduction.status).not.toBe(0);
    expect(String(formatProduction.stdout) + String(formatProduction.stderr)).toContain('wildshard(layer)');
    const formatUpward = run(put('src/format/upward.test.ts', 'import {value} from "../engine/value"; export {value};'));
    expect(formatUpward.status).not.toBe(0);
    expect(String(formatUpward.stdout) + String(formatUpward.stderr)).toContain('wildshard(layer)');
    for (const statement of ['import "./fixture.test";', 'export * from "./fixture.test.ts";', 'void import("./fixture.test.js");', 'export type Value = typeof import("./fixture.test");']) {
      const imports = run(put('src/engine/core/importer.ts', statement));
      expect(imports.status).not.toBe(0); expect(String(imports.stdout) + String(imports.stderr)).toContain('no-production-test-import');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
