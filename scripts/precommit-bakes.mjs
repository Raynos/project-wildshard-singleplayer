// G364/G367: actual producers in the immutable staged export, never hash-only stamps.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { mapSettings, mapShards, mapTilesHash } from './map-hash.mjs';
import { refreshBakeInputs } from './bake-input-hashes.mjs';
import { refreshWitnesses } from './witness-manifests.mjs';

export const NATIVE_BAKES = [
  ['nine-dragon-stack', 'nine'], ['far-reach', 'sky'], ['sunscar-dunes', 'signal'],
  ['pine-hollow', 'pine'], ['driftwood-isle', 'driftwood'], ['nalati-grasslands', 'nalati'],
];
/** Plan only bakes whose full declared input map changed, including shared inputs.
 * @param {string} root */
export async function nativeBakePlan(root) {
  const jobs = [];
  for (const [slug, name] of NATIVE_BAKES) {
    const collector = resolve(root, `scripts/${name}-physics-inputs.mjs`);
    if (!existsSync(collector)) continue;
    const module = await import(pathToFileURL(collector).href);
    const inputs = module[`${name}PhysicsInputs`](root);
    const outputs = [['physics', inputs]];
    if (name === 'pine') outputs.push(['spots', inputs]);
    if (name === 'driftwood') {
      const spots = await import(pathToFileURL(resolve(root, 'scripts/driftwood-spots-inputs.mjs')).href);
      outputs.push(['spots', spots.driftwoodSpotsInputs(root)]);
    }
    for (const [kind, expected] of outputs) {
      const file = `src/shards/${slug}/runtime/${kind}.baked.json`;
      const before = existsSync(resolve(root, file)) ? JSON.parse(readFileSync(resolve(root, file), 'utf8')) : null;
      const digest = createHash('sha256').update(JSON.stringify(expected)).digest('hex');
      // Pine spots records its exact input-map digest in build rather than an inputs object.
      const current = before !== null && (before.inputs === undefined ? before.build === `node-${digest}` : isDeepStrictEqual(before.inputs, expected));
      if (current) continue;
      jobs.push({ slug, file, command: [process.execPath, '--experimental-transform-types', '--import', './scripts/bake-loader.mjs', `src/shards/${slug}/generators/bake-${name}-${kind}.mjs`] });
    }
  }
  return jobs;
}
/** @param {string} root @param {string[]} command */
async function producer(root, command) {
  const [program, ...args] = command;
  const started = performance.now();
  const child = spawn(program, args, { cwd: root, stdio: 'inherit' });
  const [code] = await once(child, 'close');
  console.log(`precommit-bake: ${args.at(-1) ?? program} ${((performance.now() - started) / 1000).toFixed(3)}s`);
  if (code !== 0) throw new Error(`Commit-time producer failed (${String(code)}): ${command.join(' ')}`);
}
/** Run official native producers and the official raster producer for stale maps.
 * The runner owns its exact-source product/cache and index publication.
 * @param {string} root
 * @param {{url?: string, revision?: string}} [product]
 * @returns {Promise<string[]>} */
export async function regenerateCheapBakes(root, product = {}) {
  const native = await nativeBakePlan(root), changed = native.map(job => job.file);
  // A shard's physics/spots run in order; independent shards can run beside each other.
  const results = await Promise.allSettled(NATIVE_BAKES.map(async ([slug]) => {
    for (const job of native.filter(row => row.slug === slug)) await producer(root, job.command);
  }));
  const errors = results.filter(result => result.status === 'rejected');
  if (errors.length > 0) throw new AggregateError(errors.map(result => result.reason), 'Commit-time native bakes failed');
  const maps = mapShards(root).filter(({dir}) => {
    const file = resolve(dir, 'look/map.baked.json');
    return !existsSync(file) || JSON.parse(readFileSync(file, 'utf8')).tilesHash !== mapTilesHash(dir);
  });
  const page = maps.filter(({dir}) => mapSettings(dir).from === null);
  if (page.length > 0) {
    if (product.url === undefined || product.revision === undefined || !/^[a-f0-9]{40}$/u.test(product.revision)) throw new Error(`Commit-time maps require the exact staged product: ${page.map(row => row.slug).join(', ')}; no stamp-only refresh is permitted`);
    const version = await fetch(new URL('/version.json', product.url)).then(response => {
      if (!response.ok) throw new Error('Staged map product has no version receipt');
      return response.json();
    });
    if (version.revision !== product.revision) throw new Error('Commit-time map product revision mismatch');
    await producer(root, ['bash', 'scripts/browser-lane.sh', '--max', '4', process.execPath, 'scripts/bake-maps.mjs', `--url=${product.url}`, `--shards=${page.map(row => row.slug).join(',')}`]);
  }
  const glb = maps.filter(({dir}) => mapSettings(dir).from !== null);
  if (glb.length > 0) await producer(root, [process.execPath, 'scripts/bake-map-glb.mjs', `--shards=${glb.map(row => row.slug).join(',')}`]);
  for (const {slug} of maps) changed.push(`src/shards/${slug}/look/map.baked.json`, `public/assets/${slug}/map/top.webp`);
  return changed;
}
/** Preserve the established byte-identical King/witness admission laws at commit.
 * Call after actual native outputs, before publishing index bytes.
 * @param {string} root @param {string} witnessCache @returns {Promise<string[]>} */
export async function refreshRecordedCommitInputs(root, witnessCache) {
  const king = await refreshBakeInputs(root);
  for (const [file, text] of Object.entries(king)) writeFileSync(resolve(root, file), text);
  const witnesses = await refreshWitnesses(root, witnessCache);
  return [...Object.keys(king), ...Object.keys(witnesses)];
}
