// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the emitted server handler in real Node, outside Vitest's resolver.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The regression owns and retires its emitted function directory.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Emitted server files belong in a temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the server source and emitted paths.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the same Node runtime as the test process.
import { execPath } from 'node:process';
import ts from '@typescript/typescript6';
import { expect, it } from 'vitest';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

it.each(['inbox', 'errors', 'telemetry'])('loads emitted %s in plain Node and rejects invalid passwords before Blob access', (endpoint) => {
  // Vitest resolves extensionless TypeScript siblings; deployed Node ESM requires the emitted .js suffix.
  const root = resolve(import.meta.dirname, '..');
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'api-node-entrypoints-')));
  try {
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    for (const path of ['api/inbox', 'api/errors', 'api/telemetry', 'api/_blobStore', 'api/_crossroads',
      'src/engine/core/crossroads', 'src/engine/core/config']) {
      const source = readFileSync(join(root, `${path}.ts`), 'utf8');
      const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      const target = join(directory, `${path}.js`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, emitted.outputText);
    }
    linkNodeModules(root, directory);
    const result = spawnSync(execPath, ['--input-type=module', '-e', `
      delete process.env.BLOB_READ_WRITE_TOKEN;
      const name = process.argv[1], statuses = [];
      const { GET, cleanRecord } = await import('./api/' + name + '.js');
      const request = new Request('https://example.test/api/' + name, { headers: { 'x-review-password': 'invalid' } });
      process.env.REVIEW_PASSWORD = 'local-entrypoint-fixture';
      statuses.push([name, (await GET(request)).status]);
      delete process.env.REVIEW_PASSWORD;
      statuses.push([name + ':unconfigured', (await GET(request)).status]);
      if (name === 'telemetry') {
        const { CROSSROADS_CONFIG } = await import('./src/engine/core/crossroads.js');
        const record = cleanRecord({ kind: 'crossroads', build: 'fixture', install: 'anonymous',
          rigVersion: 1, series: 'fixture', run: 'fixture/1', iteration: 1, stage: 'started',
          config: CROSSROADS_CONFIG, context: { userAgent: 'Node', viewport: [402, 874], dpr: 3,
            standalone: true, origin: 'hosted' } });
        statuses.push(['crossroads:shared-config', record?.rig?.config === CROSSROADS_CONFIG]);
      }
      console.log(JSON.stringify(statuses));
    `, endpoint], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      [endpoint, 401], [`${endpoint}:unconfigured`, 503],
      ...(endpoint === 'telemetry' ? [['crossroads:shared-config', true]] : []),
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
