// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shell preview-config block without an app build.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only the isolated fixture's temporary paths.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture's files never enter the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Generate native fixture paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the host preview module explicitly.
import process from 'node:process';
import { loadConfigFromFile } from 'vite';
import { expect, it } from 'vitest';

it.for([false, true])('loads the pure preview config when the pinned tree has the module: %s', async (current) => {
  const shell = readFileSync('scripts/serve-build.sh', 'utf8');
  const start = shell.indexOf('PREVIEW_MODULE='), end = shell.indexOf('\nJS', start);
  if (start === -1 || end === -1) throw new Error('Missing actual preview-config block');
  const dir = mkdtempSync(join(tmpdir(), 'historical-preview-')), source = join(dir, 'source'), config = join(dir, 'preview.mjs');
  try {
    mkdirSync(source);
    if (current) symlinkSync(join(process.cwd(), 'vite'), join(source, 'vite'));
    execFileSync('bash', ['-c', shell.slice(start, end + 3)], {
      env: { ...process.env, SRC: source, REPO: process.cwd(), PREVIEW_CFG: config },
    });
    const text = readFileSync(config, 'utf8');
    const expected = join(current ? source : process.cwd(), 'vite', 'preview.ts');
    expect(existsSync(expected)).toBe(true);
    expect(text).toContain(`from '${expected}'`);
    expect(text).toContain(`root: '${source}'`);
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'production', isPreview: true }, config, source);
    expect(loaded?.config.root).toBe(source);
    expect(loaded?.config.plugins?.length).toBe(2);
    expect(text).not.toContain('vite.config.ts');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
