import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import * as v from 'valibot';
import {packsBookPath, readSpawnManifest} from '@wildshard/format/spawnManifest';
import {StandaloneCatalogueSchema, type StandaloneCatalogue} from '@wildshard/format/standaloneCatalogue';
import {productTarball} from './productTarball';

/** C3 (J61, D7): every build bakes `catalogue.json`, so a build needs no server, and inlines it in `index.html`, so the
 * first paint waits on no new fetch. `WILDSHARD_CATALOGUE` names a file a deploy took from `api-server`'s
 * `/api/catalogue.json`; with none, the in-tree grid and this build's products say the same thing. */
const ELEMENT = /<script type="application\/json" id="ws-catalogue">[^<]*<\/script>/u;
/** J138: the shards cooked to R2 and its origin, for a page's spawn download. */
export interface PackHome {readonly base: string; readonly shards: readonly string[]}
const inline = (text: string): string => `<script type="application/json" id="ws-catalogue">${text.replaceAll('<', String.raw`\u003c`)}</script>`;

export function writeCatalogueDocument(outDir: string, document: unknown): void {
  const text = JSON.stringify(v.parse(StandaloneCatalogueSchema, document));
  writeFileSync(join(outDir, 'catalogue.json'), text);
  const file = join(outDir, 'index.html'), html = readFileSync(file, 'utf8');
  if (!html.includes('</head>')) throw new Error('No document head for the catalogue');
  writeFileSync(file, ELEMENT.test(html) ? html.replace(ELEMENT, () => inline(text)) : html.replace('</head>', () => `${inline(text)}</head>`));
}

interface Listed {readonly slug: string; readonly order?: number; readonly status?: string}

/** The in-tree grid with this build's heads: a product's slug, name and tarball hash, at revision 1. */
export function inTreeCatalogue(root: string, products: string, listed: readonly Listed[]): StandaloneCatalogue {
  const grid = JSON.parse(readFileSync(join(root, 'src/game/shared/grid/singleplayer.json'), 'utf8')) as Pick<StandaloneCatalogue, 'version' | 'placements' | 'grid'>;
  const rows = new Map(listed.map(row => [row.slug, row]));
  const placements = grid.placements.map(row => {
    const shard = rows.get(row.slug);
    return {...row, ...(shard?.order === undefined ? {} : {order: shard.order}), ...(shard?.status === undefined ? {} : {status: shard.status})};
  });
  const shards: StandaloneCatalogue['shards'] = [], missing: string[] = [];
  for (const row of placements) {
    const folder = join(products, row.slug), header = join(folder, 'shard.json');
    if (!existsSync(header)) { missing.push(row.slug); continue; }
    const index = JSON.parse(readFileSync(header, 'utf8')) as {readonly identity: {readonly slug: string; readonly name: string}};
    shards.push({slug: index.identity.slug, name: index.identity.name, revision: 1, hash: createHash('sha256').update(productTarball(folder)).digest('hex')});
  }
  return {version: grid.version, stage: 'live', placements, grid: grid.grid, shards, missing};
}

/** The build's step: the file a deploy names, else the tree's. */
export async function bakeCatalogue(outDir: string, root: string): Promise<void> {
  const {WILDSHARD_CATALOGUE: source} = process.env;
  const {shards} = await import('../../src/game/client/shard/list');
  const document = source === undefined ? inTreeCatalogue(root, join(root, 'out'), shards()) : v.parse(StandaloneCatalogueSchema, JSON.parse(readFileSync(source, 'utf8')));
  writeCatalogueDocument(outDir, document);
}

interface CookedManifest {readonly url: string; readonly tier: 'phone' | 'desktop'; readonly set: 'entry' | 'whole'; readonly files: number; readonly totalBytes: number; readonly wireBytes: number}
export interface CookedShard {
  readonly slug: string;
  readonly hash: string;
  readonly header: string;
  readonly manifests: readonly CookedManifest[];
  /** The row `buildValidationReceipts` writes for this product. */
  readonly verdict: unknown;
}

/** A catalogue shard this build has no code or table for, once its packs exist: each table a page reads names it, in files
 *  the bundle doesn't hash. Nothing under `/b/<build>/` changes, which is what "no client rebuild" means (C3). */
export function addCookedShards(outDir: string, shards: readonly CookedShard[], cooked: string = outDir, home?: PackHome): void {
  const {build} = JSON.parse(readFileSync(join(outDir, 'version.json'), 'utf8')) as {build: string};
  const file = join(outDir, 'index.html');
  let html = readFileSync(file, 'utf8');
  const expression = /(<script type="application\/json" id="boot-module-files">)([^<]+)(<\/script>)/u, match = expression.exec(html);
  if (match?.[2] === undefined) throw new Error('Missing entry module bank');
  const bank = JSON.parse(match[2]) as {spawnManifests: {client: Record<string, Record<string, unknown>>; home?: PackHome}};
  const bookFile = join(outDir, packsBookPath(build)), book = JSON.parse(readFileSync(bookFile, 'utf8')) as {client?: Record<string, Record<string, unknown>>};
  const verdicts: unknown[] = [];
  for (const shard of shards) {
    const address = (row: CookedManifest): unknown => {
      const bytes = readFileSync(join(cooked, row.url.slice(1)));
      readSpawnManifest(JSON.parse(bytes.toString('utf8')));
      return {url: row.url, bytes: bytes.length, totalBytes: row.totalBytes, files: row.files, wireBytes: row.wireBytes};
    };
    const pick = (set: 'entry' | 'whole'): Record<string, unknown> => Object.fromEntries(shard.manifests.filter(row => row.set === set).map(row => [row.tier, address(row)]));
    bank.spawnManifests.client[shard.slug] = pick('entry');
    (book.client ??= {})[shard.slug] = pick('whole');
    verdicts.push(shard.verdict);
  }
  if (home !== undefined) bank.spawnManifests.home = home;
  writeFileSync(bookFile, JSON.stringify(book));
  html = html.replace(expression, () => `<script type="application/json" id="boot-module-files">${JSON.stringify(bank).replaceAll('<', String.raw`\u003c`)}</script>`);
  const stamp = /globalThis\.__WS_SHARDFILE_VERDICTS__=(\[.*?\]);?<\/script>/su, stamped = stamp.exec(html);
  if (stamped?.[1] === undefined) throw new Error('Missing validation verdicts');
  const before = JSON.parse(stamped[1]) as unknown[];
  writeFileSync(file, html.replace(stamp, () => `globalThis.__WS_SHARDFILE_VERDICTS__=${JSON.stringify([...before, ...verdicts]).replaceAll('<', String.raw`\u003c`)};</script>`));
}

