/** Local experiment only. This module never grants or substitutes for source admission. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, realpathSync, readlinkSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const FOUR = ['mantis', 'conch', 'colossus', 'puffer'];
export const ACCEPTANCE = Object.freeze({ modelAcceptance: false, runtimeAcceptance: false, visualAcceptance: false, colliderAcceptance: false, publicAcceptance: false });
const conchBase = 'art/driftwood-isle/approved-conch/runtime-admission/arena-motion4';
export const CONCH_DELTAS = [
  'src/engine/entities/AnimalSim.ts', 'src/engine/entities/AnimalView.ts',
  'src/engine/entities/animalPose.ts', 'src/engine/entities/animalRig.ts',
  'src/game/plugin/channelPrograms.ts', 'src/game/plugin/geometry.ts',
  'src/game/practice/PracticeCreature.ts', 'src/game/practiceDemo/startPracticeDemo.ts',
  'src/game/shardfile/borrowedDecisions.ts',
].sort();
export function safeFile(root, name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => part === '..' || part === '.')) throw new Error(`Unsafe candidate path: ${name}`);
  const path = resolve(root, name);
  if (!lstatSync(path).isFile() || realpathSync(path) !== path) throw new Error(`Candidate input is not a regular non-symlink file: ${name}`);
  return path;
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
/** Inventory includes every file, forbidding unpinned product additions and symlink ancestors. */
export function inventory(root) {
  const rows = {};
  const walk = directory => {
    for (const item of readdirSync(directory).sort()) {
      const path = resolve(directory, item), name = relative(root, path).split(sep).join('/'), stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symlink in candidate inventory: ${name}`);
      if (stat.isDirectory()) walk(path);
      else { safeFile(root, name); rows[name] = digest(readFileSync(path)); }
    }
  };
  walk(root); return rows;
}
export function retainedCandidateProducts(root, hostRoot) {
  const pins = readJson(safeFile(root, 'practice/shared-arena/pins.json'));
  if (!isDeepStrictEqual(Object.keys(pins.enemies), FOUR)) throw new Error('Candidate requires original four only');
  const keys = new Set();
  return FOUR.map(id => {
    const pin = pins.enemies[id], host = resolve(hostRoot, `${id}-engine`);
    for (const [name, expected] of Object.entries(pin.files)) if (digest(readFileSync(safeFile(host, name))) !== expected) throw new Error(`Retained pin mismatch: ${id}/${name}`);
    const productPins = Object.fromEntries(Object.entries(pin.files).filter(([name]) => name.startsWith('practice-product/')).map(([name, hash]) => [name.slice(17), hash]));
    if (!isDeepStrictEqual(inventory(resolve(host, 'practice-product')), productPins)) throw new Error(`Unpinned product inventory: ${id}`);
    const read = name => readJson(safeFile(host, name));
    const previewFile = `${id}-preview.json`, preview = read(previewFile), index = read('practice-product/shard.json'), validation = read('practice-product/validation.json');
    if (preview.candidate !== pin.candidate || preview.mode !== pin.mode || index.build.sourceHash !== pin.sourceHash || validation.indexHash !== digest(readFileSync(safeFile(host, 'practice-product/shard.json')))) throw new Error(`Candidate identity mismatch: ${id}`);
    const json = name => {
      const matches = index.files.filter(row => row.name === name);
      if (matches.length !== 1) throw new Error(`Missing/duplicate product file: ${name}`);
      return read(`practice-product/${matches[0].path}`);
    };
    const bodies = json('practice/bodies.json'), looks = json('practice/looks.json');
    if (bodies.bodies.length !== 1 || bodies.bodies[0].kind !== pin.kind || looks.looks.length !== 1 || looks.looks[0].kind !== pin.kind || bodies.file !== preview.bodyFile || !Object.hasOwn(pin.files, preview.bodyFile.slice(1))) throw new Error(`Candidate species mismatch: ${id}`);
    for (const look of looks.looks) for (const key of [`look:${look.id}`, `species:${look.species}`, `kind:${look.kind}`]) {
      if (keys.has(key)) throw new Error(`Duplicate candidate content key: ${key}`);
      keys.add(key);
    }
    return { id, host, previewFile, preview, index, validation, bodies, looks, pins: pin.files };
  });
}
/** Conservative superset of build/validator dependencies; no historical source is loaded. */
export function sourceSnapshot(root) {
  const files = {}, links = {}, visited = new Set();
  const walk = path => {
    const real = realpathSync(path), name = relative(root, path).split(sep).join('/'), stat = lstatSync(path);
    if (stat.isSymbolicLink()) links[name] = { target: readlinkSync(path), resolved: real };
    if (visited.has(real)) return;
    visited.add(real);
    if (lstatSync(real).isDirectory()) for (const child of readdirSync(real).sort()) walk(resolve(real, child));
    else files[relative(root, real).split(sep).join('/')] = digest(readFileSync(real));
  };
  for (const directory of ['src', 'practice', 'scripts', 'vite', 'budgets', 'node_modules']) walk(resolve(root, directory));
  for (const name of readdirSync(root).sort()) if (/^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|practice\.html|tsconfig.*\.json|vite.*\.[cm]?[jt]s)$/u.test(name)) walk(resolve(root, name));
  const conchDeltas = [], baseline = {};
  for (const name of ['freeze-manifest.json', 'reviewed-build-pin.json']) {
    const path = `${conchBase}/${name}`; walk(resolve(root, path));
    for (const [file, hash] of Object.entries(readJson(safeFile(root, path)).files)) {
      if (baseline[file] && baseline[file] !== hash) throw new Error(`Conflicting original Conch pin: ${file}`);
      baseline[file] = hash; walk(resolve(root, file));
    }
  }
  for (const [path, original] of Object.entries(baseline).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const current = digest(readFileSync(safeFile(root, path)));
    if (original !== current) conchDeltas.push({ path, original, current });
  }
  if (!isDeepStrictEqual(conchDeltas.map(row => row.path), CONCH_DELTAS)) throw new Error('Expected exactly nine reviewed Conch source deltas');
  return { schema: 'wildshard.shared-arena.candidate-source.v1', root: realpathSync(root), buildPolicy: candidateBuildPolicy(), node: process.version, executable: digest(readFileSync(process.execPath)), files, links, conchDeltas };
}
export function assertPermission(permission, snapshot, hostRoot, destination, root) {
  if (permission?.schema !== 'wildshard.shared-arena.candidate-permission.v1' || permission.buildAllowed !== true || permission.localOnly !== true || permission.admitted !== false || permission.reviewedBy !== 'root' || typeof permission.rootGo !== 'string' || !permission.rootGo.trim() || typeof permission.reviewPath !== 'string' || !permission.reviewPath.startsWith('docs/reviews/') || !isDeepStrictEqual(permission.acceptance, ACCEPTANCE) || !isDeepStrictEqual(permission.products, FOUR)) throw new Error('Missing explicit root-reviewed local-only candidate permission');
  if (permission.sourceSnapshotSha256 !== digest(Buffer.from(JSON.stringify(snapshot))) || permission.reviewSha256 !== digest(readFileSync(safeFile(root, permission.reviewPath))) || permission.hostRoot !== realpathSync(hostRoot) || permission.destination !== resolve(destination)) throw new Error('Candidate exact-source permission mismatch');
  const localBase = resolve(root, 'tmp/shared-arena-candidates');
  if (!resolve(destination).startsWith(`${localBase}${sep}`) || realpathSync(dirname(destination)) !== dirname(resolve(destination)) || existsSync(destination)) throw new Error('Candidate output must be a NEW local tmp/shared-arena-candidates child, never an existing output or Site destination');
}

/** Only public constants belong here. Never snapshot ambient environment values. */
export function candidateBuildPolicy() {
  const env = { MODE: 'candidate', BASE_URL: './', DEV: false, PROD: true, SSR: false, VITE_SENTRY_DSN: '' };
  return { configFile: false, publicDir: false, envDir: false, envPrefix: [], mode: 'candidate', base: './',
    css: { postcss: { plugins: [] } },
    define: { ...Object.fromEntries(Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])), 'process.env.NODE_ENV': JSON.stringify('production') } };
}
/** mkdir (without recursive) is the exclusive claim, not the earlier existence check. */
export function reserveOutput(destination) {
  const path = resolve(destination);
  if (realpathSync(dirname(path)) !== dirname(path)) throw new Error('Symlink candidate output parent');
  mkdirSync(path, { mode: 0o700 });
  const ancestors = [];
  for (let current = path;; current = dirname(current)) {
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe candidate output directory');
    ancestors.push({ path: current, dev: stat.dev, ino: stat.ino });
    if (dirname(current) === current) break;
  }
  return { path, makeParents(name) {
    let current = path;
    for (const part of name.split('/').slice(0, -1)) {
      this.assert();
      current = resolve(current, part);
      if (ancestors.some(row => row.path === current)) continue;
      // Refuse directories supplied by another writer, including symlinks.
      mkdirSync(current, { mode: 0o700 });
      const stat = lstatSync(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe candidate output directory');
      ancestors.push({ path: current, dev: stat.dev, ino: stat.ino });
      this.assert();
    }
  }, assert(empty = false) {
    for (const original of ancestors) {
      const stat = lstatSync(original.path);
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== original.dev || stat.ino !== original.ino) throw new Error('Candidate output directory replaced or symlinked');
    }
    if (realpathSync(path) !== path) throw new Error('Symlink candidate output path');
    if (empty && readdirSync(path).length > 0) throw new Error('Candidate output reservation is not empty');
  } };
}
export function pinnedBytes(root, name, expected) {
  const data = readFileSync(safeFile(root, name));
  if (typeof expected !== 'string' || digest(data) !== expected) throw new Error(`Candidate copy pin mismatch: ${name}`);
  return data;
}
export function writePinnedOutput(reservation, name, data, expected) {
  reservation.assert();
  if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe candidate output file');
  if (digest(data) !== expected) throw new Error(`Candidate copy pin mismatch: ${name}`);
  const path = resolve(reservation.path, name);
  reservation.makeParents(name);
  if (realpathSync(dirname(path)) !== dirname(path)) throw new Error('Symlink candidate output ancestor');
  reservation.assert();
  writeFileSync(path, data, { flag: 'wx' });
  reservation.assert();
  pinnedBytes(reservation.path, name, expected);
}
export function verifyPinnedOutputs(reservation, expected) {
  reservation.assert();
  for (const [name, hash] of Object.entries(expected)) pinnedBytes(reservation.path, name, hash);
}
