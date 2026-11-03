#!/usr/bin/env node
// OP3: source-only, deterministic plot scaffolds. Run the ordinary producer to qualify their bytes.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';
import { AccentSchema } from '@wildshard/format/accent';
import { checkLayout, parseLayout } from '../../src/shards/open-plots/generators/kit.mjs';
import { plotBuilders } from '../../src/shards/open-plots/generators/tiledPlot.mjs';
import { parseDomeCameras } from '../dome-cameras.mjs';
import { plotAudioRequest } from './audio-template.mjs';

const slugSchema = v.pipe(v.string(), v.regex(/^open-plot-[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const word = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const text = v.pipe(v.string(), v.nonEmpty());
const hex = v.pipe(v.string(), v.regex(/^#[a-f0-9]{6}$/iu));
const schema = v.strictObject({
  slug: slugSchema, name: text, accent: AccentSchema, reference: v.pipe(text, v.regex(/^art\/(?!.*(?:^|\/)\.\.(?:\/|$))[^\\:]+$/u)),
  plot: v.pipe(word, v.check(value => Object.hasOwn(plotBuilders, value), 'Unknown plot builder')), 
  palette: v.record(v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9]*$/u)), hex), kit: v.array(word), rows: v.optional(v.pipe(v.array(text), v.length(8))),
  lookKeys: v.optional(v.array(v.unknown())), worldMaterials: v.optional(v.record(text, text)),
  replaces: v.optional(slugSchema),
  cell: v.optional(v.tuple([v.pipe(v.number(), v.integer(), v.minValue(-2), v.maxValue(2)), v.pipe(v.number(), v.integer(), v.minValue(-2), v.maxValue(2))])),
});
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const digest = value => createHash('sha256').update(json(value)).digest('hex');
const read = (root, file, before) => {
  if (before !== undefined && !before.has(file)) before.set(file, existsSync(resolve(root, file)) ? readFileSync(resolve(root, file), 'utf8') : null);
  const source = before === undefined ? readFileSync(resolve(root, file), 'utf8') : before.get(file);
  if (source === null || source === undefined) throw new Error(`Missing template input ${file}`);
  return JSON.parse(source);
};
const ROWS = [
  'G0 E0 E0 N0 N3 E0 E0 G0',
  'E0 E0 E0 E0 E0 E0 E0 E0',
  'E0 E0 E0 E0 E0 E0 E0 E0',
  'N2 E0 E0 P0 P1 E0 E0 N1',
  'N3 E0 E0 P3 P2 E0 E0 N0',
  'E0 E0 E0 E0 E0 E0 E0 E0',
  'E0 E0 E0 E0 E0 E0 E0 E0',
  'G0 E0 E0 N1 N2 E0 E0 G0',
];
const CAMERA_SOURCE = 'art/grid/round-63-night-market-domes';
export const DOME_NAMES = ['A1-road-stand', 'A2-road-look', 'B1-40m-stand', 'B2-40m-look', 'C1-100m-stand', 'C2-100m-look', 'D1-plaza-stand', 'D2-gate-look'];

/** Propose every source change first; the writer refuses a partial overwrite of a hand-authored layout.
 * The camera protocol reuses the canonical 500 m dome geometry, not a new art approval.
 * @param {string} root @param {unknown} raw */
export function plotTemplate(root, raw, { activateExisting = false } = {}) {
  const recipe = v.parse(schema, raw), idea = recipe.slug.slice('open-plot-'.length), before = new Map();
  if (recipe.reference.split('/').some(part => part === '.' || part === '..')) throw new Error('Reference escapes art root');
  if (!existsSync(resolve(root, recipe.reference))) throw new Error('Missing reference board');
  const base = read(root, 'src/shards/open-plots/data/layouts/night-market.json', before);
  for (const slot of Object.keys(base.palette)) if (recipe.palette[slot] === undefined) throw new Error(`Missing palette slot ${slot}`);
  const declared = read(root, 'src/shards/open-plots/outputs.json', before);
  const grid = read(root, 'src/game/grid/singleplayer.json', before);
  const previous = declared.outputs.find(row => row.slug === recipe.slug);
  const activate = previous === undefined || activateExisting;
  const existing = grid.grid.cells.filter(row => row.slug === recipe.slug);
  if (existing.length > 1) throw new Error('Plot needs one unambiguous grid placement');
  const cell = recipe.cell === undefined ? existing[0] : grid.grid.cells.find(row => row.cell[0] === recipe.cell[0] && row.cell[1] === recipe.cell[1]);
  if (cell === undefined) throw new Error('Plot needs an explicit assembled grid cell');
  if (existing.length === 1 && cell !== existing[0]) throw new Error('Plot already occupies another grid cell');
  if (recipe.replaces !== undefined && (previous !== undefined || cell.slug !== recipe.replaces)) throw new Error('Explicit replacement does not match the selected old plot');
  const layoutPath = `src/shards/open-plots/data/layouts/${idea}.json`;
  if (existsSync(resolve(root, layoutPath))) {
    const old = read(root, layoutPath, before);
    if (old.template?.schema !== 'open-plot-template/1') throw new Error('Refuse to overwrite a hand-authored layout');
    const { contentHash, ...metadata } = old.template;
    if (digest({ ...old, template: metadata }) !== contentHash) throw new Error('Refuse to overwrite edited template layout');
  }
  const layout = { why: `OP3 ${recipe.name}: shared-kit TEMPLATE; theme art remains its Opus row.`,
    template: { schema: 'open-plot-template/1', slug: recipe.slug }, plot: recipe.plot,
    rows: recipe.rows ?? (recipe.plot === 'scaffold' ? ROWS : ROWS.map(row => row.replaceAll('E0', 'G0'))), kit: recipe.kit, palette: recipe.palette, landmark: null, posters: null };
  const builders = plotBuilders[recipe.plot].builders(layout);
  checkLayout(parseLayout(layout.rows, builders), builders);
  layout.template.contentHash = digest(layout);
  const shared = read(root, 'src/shards/open-plots/data/source.json', before);
  const manifest = { ...previous?.manifest, name: `Open Plot · ${recipe.name}`,
    blurb: `${recipe.name}: shared-kit template; landmark and theme dressing are unfinished.`,
    bindings: { ...previous?.manifest?.bindings, accent: recipe.accent,
      ...(previous === undefined ? { boot: { files: { module: './data/nightMarketBootFiles.json', export: 'default' }, sources: { module: './data/nightMarketBootSources.json', export: 'default' } } } : {}) }, pois: [] };
  const output = { ...previous, slug: recipe.slug, idea, name: recipe.name, accent: recipe.accent,
    layout: idea, scaffold: true, manifest, lookKeys: recipe.lookKeys ?? shared.look.keys, ...(recipe.worldMaterials === undefined ? {} : { worldMaterials: recipe.worldMaterials }) };
  delete output.placeholder;
  if (previous === undefined) declared.outputs.push(output);
  else if (activate) declared.outputs[declared.outputs.indexOf(previous)] = output;
  if (previous === undefined && recipe.replaces === undefined && grid.grid.cells.filter(row => row.slug === cell.slug).length < 2) throw new Error('A new idea needs an explicitly planned repeated cell or named replacement; a unique plot is not silently retired');
  if (previous === undefined) delete cell.edgeLook;
  cell.slug = recipe.slug;
  if (new Set(grid.grid.cells.map(row => row.slug)).size !== 25) throw new Error('Template would repeat a slug in the 25-cell grid');
  if (!grid.placements.some(row => row.slug === recipe.slug)) {
    // A standalone catalogue placement is metadata, not a second live-grid cell.
    const used = new Set(grid.placements.map(row => row.cell.join(',')));
    let x = -2, z = 9; while (used.has(`${x},${z}`)) { x++; if (x > 2) { x = -2; z++; } }
    grid.placements.push({ slug: recipe.slug, instance: `${recipe.slug}-solo`, cell: [x, z], size: [500, 500, 500] });
  }
  const map = read(root, 'src/shards/open-plots/data/map.json', before);
  map.outputs[recipe.slug] = { style: { kind: 'ground', smooth: 2, shade: 0.3,
    classes: [...new Set(Object.values(recipe.palette))].map(colour => ({ match: colour, fill: colour })) },
    exclude: ['collide_', 'detail_pool', 'coarse_standins'] };
  const descriptorPath = `src/shards/open-plots/data/templates/${idea}.json`;
  const paths = new Map([[layoutPath, json(layout)], [descriptorPath, json({ schema: 'open-plot-template/1', output, map: map.outputs[recipe.slug], activated: activate })]]);
  // The five build-out themes receive explicit requests, never silent playback claims.
  if (['frostline-peaks', 'lantern-bayou', 'ember-forge', 'mosslight-ruins', 'coral-drift'].includes(idea)) {
    paths.set(`src/shards/open-plots/data/templates/${idea}.audio.json`, json(plotAudioRequest(idea)));
  }
  if (activate) {
    paths.set('src/shards/open-plots/outputs.json', json(declared));
    paths.set('src/game/grid/singleplayer.json', json(grid));
    paths.set('src/shards/open-plots/data/map.json', json(map));
    if (previous === undefined) registerProduct(paths, root, recipe.slug, before);
  }
  addPlotCameras(paths, root, { slug: recipe.slug, instance: cell.instance, reference: recipe.reference, layout: activate ? layoutPath : 'src/shards/open-plots/outputs.json', template: true }, before);
  for (const path of paths.keys()) if (!before.has(path)) before.set(path, existsSync(resolve(root, path)) ? readFileSync(resolve(root, path), 'utf8') : null);
  return { paths, before, activated: activate, slug: recipe.slug, instance: cell.instance, layout: layoutPath };
}

/** Register a new declaration without granting wire or tile debt. Its first normal build measures its wire row.
 * @param {Map<string,string>} paths @param {string} root @param {string} slug */
function registerProduct(paths, root, slug, before) {
  // gen-shards emits each new declaration into out/.app; never add generated source debt.
  const outputsPath = 'scripts/source-generation-outputs.json', outputs = read(root, outputsPath, before);
  const discovery = `out/.app/discovery.open-plots.${slug}.generated.ts`;
  if (!outputs.producers['scripts/gen-shards.mjs'].includes(discovery)) outputs.producers['scripts/gen-shards.mjs'].push(discovery);
  paths.set(outputsPath, json(outputs));
  const testsPath = 'scripts/test-products.json', tests = read(root, testsPath, before);
  if (!tests['test/shipped-graph-cost.test.ts'].includes(slug)) tests['test/shipped-graph-cost.test.ts'].push(slug);
  tests['test/shipped-graph-cost.test.ts'].sort(); paths.set(testsPath, json(tests));
  const debtPath = 'lint/tile-bake-debt.json', debt = read(root, debtPath, before);
  debt.products[slug] ??= {}; paths.set(debtPath, json(debt));
  const sectionPath = 'lint/custom-sections.json', sections = read(root, sectionPath, before);
  sections.freeze.names[slug] ??= []; sections.baseline[slug] ??= { count: 0, bytes: 0 }; paths.set(sectionPath, json(sections));
}

/** Add canonical camera manifests and the exact assembled plot registry. No image is generated.
 * @param {Map<string,string>} paths @param {string} root
 * @param {{slug:string,instance:string,reference:string,layout:string,template:boolean}} row */
export function addPlotCameras(paths, root, row, before = new Map()) {
  const idea = row.slug.slice('open-plot-'.length), cameras = `art/open-plots/${idea}/domes`;
  for (const dome of DOME_NAMES) {
    const camera = parseDomeCameras(read(root, `${CAMERA_SOURCE}/${dome}/cameras.json`, before));
    const provenance = row.template ? `TEMPLATE camera geometry: canonical 500 m dome protocol; ${row.slug}; art direction is not approved by this camera copy. ` : 'Approved Night Market camera provenance (RM2/RM3/END). ';
    const updated = { ...camera, mockup: row.reference, layout: row.layout, convention: provenance + camera.convention };
    const output = `${cameras}/${dome}/cameras.json`;
    if (existsSync(resolve(root, output))) {
      const previous = parseDomeCameras(read(root, output, before));
      for (const key of ['views', 'anchor', 'type', 'pair', 'dome']) if (json(previous[key]) !== json(camera[key])) throw new Error('Refuse to overwrite hand-edited camera geometry');
    }
    paths.set(output, json(parseDomeCameras(updated)));
  }
  const registryPath = 'scripts/open-plots/plots.json';
  const registry = paths.has(registryPath) ? JSON.parse(paths.get(registryPath)) : existsSync(resolve(root, registryPath)) ? read(root, registryPath, before) : { schema: 'open-plot-captures/1', plots: [] };
  registry.plots = [...registry.plots.filter(value => value.slug !== row.slug), { slug: row.slug, instance: row.instance, cameras }].sort((a, b) => a.slug.localeCompare(b.slug));
  paths.set(registryPath, json(registry));
}

/** @param {string} root @param {Map<string,string>} paths */
export function writeTemplate(root, paths, before) {
  // All admission/duplicate/layout checks have completed before the first write.
  for (const path of paths.keys()) if (path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').some(part => part === '..' || part === '.' || part === '')) throw new Error('Invalid template output path');
  for (const [path, source] of before) {
    const current = existsSync(resolve(root, path)) ? readFileSync(resolve(root, path), 'utf8') : null;
    if (current !== source) throw new Error(`Template source changed before publication: ${path}`);
  }
  for (const [path, source] of paths) { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, source); }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, ...flags] = process.argv.slice(2);
  if (file === undefined || flags.some(flag => !['--check', '--activate-existing'].includes(flag))) throw new Error('Usage: node scripts/open-plots/template.mjs <recipe.json> [--check] [--activate-existing]');
  const root = resolve(import.meta.dirname, '../..'), recipe = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const result = plotTemplate(root, recipe, { activateExisting: flags.includes('--activate-existing') });
  if (flags.includes('--check')) {
    const stale = [...result.paths].filter(([path, source]) => !existsSync(resolve(root, path)) || readFileSync(resolve(root, path), 'utf8') !== source).map(([path]) => path);
    if (stale.length > 0) throw new Error(`Stale plot template: ${stale.join(', ')}`);
  } else writeTemplate(root, result.paths, result.before);
  console.log(JSON.stringify({ slug: result.slug, instance: result.instance, activated: result.activated, files: [...result.paths.keys()] }));
}
