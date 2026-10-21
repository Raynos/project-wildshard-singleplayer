/** Independent WIP build contract. Does not relax original-four/native admission guards. */
import { readFileSync, readdirSync, lstatSync, realpathSync, readlinkSync, existsSync } from 'node:fs';
import { resolve, relative, sep, dirname, basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, safeFile, candidateBuildPolicy, ACCEPTANCE } from './candidate-inputs.mjs';

export const NINE = ['mantis', 'conch', 'colossus', 'puffer', 'bellback', 'pitcher', 'medusa', 'keelmaw', 'iguana'];
export function readPrototypeCatalogue(root) {
  const text = readFileSync(safeFile(root, 'practice/prototype-nine/products/catalogue.ts'), 'utf8');
  const json = /^export const PROTOTYPE_PRODUCTS = (\[[\s\S]*?\]) as const;/mu.exec(text)?.[1];
  if (!json) throw new Error('Prototype catalogue must remain explicit JSON data');
  const rows = JSON.parse(json);
  if (!isDeepStrictEqual(rows.map(row => row.id), NINE.slice(4))) throw new Error('Wrong prototype catalogue');
  return rows;
}
export function prototypeSnapshot(root) {
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
  const catalogue = readPrototypeCatalogue(root);
  for (const row of catalogue) for (const field of ['metadata', 'payload']) {
    const name = row[`${field}Path`], expected = row[`${field}Sha256`];
    if (digest(readFileSync(safeFile(root, name))) !== expected) throw new Error(`Prototype source pin mismatch: ${name}`);
    walk(resolve(root, name));
  }
  return { schema: 'wildshard.prototype-nine.source.v1', root: realpathSync(root), buildPolicy: candidateBuildPolicy(), node: process.version, executable: digest(readFileSync(process.execPath)), files, links, catalogue };
}
export function assertPrototypePermission(permission, snapshot, hostRoot, destination, productTemp, root) {
  if (permission?.schema !== 'wildshard.prototype-nine.permission.v1' || permission.buildAllowed !== true || permission.localOnly !== true || permission.admitted !== false || permission.reviewedBy !== 'root' || typeof permission.rootGo !== 'string' || !permission.rootGo.trim() || !isDeepStrictEqual(permission.acceptance, ACCEPTANCE) || !isDeepStrictEqual(permission.products, NINE)) throw new Error('Missing exact root prototype build permission');
  if (permission.sourceSnapshotSha256 !== digest(Buffer.from(JSON.stringify(snapshot))) || permission.hostRoot !== realpathSync(hostRoot) || permission.destination !== resolve(destination) || permission.productTemp !== resolve(productTemp)) throw new Error('Prototype exact-source permission mismatch');
  for (const target of [destination, productTemp]) {
    const absolute = resolve(target);
    if (dirname(absolute) !== resolve(root, 'tmp') || !/^prototype-nine-[a-z0-9][a-z0-9-]*$/u.test(basename(absolute)) || realpathSync(dirname(absolute)) !== dirname(absolute) || existsSync(absolute)) throw new Error('Prototype outputs must be distinct NEW tmp/prototype-nine-* paths');
  }
  if (resolve(destination) === resolve(productTemp)) throw new Error('Separate product temporary path required');
}
