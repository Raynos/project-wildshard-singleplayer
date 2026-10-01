// oxlint-disable-next-line import/no-nodejs-modules -- Node fixture invokes the actual linter on planted source.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The linter fixture owns and removes its isolated temporary tree.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary Node-side fixture paths.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary Node-side fixture paths.
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

interface Output { diagnostics: { code: string }[] }
const root = mkdtempSync(join(tmpdir(), 'e357-inline-'));
afterAll(() => { rmSync(root, { recursive: true }); });
function count(source: string, file = 'src/engine/ui/string-fixture.ts'): number {
  const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source);
  const result = spawnSync('node_modules/.bin/oxlint', ['-c', '.oxlintrc.ratchet.json', '-f', 'json', path], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const output = JSON.parse(result.stdout) as Output;
  return output.diagnostics.filter((diagnostic) => diagnostic.code === 'wildshard(no-inline-ui-string)').length;
}
describe('inline UI string lint', () => {
  it('rejects labels, both text assignments, toasts, and conditional/template text', () => {
    expect(count("const row={label:'Play'}; el.textContent='Resume'; el.innerText='Close'; ui.toast('Saved');")).toBe(4);
    expect(count(`el.textContent = ok ? 'Ready' : \`Waiting \${n}\`;`)).toBe(2);
  });
  it('accepts typed keys, empty text clears, dynamic content, CSS names and content-owned strings', () => {
    expect(count("const row={label:engineString('key')}; el.textContent=''; el.innerText=value; el.className='ws-label'; toast(engineString('key',[n]));")).toBe(0);
    expect(count("const row={label:'Camp'};", 'src/shards/sample/plugin.ts')).toBe(0);
  });
});
