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

const root = process.cwd(), base = 'https://build.invalid/';
/** @param {string} path */
const fetchFile = async path => {
  const url = new URL(path, base), product = url.pathname.startsWith('/shardfiles/');
  const relative = decodeURIComponent(url.pathname.slice(product ? '/shardfiles/'.length : 1));
  const folder = resolve(root, product ? 'out' : 'public'), file = resolve(folder, relative);
  if (!file.startsWith(`${folder}/`)) throw new Error('Grid bake path escapes its root');
  try { return new Response(new Uint8Array(await readFile(file))); }
  catch (error) { if (error?.code === 'ENOENT') return new Response(null, { status: 404 }); throw error; }
};
const plans = new Map(), seen = new Set(), products = new Map(), sources = new Map();
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
  try { generatePlatform(input.cells, input.empty, plans); }
  catch (error) { console.error(`[grid bake] road-level fallback: ${String(error)}`); generatePlatform(input.flat, input.empty, plans); }
}
process.stdout.write(JSON.stringify({ plans: [...plans], edges: [...sources] }));
