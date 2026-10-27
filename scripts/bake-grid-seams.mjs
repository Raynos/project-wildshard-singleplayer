#!/usr/bin/env node
// The build and the page use the same catalogue, edge reader and certifier.
// The retained native lattice rows ship, and each slug's declared edge source (what the page's reader returns for it), so
// a grid entry reads no product for its edges; placement, meshes and colliders stay generated normally.
// Output: {"plans": [[key, rows]...], "edges": [[slug, source]...]}.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { GridAssembly } from '../src/game/grid/assembly.ts';
import { loadGridEdgeProfiles } from '../src/game/grid/edgeProfiles.ts';
import { readGridEdges } from '../src/game/grid/edgeSources.ts';
import { readGridProductEdges } from '../src/game/grid/products.ts';
import { findShard } from '../src/game/shard/registry.ts';
import { platformInputs } from '../src/game/grid/platformInputs.ts';
import { generatePlatform } from '../src/engine/sim/strips.ts';
import { platformGeometrySource } from '../src/game/grid/compiledStrips.ts';
import { encodeGridStripPage, GridStripTransportLimitError, writeGridStripPages } from './app-build/gridStripPages.ts';
import { phoneWireReport } from './phone-wire.mjs';
import { existsSync } from 'node:fs';

const root = process.cwd(), outputRoot = resolve(process.argv[2] ?? root), base = 'https://build.invalid/';
/** @param {string} path */
const fetchFile = async path => {
  const url = new URL(path, base), product = url.pathname.startsWith('/shardfiles/');
  const relative = decodeURIComponent(url.pathname.slice(product ? '/shardfiles/'.length : 1));
  const folder = resolve(root, product ? 'out' : 'public'), file = resolve(folder, relative);
  if (!file.startsWith(`${folder}/`)) throw new Error('Grid bake path escapes its root');
  try { return new Response(new Uint8Array(await readFile(file))); }
  catch (error) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return new Response(null, { status: 404 }); throw error; }
};
const plans = new Map(), seen = new Set(), products = new Map(), sources = new Map();
/** @type {import('./app-build/gridStripPages.ts').CompiledGridCandidate[]} */
const compiled = [];
for (const developer of [false, true]) for (const devserver of [false, true]) for (const nineDragon of [false, true]) {
  const assembly = new GridAssembly({ developer, devserver, nineDragon });
  const key = JSON.stringify(assembly.cells);
  if (seen.has(key)) continue;
  seen.add(key);
  const empty = assembly.emptyNeighbour.edge;
  const edges = await loadGridEdgeProfiles(assembly.cells, async cell => {
    try {
      const source = await readGridEdges(cell, { fetch: fetchFile, edges: slug => {
        const manifest = findShard(slug), descriptor = manifest?.shardfile ?? manifest?.gridShardfile;
        if (descriptor === undefined) return null;
        let pending = products.get(slug);
        if (pending === undefined) {
          const url = new URL(descriptor, base).href;
          pending = readGridProductEdges(url, slug, { base, firstParty: true, offline: false, fetch: fetchFile,
            hash: bytes => Promise.resolve(createHash('sha256').update(bytes).digest('hex')) });
          products.set(slug, pending);
        }
        return pending;
      } });
      // only a JSON-exact declared source ships (a failed read keeps the page's own read)
      const wire = JSON.stringify(source);
      if (source.kind === 'declared' && isDeepStrictEqual(JSON.parse(wire), source)) sources.set(cell.slug, source);
      return source;
    } catch (error) {
      // Partial --shard builds retain the page's existing exact-input runtime fallback.
      console.error(`[grid bake] ${cell.instance}: ${String(error)}`);
      const closed = { entryWidth: 0 };
      return { kind: 'declared', profiles: { north: empty, east: empty, south: empty, west: empty },
        observations: { north: closed, east: closed, south: closed, west: closed } };
    }
  });
  const input = platformInputs(assembly, edges);
  let cells = input.cells, strips;
  try { strips = generatePlatform(cells, input.empty, plans); }
  catch (error) { console.error(`[grid bake] road-level fallback: ${String(error)}`); cells = input.flat; strips = generatePlatform(cells, input.empty, plans); }
  const source = await platformGeometrySource(cells, input.empty), reach = 1.5 * assembly.pitch + 1;
  for (const home of assembly.cells) {
    /** @param {import('../src/engine/sim/strips.ts').GeneratedStrip} strip */
    const within = strip => Math.abs(strip.mesh.origin.x - home.origin.x) <= reach && Math.abs(strip.mesh.origin.z - home.origin.z) <= reach;
    const initial = strips.filter(within);
    compiled.push(encodeGridStripPage(source, home.instance, home.slug, initial, 'initial', { origin: home.origin, pitch: assembly.pitch }));
    if (!existsSync(resolve(root, 'out', home.slug, 'shard.json'))) continue;
    try { compiled.push(encodeGridStripPage(source, home.instance, home.slug, strips.filter(strip => !within(strip)), 'outer')); }
    catch (error) {
      if (!(error instanceof GridStripTransportLimitError)) throw error;
      console.error(`[grid bake] ${home.instance} outer retains native construction: ${String(error)}`);
    }
  }
}
// Edge reads complete concurrently. Their completion order must not change the
// content URL (and every importing chunk) when all certified values are equal.
/** @template T @param {ReadonlyMap<string,T>} rows */
const ordered = rows => [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
const output = JSON.stringify({ plans: ordered(plans), edges: ordered(sources) });
const names = [...new Set(compiled.map(row => row.slug))].filter(slug => existsSync(resolve(root, 'out', slug, 'shard.json')));
const wire = await phoneWireReport(root, names);
if (wire.errors.length > 0) throw new Error(wire.errors.join('\n'));
const pages = writeGridStripPages(outputRoot, createHash('sha256').update(output).digest('hex'), compiled, wire.rows);
for (const row of pages.rows) console.error(`[grid strip wire] ${row.home} source=${row.source.slice(0, 8)} added=${row.added} product=${String(row.product)} ceiling=${String(row.ceiling)} ${row.included ? 'compiled' : 'native'}${row.outer ? '+outer' : ''}`);
process.stdout.write(output);
