// Emit one retained authoring function's JSON or explicit byte product. I/O belongs to this Node driver.
// node --import ./src/sdk/bake/source-loader.mjs src/sdk/bake/json.mjs <entry> <exported-function> <output>
// oxlint-disable-next-line import/no-nodejs-modules -- Only the build driver writes the generated JSON output.
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Source and output paths must stay in the isolated tree.
import { dirname, isAbsolute, resolve, sep } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the explicitly named retained authoring recipe.
import { pathToFileURL } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- This executable reads its explicit producer arguments.
import process from 'node:process';

const args = process.argv.slice(2);
const entry = args.at(0), binding = args.at(1), output = args.at(2);
const binary = args.length === 4 && args.at(3) === '--bytes';
if ((!binary && args.length !== 3) || entry === undefined || binding === undefined || output === undefined) throw new Error('generate-json: entry, function and output required');
const root = process.cwd();
/** Restrict source and destination to explicit regular paths in the isolated generation tree. @param {string} path */
function confined(path) {
  if (isAbsolute(path) || path.includes('\\') || path.split('/').some(part => part === '' || part === '.' || part === '..')) throw new Error('generate-json: path must stay inside the generation tree');
  const parts = path.split('/');
  for (let length = 1; length <= parts.length; length++) {
    try {
      if (lstatSync(resolve(root, ...parts.slice(0, length))).isSymbolicLink()) throw new Error('generate-json: symlink refused');
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const target = resolve(root, path);
  if (!target.startsWith(root + sep)) throw new Error('generate-json: escaping path refused');
  return target;
}
const source = confined(entry), destination = confined(output);
/** @type {unknown} */
const author = await import(pathToFileURL(source).href);
if (author === null || typeof author !== 'object' || !(binding in author)) throw new Error('generate-json: named authoring function required');
const generate = Reflect.get(author, binding);
if (typeof generate !== 'function') throw new Error('generate-json: named authoring function required');
/** Byte recipes receive only a confined, read-only asset reader. @param {string} url */
function readAsset(url) {
  if (typeof url !== 'string' || !url.startsWith('/assets/')) throw new Error('generate-json: asset URL required');
  return new Uint8Array(readFileSync(confined(`public${url}`)));
}
/** @type {unknown} */
const value = binary ? await generate(readAsset) : await generate();
if (binary) {
  if (!(value instanceof Uint8Array)) throw new Error('generate-json: byte recipe must return Uint8Array');
  mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, value);
} else {
if (value === undefined || typeof value === 'function' || typeof value === 'symbol') throw new Error('generate-json: authoring function returned no JSON data');
const bytes = JSON.stringify(value);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${bytes}\n`);
}
