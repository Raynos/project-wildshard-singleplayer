// DL22: record a shard's pre-control reads that its default spawn set lacks, from a cold phone-loading run against a
// preview, as stable identities (src/format/fenceReads.ts) in src/shards/<slug>/fence-reads.json. The build's default set
// then carries them (scripts/app-build/entryReadSet.ts, entryTotals.ts), so the setup steps no longer fetch them on demand.
//
//   node --import ./scripts/bake-loader.mjs scripts/record-fence-reads.mjs --run=<cold run .json> --base=<preview URL>
//        --dist=<the preview's dist> --slug=<shard> [--flow=client|grid] [--check]
// The run must be a qualified cold phone run of that entry on the served preview's build, its control witness on that
// shard (a grid run: its grid home). Scope: page requests between the tap and control under /shardfiles/<slug>/ and the
// shell's /assets files (asset packs, gpu models, sfx, music, hdri, baked; not code, boot tables or spawn files);
// title-started, worker and member-only reads are not seen, and a grid run is read against the grid mode 000 book.
// --check reports what the run read outside the spawn set without writing (0 = the recorded list holds).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { assetIdentities, fenceReadAliases, fenceReadIdentities, packPartIdentities, readFenceReads } from '../src/format/fenceReads.ts';

const { values } = parseArgs({ options: { run: { type: 'string' }, base: { type: 'string' }, dist: { type: 'string' }, slug: { type: 'string' },
  flow: { type: 'string', default: 'client' }, check: { type: 'boolean', default: false } } });
const { run: runPath, base, dist, slug, flow, check } = values;
if (!runPath || !base || !dist || !slug || !/^[a-z0-9-]+$/u.test(slug) || (flow !== 'client' && flow !== 'grid')) throw new Error('usage: --run --base --dist --slug [--flow] [--check]');
const run = JSON.parse(readFileSync(runPath, 'utf8'));
const control = run.control ?? run.controlEventAt;
if (typeof control !== 'number') throw new Error('The run never reached control: no pre-control list to record');
// The run, the served preview and the product read here must be one build and one entry (sp-x8's review).
const served = (await (await fetch(new URL('version.json', base))).json()).build, built = JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8')).build;
const runBuild = typeof run.build === 'string' ? run.build : run.build?.build;
if (served !== built || runBuild !== served) throw new Error(`Builds differ: run ${runBuild}, served ${served}, dist ${built}`);
const wantedFlow = flow === 'grid' ? 'grid' : `select:${slug}`;
if (run.flow !== wantedFlow || run.preset !== 'phone' || run.cache !== 'cold') throw new Error(`The run is ${run.flow} ${run.preset} ${run.cache}, not ${wantedFlow} phone cold`);
// The control witness names the entered shard (a grid run: its home), so a run of another home can't pass for this one.
const witness = run.controlWitness ?? {}, home = flow === 'grid' ? witness.gridHome?.slug ?? witness.gridHome : witness.shard;
if (run.qualified !== true || home !== slug) throw new Error(`The run's control witness is ${JSON.stringify(home)} (qualified ${run.qualified}), not ${slug}`);
const html = await (await fetch(new URL('/', base))).text();
const bank = JSON.parse(/id="boot-module-files">([^<]+)</u.exec(html)?.[1] ?? 'null');
const address = flow === 'grid' ? bank.spawnManifests.grid['000'][slug].phone : bank.spawnManifests.client[slug].phone;
const manifest = await (await fetch(new URL(address.url, base))).json();
const listed = new Set(manifest.files.map(row => row.url.split('?')[0]));
const prefix = `/shardfiles/${slug}/`, shell = /^\/assets\/(?!spawn\/|boot-tables-)[^?]+$/u, code = /\.(?:js|mjs|css|map)$/u;
const outside = new Set(), assetsOutside = new Set();
let matched = 0;
for (const row of run.requests) {
  if (row.start < run.tap || row.start > control) continue;
  let path; try { path = new URL(row.url).pathname; } catch { continue; }
  if (path.startsWith(prefix)) matched++;
  if (listed.has(path)) continue;
  if (path.startsWith(prefix) && !path.endsWith('/shard.json')) outside.add(/([a-f0-9]{64})/u.exec(path)?.[1] ?? path);
  else if (shell.test(path) && !code.test(path)) assetsOutside.add(path);
}
// Only the home's own reads before control count as its witness (sp-x8's review).
if (matched === 0) throw new Error(`The run read nothing under ${prefix} before control: not a ${slug} run`);
const product = join(dist, 'shardfiles', slug), index = JSON.parse(readFileSync(join(product, 'shard.json'), 'utf8'));
const sections = new Map(index.sections.map(row => [row.name, JSON.parse(readFileSync(join(product, row.path), 'utf8'))]));
const identities = fenceReadIdentities(index.files, sections), recorded = [], unknown = [];
for (const hash of outside) { const aliases = fenceReadAliases(identities, hash); if (aliases.length === 0) unknown.push(hash); else recorded.push(...aliases); }
// /assets: this build's files and its boot tables' pack parts.
const assetUrls = readdirSync(join(dist, 'assets'), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
  .map(entry => `/${relative(dist, join(entry.parentPath, entry.name)).split(sep).join('/')}`);
const parts = new Map();
for (const url of assetUrls.filter(name => /^\/assets\/boot-tables-[a-f0-9]{8}\.json$/u.test(name))) {
  for (const [part, identity] of packPartIdentities(JSON.parse(readFileSync(join(dist, url.slice(1)), 'utf8')).packs)) parts.set(part, identity);
}
const assetIds = assetIdentities(assetUrls, parts);
for (const path of assetsOutside) { const identity = assetIds.get(path); if (identity === undefined) unknown.push(path); else recorded.push(identity); }
const total = outside.size + assetsOutside.size;
console.log(`${slug} ${flow}: control at ${((control - run.tap) / 1000).toFixed(1)} s; ${outside.size} level and ${assetsOutside.size} /assets files read before control outside the spawn set; ${unknown.length} unidentified`);
for (const name of unknown) console.log(`  unidentified ${name}`);
if (check) { if (total > 0) throw new Error(`${total} files read before control are not in the spawn set`); }
else {
  const file = join('src/shards', slug, 'fence-reads.json');
  if (unknown.length > 0) throw new Error(`${unknown.length} files have no stable identity; nothing written`);
  let previous = [];
  // Only a missing list is a first recording; a malformed one refuses (sp-x8's review).
  try { previous = readFenceReads(JSON.parse(readFileSync(file, 'utf8'))).files; }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const merged = readFenceReads({ version: 1, files: [...previous, ...recorded] });
  writeFileSync(file, `${JSON.stringify(merged, null, 1)}\n`);
  console.log(`wrote ${file}: ${merged.files.length} identities (${merged.files.length - previous.length} new)`);
}
