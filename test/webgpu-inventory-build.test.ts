// oxlint-disable-next-line import/no-nodejs-modules -- Execute the same source inventory CLI that CI builds and verifies.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture owns source and derived report bytes, removed in finally.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture lives outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Join only fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the actual test runner's Node version.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('generates the cheap inventory in a sparse export and still refuses a stale source report', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webgpu-inventory-'))), script = join(root, 'scripts/webgpu-inventory.mjs');
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'src/engine/render'), { recursive: true });
    copyFileSync('scripts/webgpu-inventory.mjs', script);
    const source = join(root, 'src/engine/render/fixture.ts');
    writeFileSync(source, 'const material = new ShaderMaterial();\n');
    const run = (...args: string[]) => spawnSync(execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 5000 });
    const fresh = run(); expect(fresh.status, fresh.stderr).toBe(0);
    expect(readFileSync(join(root, 'docs/design/webgpu-port-inventory.md'), 'utf8')).toContain('src/engine/render/fixture.ts');
    expect(run('--check').status).toBe(0);
    writeFileSync(source, 'const material = new ShaderMaterial(); const other = new RawShaderMaterial();\n');
    expect(run('--check').status).toBe(1);
    expect(run().status).toBe(0); expect(run('--check').status).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
