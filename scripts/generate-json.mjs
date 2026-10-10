// Emit one retained authoring function's JSON product. File I/O belongs to the Node build driver, never shard authoring code.
// node --import <source-resolver> scripts/generate-json.mjs <entry> <exported-function> <output>
import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, binding, output, ...extra] = process.argv.slice(2);
if (entry === undefined || binding === undefined || output === undefined || extra.length > 0) throw new Error('generate-json: entry, function and output required');
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
/** @type {unknown} */
const value = await generate();
if (value === undefined || typeof value === 'function' || typeof value === 'symbol') throw new Error('generate-json: authoring function returned no JSON data');
const bytes = JSON.stringify(value);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${bytes}\n`);
