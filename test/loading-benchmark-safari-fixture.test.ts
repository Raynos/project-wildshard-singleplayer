// oxlint-disable-next-line import/no-nodejs-modules -- Own disposable served-export fixture files.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture filesystem paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the platform temporary directory in CI.
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { installSafariFixture } from '../scripts/loading-benchmark/safari-fixture.mjs';

it('instruments only a served HTML export and restores exact bytes without overwriting a subsequent edit', () => {
  const parent = join(tmpdir(), 'wildshard-serve'); mkdirSync(parent, { recursive: true });
  const dist = mkdtempSync(join(parent, 'x5-sf67-fixture-test-'));
  const html = join(dist, 'index.html');
  const original = '<!doctype html><html><head><title>fixture</title></head><body></body></html>';
  writeFileSync(html, original);
  const fixture = installSafariFixture(dist), instrumented = readFileSync(html, 'utf8');
  try {
    fixture.start(false);
    expect(fixture.injectedSHA256).not.toBe(fixture.originalSHA256);
    expect(instrumented).toContain('data-sf67-safari');
    expect(() => installSafariFixture(dist)).toThrow('owned clean served export');
    writeFileSync(html, `${instrumented}<!-- foreign edit -->`);
    expect(() => fixture.close()).toThrow('refusing to overwrite');
    expect(readFileSync(html, 'utf8')).toContain('foreign edit');
    writeFileSync(html, instrumented); fixture.close();
    expect(readFileSync(html, 'utf8')).toBe(original);
  } finally {
    if (readFileSync(html, 'utf8') !== original) { writeFileSync(html, instrumented); fixture.close(); }
    unlinkSync(html); rmdirSync(dist);
  }
  expect(() => installSafariFixture('.')).toThrow('owned clean served export');
});
