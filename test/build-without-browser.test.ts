// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real subprocess/preload boundary of the build.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Reuse the executable running this contract.
import process from 'node:process';
import { expect, it } from 'vitest';

it('allows build work but refuses every browser launch, including inherited child launches', () => {
  const source = `
    import { chromium, firefox, webkit } from 'playwright';
    import { spawnSync } from 'node:child_process';
    for (const browser of [chromium, firefox, webkit]) for (const method of ['launch', 'launchServer', 'launchPersistentContext', 'connect']) {
      try { await browser[method](''); throw Error('Browser bypassed fence'); }
      catch (error) { if (error.message !== 'DS1.5: browsers are disabled during this build') throw error; }
    }
    try { await chromium.connectOverCDP(''); throw Error('CDP bypassed fence'); }
    catch (error) { if (error.message !== 'DS1.5: browsers are disabled during this build') throw error; }
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import { chromium } from 'playwright'; await chromium.launch()"], { encoding: 'utf8' });
    if (child.status !== 1 || !child.stderr.includes('DS1.5: browsers are disabled during this build')) throw Error('Child bypassed fence');
    console.log('build work completed without browsers');
  `;
  const result = spawnSync(process.execPath, ['scripts/build-without-browser.mjs', '--', process.execPath, '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('build work completed without browsers');
});


it('refuses missing commands and malformed separators before spawning a child', () => {
  for (const args of [[], ['--'], ['node'], ['wrong', process.execPath]]) {
    const result = spawnSync(process.execPath, ['scripts/build-without-browser.mjs', ...args], { encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: build-without-browser.mjs');
  }
});
