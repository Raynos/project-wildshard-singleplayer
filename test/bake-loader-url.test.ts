// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real Node import hook in a fresh process.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The disposable asset proves URL and JSON imports read the same bytes.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every fixture outside the shared source tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the defining loader and fixture paths.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the running Node version for its actual ESM admission rules.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- ESM specifiers must preserve the asset's file URL.
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

it('exports a JSON asset URL while preserving ordinary JSON attribute admission', () => {
  const root = mkdtempSync(join(tmpdir(), 'wildshard-bake-url-'));
  try {
    const file = join(root, 'layout.json'), url = pathToFileURL(file).href;
    writeFileSync(file, JSON.stringify({ ordinal: [3, 1, 4] }));
    const loader = resolve('scripts/bake-loader.mjs');
    const run = (source: string) => spawnSync(execPath, ['--import', loader, '--input-type=module', '-e', source], { encoding: 'utf8' });
    const admitted = run(`import asset from ${JSON.stringify(`${url}?url`)}; import value from ${JSON.stringify(url)} with {type:'json'}; console.log(JSON.stringify({asset,value}));`);
    expect(admitted.status, admitted.stderr).toBe(0);
    expect(JSON.parse(admitted.stdout)).toEqual({ asset: url, value: { ordinal: [3, 1, 4] } });
    const absentAttribute = run(`import value from ${JSON.stringify(url)}; console.log(value);`);
    expect(absentAttribute.status).not.toBe(0);
    expect(absentAttribute.stderr).toContain('ERR_IMPORT_ATTRIBUTE_MISSING');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
