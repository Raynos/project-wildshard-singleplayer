import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gridEntryDownloads} from './gridEntryDownloads';
import {writeSpawnManifests} from './entryTotals';

/** Publish the one immutable spawn list after the complete module bank.
 * No receipt observer or transport script runs ahead of the composition root. */
export function writeEntryBootstrap(outDir: string, root: string): void {
  const file = join(outDir, 'index.html'), html = readFileSync(file, 'utf8');
  const expression = /(<script type="application\/json" id="boot-module-files">)([^<]+)(<\/script>)/u;
  const match = expression.exec(html);
  if (match?.[2] === undefined) throw new Error('Missing entry module bank');
  const bank: unknown = JSON.parse(match[2]);
  if (typeof bank !== 'object' || bank === null || Array.isArray(bank)) throw new Error('Invalid entry module bank');
  const grid = gridEntryDownloads(root), spawnManifests = writeSpawnManifests(outDir, bank, grid, root);
  const json = JSON.stringify({...bank, gridEntryDownloads: grid, spawnManifests}).replaceAll('<', String.raw`\u003c`);
  writeFileSync(file, html.replace(expression, () => `<script type="application/json" id="boot-module-files">${json}</script>`));
}
