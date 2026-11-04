import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gridEntryDownloads} from './gridEntryDownloads';
import {writeSpawnManifests} from './entryTotals';
import {packsBookPath} from '../../src/format/spawnManifest';

/** Publish the one immutable spawn list after the complete module bank.
 * No receipt observer or transport script runs ahead of the composition root. */
export function writeEntryBootstrap(outDir: string, root: string): void {
  const file = join(outDir, 'index.html'), html = readFileSync(file, 'utf8');
  const expression = /(<script type="application\/json" id="boot-module-files">)([^<]+)(<\/script>)/u;
  const match = expression.exec(html);
  if (match?.[2] === undefined) throw new Error('Missing entry module bank');
  const bank: unknown = JSON.parse(match[2]);
  if (typeof bank !== 'object' || bank === null || Array.isArray(bank)) throw new Error('Invalid entry module bank');
  const grid = gridEntryDownloads(root), {packs, ...spawnManifests} = writeSpawnManifests(outDir, bank, grid, root);
  // DL16: the packs book (the whole level with its parts) is its own file, named by the build id the page's code
  // carries (__BUILD_ID__), so the default index.html says nothing about an off row (spawnDownload prepareSpawnPacks).
  const {build} = JSON.parse(readFileSync(join(outDir, 'version.json'), 'utf8')) as {build: string};
  if (!/^[A-Za-z0-9_-]{4,64}$/u.test(build)) throw new Error('Invalid build id for the packs book');
  // `book` and `build` bind it to its purpose and build: the reader refuses any other book at this URL.
  writeFileSync(join(outDir, packsBookPath(build)), JSON.stringify({book: 'packs', build, cacheName: spawnManifests.cacheName, ...packs}));
  const json = JSON.stringify({...bank, gridEntryDownloads: grid, spawnManifests}).replaceAll('<', String.raw`\u003c`);
  writeFileSync(file, html.replace(expression, () => `<script type="application/json" id="boot-module-files">${json}</script>`));
}
