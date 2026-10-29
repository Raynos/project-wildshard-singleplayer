/** MF2: publish this graph's immutable files and carry exactly one previous graph.
 * This is a plain output step, never a bundler plugin or a runtime prefetch. */
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const MANIFEST = 'deploy-chunks.json';
const CHUNK = /^assets\/(?:[\w.-]+\/)*[\w.-]+-[\w-]{8,64}\.(?:js|css|wasm|json|bin|woff2?|png|webp|jpg|svg)$/u;
/** @param {unknown} value */
function readManifest(value) {
  if (typeof value !== 'object' || value === null || !('format' in value) || value.format !== 1
    || !('build' in value) || typeof value.build !== 'string' || !('files' in value) || !Array.isArray(value.files)) throw new Error('Invalid previous deploy chunk manifest');
  const seen = new Set();
  const files = value.files.map(row => {
    if (typeof row !== 'object' || row === null || typeof row.path !== 'string' || !CHUNK.test(row.path)
      || row.path.split('/').includes('..') || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || seen.has(row.path)) throw new Error('Invalid previous deploy chunk row');
    seen.add(row.path);
    return {path: row.path, bytes: row.bytes};
  });
  return {format: 1, build: value.build, files};
}
/** @param {string} directory */
function currentManifest(directory) {
  const version = JSON.parse(readFileSync(join(directory, 'version.json'), 'utf8'));
  if (typeof version.build !== 'string') throw new Error('Missing deploy build identity');
  const files = [];
  const assets = join(directory, 'assets');
  if (existsSync(assets)) for (const entry of readdirSync(assets, {recursive: true, withFileTypes: true})) {
    if (!entry.isFile()) continue;
    const path = `assets/${resolve(entry.parentPath, entry.name).slice(resolve(assets).length + 1)}`;
    if (CHUNK.test(path)) files.push({path, bytes: statSync(join(directory, path)).size});
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {format: 1, build: version.build, files};
}
/** Carry files from a built previous output (local --rev proof), or production's
 * published manifest. The new manifest lists only NEW output, never inherited files.
 * @param {string} directory
 * @param {{previousDirectory?: string, previousOrigin?: string}} [options]
 */
export async function carryPreviousDeploy(directory, options = {}) {
  const current = currentManifest(directory), currentPaths = new Set(current.files.map(row => row.path));
  let previous;
  if (options.previousDirectory !== undefined) {
    previous = readManifest(JSON.parse(readFileSync(join(options.previousDirectory, MANIFEST), 'utf8')));
  } else if (options.previousOrigin !== undefined) {
    const response = await fetch(new URL(`/${MANIFEST}`, options.previousOrigin), {cache: 'no-store', signal: AbortSignal.timeout(30000)});
    // The first release of this output format has no predecessor manifest.
    if (!response.ok && response.status !== 404) throw new Error(`Previous deploy manifest returned ${response.status}`);
    if (response.status !== 404 && !response.headers.get('content-type')?.includes('text/html')) {
      previous = readManifest(await response.json());
    }
  }
  let carried = 0, bytes = 0;
  if (previous !== undefined) for (const row of previous.files) {
    if (currentPaths.has(row.path)) {
      if (statSync(join(directory, row.path)).size !== row.bytes) throw new Error(`Immutable deploy chunk changed size: ${row.path}`);
      continue;
    }
    const target = join(directory, row.path);
    mkdirSync(dirname(target), {recursive: true});
    if (options.previousDirectory !== undefined) {
      const source = join(options.previousDirectory, row.path);
      if (statSync(source).size !== row.bytes) throw new Error(`Previous deploy chunk length differs: ${row.path}`);
      copyFileSync(source, target);
    } else {
      const response = await fetch(new URL(`/${row.path}`, options.previousOrigin), {signal: AbortSignal.timeout(30000)});
      if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error(`Previous deploy chunk unavailable: ${row.path}`);
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength !== row.bytes) throw new Error(`Previous deploy chunk length differs: ${row.path}`);
      writeFileSync(target, body);
    }
    carried++; bytes += row.bytes;
  }
  writeFileSync(join(directory, MANIFEST), `${JSON.stringify(current)}\n`);
  return {current: current.files.length, carried, bytes};
}
