import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createHash } from 'node:crypto';
import { safariRecorder } from './safari-data.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';

/** Only modify an owned served export. The original bytes are restored only if the exact fixture is intact. */
export function installSafariFixture(dist) {
  const html = resolvePath(dist, 'index.html'), setup = resolvePath(dist, 'sf67-start.html');
  if (!html.includes('/wildshard-serve/') || existsSync(resolvePath(dist, 'package.json')) || existsSync(setup)) throw new Error('Requires an owned clean served export');
  const original = readFileSync(html, 'utf8');
  if (original.includes('data-sf67-safari')) throw new Error('Safari fixture already installed');
  const injected = `<script data-sf67-safari>(${safariRecorder.toString()})();</script>`;
  const patched = original.replace('<head>', `<head>${injected}`);
  if (patched === original || patched.replace(injected, '') !== original) throw new Error('Cannot inject first-HTML recorder');
  writeFileSync(html, patched);
  const start = developer => `<!doctype html><script>${saveFixtureCode({ scope: 'device', key: 'devMode', data: developer })};${saveFixtureCode({ scope: 'global', key: 'settings', data: { volume: 0 }, merge: true })};location.replace('/');</script>`;
  return {
    originalSHA256: createHash('sha256').update(original).digest('hex'),
    injectedSHA256: createHash('sha256').update(patched).digest('hex'),
    start(developer) { writeFileSync(setup, start(developer)); },
    close() {
      if (readFileSync(html, 'utf8') !== patched) throw new Error('Owned preview HTML changed; refusing to overwrite another edit');
      writeFileSync(html, original); unlinkSync(setup);
    },
  };
}
