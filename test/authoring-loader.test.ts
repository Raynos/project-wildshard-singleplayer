// oxlint-disable-next-line import/no-nodejs-modules -- Run the real Node resolver in an isolated source fixture.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Each test owns its complete source and output tree.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures live outside the checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths stay inside the owned directory.
import { dirname, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the installed Node executable in a child process.
import process from 'node:process';
import { expect, it } from 'vitest';

function fixture(): { put: (path: string, source: string) => void; run: () => string; close: () => void } {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'authoring-loader-')));
  const put = (path: string, source: string): void => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); };
  for (const file of ['src/sdk/bake/source-loader.mjs', 'src/sdk/bake/json.mjs']) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true }); copyFileSync(resolve(file), resolve(root, file));
  }
  return { put, run: () => {
    execFileSync(process.execPath, ['--import', './src/sdk/bake/source-loader.mjs', 'src/sdk/bake/json.mjs', 'src/shards/sample/generators/rows.ts', 'rows', 'src/shards/sample/data/output.json'], { cwd: root, stdio: 'pipe' });
    return readFileSync(resolve(root, 'src/shards/sample/data/output.json'), 'utf8');
  }, close: () => { rmSync(root, { recursive: true, force: true }); } };
}
it('runs an extensionless typed authoring recipe without installing any game or simulation services', () => {
  const f = fixture();
  try {
    f.put('src/shards/sample/generators/rows.ts', "import { value } from '../data/input'; export function rows(): number[] { return [value]; }");
    f.put('src/shards/sample/data/input.ts', 'export const value: number = 7;');
    expect(f.run()).toBe('[7]\n');
  } finally { f.close(); }
});
it.each(['src/game/state.ts', 'src/engine/state.ts', 'src/sdk/runtime/state.ts', 'src/shards/sample/runtime/state.ts', 'src/shards/sample-legacy/data/state.ts', 'src/shards/other/data/state.ts'])('refuses computed imports into %s before evaluating them', file => {
  const f = fixture();
  try {
    f.put(file, "throw new Error('trusted module executed');");
    f.put('src/shards/sample/generators/rows.ts', `export async function rows(): Promise<unknown> { const source = '../../../..//${file}'; return import(source); }`);
    expect(f.run).toThrow(/Non-authoring dependency refused/u);
  } finally { f.close(); }
});
