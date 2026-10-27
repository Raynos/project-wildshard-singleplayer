/// <reference types="node" />
/** LD4: data-only Explorer comparison. Run with Node's existing bake loader.
 * Each side gets a fresh process: defineModel's identity registry is global.
 * A missing/late runtime list is a coverage gap, never an empty passing list.
 * No world, model geometry, browser, product build or legacy deletion runs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from '@typescript/typescript6';
import { parseOutputIndex, assembleOutputShardfile } from '@wildshard/format/outputIndex';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { explorerRoster } from '../src/game/models/explorerCatalogue';

const slugs = ['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack', 'far-reach', 'sunscar-dunes'];
type Lists = Record<'models' | 'sets' | 'world' | 'arenas', string[] | null>;
interface Fields extends Record<string, unknown> { lists?: unknown; features?: unknown; kind?: unknown; rows?: unknown; manifest?: unknown; pois?: unknown; default?: unknown; course?: unknown; ROSTER?: unknown }
interface Capture { lists: Lists; gaps: string[]; inputs: Record<string, string> }
const root = process.cwd();
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
function object(value: unknown): Fields {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Fields;
}
function rows(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Expected rows'); return value; }
function ids(value: unknown, key = 'id'): string[] {
  return rows(value).map(row => { const id = object(row)[key]; if (typeof id !== 'string') throw new Error(`Missing ${key}`); return id; });
}
function sorted(values: readonly string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }

/** Literal declarations are separate from runtime membership. Keep every
 * conditional/dynamic registration visible in the coverage gap below. */
function legacySets(slug: string, inputs: Record<string, string>): string[] {
  const files = execFileSync('git', ['ls-files', `src/shards/${slug}-legacy`], { encoding: 'utf8' }).trim().split('\n');
  const result: string[] = [];
  for (const file of files.filter(name => name.endsWith('.ts'))) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('placeSet(')) continue;
    inputs[file] = hash(source);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const collect = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const properties = node.properties.filter(ts.isPropertyAssignment);
        const property = properties.find(row => row.name.getText(tree) === 'id') ?? properties.find(row => row.name.getText(tree) === 'place');
        if (property !== undefined && ts.isStringLiteral(property.initializer) && property.initializer.text.startsWith(`${slug}/`)) result.push(property.initializer.text);
      }
      ts.forEachChild(node, collect);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ['SETS', 'PLACE_SETS', 'REGIONS'].includes(node.name.getText(tree)) && node.initializer !== undefined) collect(node.initializer);
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'placeSet') for (const argument of node.arguments) collect(argument);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return sorted(result);
}

async function capture(slug: string, side: string): Promise<Capture> {
  const inputs: Record<string, string> = {}, gaps: string[] = [];
  const lists: Lists = { models: null, sets: null, world: null, arenas: null };
  if (side === 'legacy') {
    const module = async (file: string): Promise<Fields> => {
      inputs[file] = hash(readFileSync(file));
      const value: unknown = await import(pathToFileURL(resolve(file)).href); return object(value);
    };
    const { installLegacyKitSpecies } = await import('../src/game/systems/species/install');
    await installLegacyKitSpecies();
    if (slug === 'nalati-grasslands') (await import('../src/shards/nalati-grasslands-legacy/species/rows')).installNalatiSpeciesForTests();
    if (slug === 'driftwood-isle') (await import('../src/shards/driftwood-isle-legacy/species/install')).installDriftwoodSpecies();
    lists.models = ids((await module(`src/shards/${slug}-legacy/roster.ts`)).ROSTER);
    const manifest = object((await module(`src/shards/${slug}-legacy/manifest.ts`)).default);
    lists.world = ids(manifest.pois ?? []);
    lists.sets = legacySets(slug, inputs);
    lists.arenas = ['practice'];
    if (slug === 'nine-dragon-stack') lists.arenas.push((await import('../src/shards/nine-dragon-stack-legacy/playground/registration')).GRAPPLE_PLAYGROUND.id);
    if (slug === 'nalati-grasslands') lists.arenas.push((await import('../src/shards/nalati-grasslands-legacy/playground/registration')).horsePlayground(null).id);
    gaps.push('models: roster captured; world-placement registrations require a separate native world-list adapter');
    gaps.push('sets: literal id/place declaration union; conditional membership and computed identifiers are not qualified');
  } else {
    const folder = resolve(root, 'out', slug), bytes = readFileSync(resolve(folder, 'shard.json'));
    inputs[`out/${slug}/shard.json`] = hash(bytes);
    const raw: unknown = JSON.parse(bytes.toString('utf8')), index = parseOutputIndex(raw);
    const sections = new Map<string, unknown>();
    for (const row of index.sections) {
      const data = readFileSync(resolve(folder, row.path));
      if (data.byteLength !== row.bytes || hash(data) !== row.hash) throw new Error(`Invalid section ${row.name}`);
      const value: unknown = JSON.parse(data.toString('utf8')); sections.set(row.name, value);
    }
    const source = assembleOutputShardfile(raw, sections);
    const product = createShardProduct({ slug, revision: 0, shardfile: source, sections, builtJson: true,
      files: new Map(index.files.flatMap(row => row.name === undefined ? [] : [[row.name, { hash: row.hash, url: row.path,
        ...(row.jsonSchema === undefined ? {} : { jsonSchema: row.jsonSchema }) }]])),
      read: hashId => {
        const row = index.files.find(file => file.hash === hashId); if (row === undefined) throw new Error(`Missing file ${hashId}`);
        const data = readFileSync(resolve(folder, row.path)); if (hash(data) !== hashId || data.byteLength !== row.compressed) throw new Error(`Invalid file ${row.path}`);
        return Promise.resolve(data);
      } });
    try { lists.models = (await explorerRoster(product)).map(row => row.id); }
    catch (error) { gaps.push(`models: ${error instanceof Error ? error.message : String(error)}`); }
    const features = rows(object(sections.get('client/plan')).features).map(object);
    lists.sets = features.filter(row => row.kind === 'world.sets').flatMap(row => ids(row.rows));
    lists.world = ids(object(object(sections.get('ui/level')).manifest).pois ?? []);
    lists.arenas = ['practice', ...features.filter(row => row.kind === 'practice.course').flatMap(row => {
      const course = row.course; if (typeof course !== 'string') throw new Error('Missing course'); return [course];
    })];
    gaps.push('models/sets: late native and world.assembly registrations are not qualified by the declared catalogue');
    gaps.push('product: hash-verified existing output; no claim that it matches current source or visual/physics parity');
  }
  for (const key of Object.keys(lists) as (keyof Lists)[]) { const list = lists[key]; if (list !== null) lists[key] = sorted(list); }
  return { lists, inputs, gaps };
}

const [side, slug, destination] = process.argv.slice(2);
if (side === '--legacy' || side === '--shardfile') {
  if (slug === undefined || !slugs.includes(slug)) throw new Error('Unknown shard');
  console.log(JSON.stringify(await capture(slug, side.slice(2))));
} else {
  if (side === undefined) throw new Error('Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/legacy-explorer-lists.ts <report.json>');
  const script = import.meta.filename;
  const report = slugs.map(name => {
    const read = (mode: string): Capture => {
      const bytes = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', script, mode, name], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const value: unknown = JSON.parse(bytes); const row = object(value);
      // Child data is still parsed and checked before comparison.
      const lists = object(row.lists);
      for (const key of ['models', 'sets', 'world', 'arenas']) if (lists[key] !== null && rows(lists[key]).some(id => typeof id !== 'string')) throw new Error('Invalid child list');
      return value as Capture;
    };
    const legacy = read('--legacy'), shardfile = read('--shardfile');
    return { shard: name, legacy, shardfile, differences: Object.fromEntries(Object.keys(legacy.lists).map(key => {
      const list = key as keyof Lists, a = legacy.lists[list], b = shardfile.lists[list];
      return [key, a === null || b === null ? { qualified: false } : { qualified: list === 'world' || list === 'arenas',
        missing: a.filter(id => !b.includes(id)), added: b.filter(id => !a.includes(id)) }];
    })) };
  });
  writeFileSync(resolve(side), `${JSON.stringify({ version: 1, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), shards: report }, null, 2)}\n`);
  if (slug !== undefined || destination !== undefined) throw new Error('Unexpected argument');
  console.log(`LD4: compared ${report.length} shards; coverage gaps remain explicit in the report`);
}
