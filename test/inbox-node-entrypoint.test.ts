// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the emitted server handler in real Node, outside Vitest's resolver.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The regression owns and retires its emitted function directory.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Emitted server files belong in a temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the server source and emitted paths.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the same Node runtime as the test process.
import { execPath } from 'node:process';
import ts from '@typescript/typescript6';
import { expect, it } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

it('loads the emitted inbox in plain Node and rejects invalid passwords before Blob access', () => {
  // Vitest resolves extensionless TypeScript siblings; deployed Node ESM requires the emitted .js suffix.
  const root = resolve(import.meta.dirname, '..');
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'api-node-entrypoints-')));
  try {
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    for (const name of ['inbox', '_blobStore']) {
      const source = readFileSync(join(root, 'api', `${name}.ts`), 'utf8');
      const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      writeFileSync(join(directory, `${name}.js`), emitted.outputText);
    }
    linkNodeModules(root, directory);
    const result = spawnSync(execPath, ['--input-type=module', '-e', `
      delete process.env.BLOB_READ_WRITE_TOKEN;
      const statuses = [];
      for (const name of ['inbox']) {
        const { GET } = await import('./' + name + '.js');
        const request = new Request('https://example.test/api/' + name, { headers: { 'x-review-password': 'invalid' } });
        process.env.REVIEW_PASSWORD = 'local-entrypoint-fixture';
        statuses.push([name, (await GET(request)).status]);
        delete process.env.REVIEW_PASSWORD;
        statuses.push([name + ':unconfigured', (await GET(request)).status]);
      }
      console.log(JSON.stringify(statuses));
    `], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      ['inbox', 401], ['inbox:unconfigured', 503],
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
