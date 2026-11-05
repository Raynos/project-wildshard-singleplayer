import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** The app publishes its data products, never their temporary TypeScript sources: each built product's folder under
 *  `<root>/out` (one with a shard.json) goes to `<outDir>/shardfiles`, without its runtime sources or its build key.
 *  The server class (J91, `<slug>/server/`) is not published either: no URL can serve it to a client.
 * @param {string} root @param {string} outDir */
export function copyOutputProducts(root, outDir) {
  const products = resolve(root, 'out'), shardfiles = resolve(outDir, 'shardfiles');
  rmSync(shardfiles, { recursive: true, force: true });
  if (!existsSync(products)) return;
  for (const entry of readdirSync(products, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const source = resolve(products, entry.name);
    if (!existsSync(resolve(source, 'shard.json'))) continue;
    cpSync(source, resolve(shardfiles, entry.name), { recursive: true, filter: path => basename(path) !== 'runtime' && basename(path) !== '.build-key' && relative(source, path) !== 'server' });
  }
}

/** Only the standard app config with Vite's normal, fresh output is eligible.
 * Custom configs, roots and retained output keep Vite's original copy path.
 * @param {string} root @param {string} outDir @param {string[]} args */
export function deferredPublicCopy(root, outDir, args) {
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === undefined) return false;
    const equals = arg.indexOf('='), key = equals === -1 ? arg : arg.slice(0, equals);
    if ((key !== '--mode' && key !== '--outDir') || seen.has(key)) return false;
    seen.add(key);
    if (equals === -1) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('-')) return false;
      index++; continue;
    }
    if (equals === arg.length - 1) return false;
  }
  const output = resolve(outDir), local = relative(resolve(root), output);
  const publicPath = resolve(root, 'public'), fromPublic = relative(publicPath, output);
  return local !== '' && local !== '..' && !local.startsWith(`..${sep}`)
    && !isAbsolute(local) && fromPublic !== '' && (fromPublic === '..' || fromPublic.startsWith(`..${sep}`))
    && !existsSync(join(output, '.git'));
}

/** Vite has emptied the managed output and emitted its bundle. Public files
 * fill the remaining paths, preserving the bundle's precedence on collisions.
 * The final product publisher replaces shardfiles, so its obsolete public copy
 * has no consumer. Keep publicDir enabled for Vite's URL resolution and indexing.
 * @param {string} root @param {string} outDir */
export function copyDeferredPublic(root, outDir) {
  const source = resolve(root, 'public'), destination = resolve(outDir);
  if (!existsSync(source)) return;
  // One directory enumeration avoids an existence syscall for every public file.
  const emitted = new Set(existsSync(destination)
    ? readdirSync(destination, {recursive: true, withFileTypes: true}).map(row => join(row.parentPath, row.name)) : []);
  /** @param {string} from @param {string} to @param {boolean} top */
  function copy(from, to, top) {
    mkdirSync(to, {recursive: true});
    for (const name of readdirSync(from)) {
      if (top && name === 'shardfiles') continue;
      const input = join(from, name), output = join(to, name);
      if (statSync(input).isDirectory()) copy(input, output, false);
      else if (!emitted.has(output)) copyFileSync(input, output);
      else if (!statSync(output).isFile()) throw new Error(`Public file collides with bundle directory: ${name}`);
    }
  }
  copy(source, destination, true);
}
