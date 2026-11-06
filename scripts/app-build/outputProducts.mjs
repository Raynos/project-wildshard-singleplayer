import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** The app publishes its data products, never their temporary TypeScript sources: each built product's folder under
 *  `<root>/out` (one with a shard.json) goes to `<outDir>/shardfiles`, without its runtime sources or its build key.
 *  `mounts/` and `cook.json` (C0, J137) are the cook's input: their files already serve at their public URLs, but for a
 *  discovery document and its art, which are served beside their product.
 *  The server class (J91, `<slug>/server/`) stays out of that tree, which is what a client reads. Standalone's server is a
 *  worker on the same device: it reads those files from its server pack (C2, `src/game/shared/shardfile/serverPack.ts`),
 *  which nothing precaches and no client manifest names.
 * @param {string} root @param {string} outDir */
export function copyOutputProducts(root, outDir) {
  const products = resolve(root, 'out'), shardfiles = resolve(outDir, 'shardfiles');
  rmSync(shardfiles, { recursive: true, force: true });
  if (!existsSync(products)) return;
  for (const entry of readdirSync(products, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const source = resolve(products, entry.name);
    if (!existsSync(resolve(source, 'shard.json'))) continue;
    cpSync(source, resolve(shardfiles, entry.name), { recursive: true, filter: path => basename(path) !== 'runtime' && basename(path) !== '.build-key' && !['server', 'mounts', 'cook.json'].includes(relative(source, path)) });
    // C3: the mounts a page reads by this folder's URL: a discovery document and the art of a product that packs none.
    const own = resolve(source, 'mounts/shardfiles', entry.name);
    if (existsSync(own)) cpSync(own, resolve(shardfiles, entry.name), { recursive: true });
  }
}

/** DL20: a level file leaves the deploy when a part holds it and nothing reads its URL directly. Every default manifest's file
 *  stays: a neighbour's rings and a road crossing read those by URL (G828, G1011; through parts each would cost a whole part),
 *  a title's `<img>` reads its art, and the harness's shardfile arm reads the same set. What goes is the rest of a whole-level
 *  set, which a home reads from its parts and a page past a crossing reads through them (`spawnDownload.ts`).
 *  @param {string} outDir @returns {{files: number, bytes: number}} */
export function pruneLooseCopies(outDir) {
  const spawn = resolve(outDir, 'assets/spawn'), kept = new Set(), packed = new Set();
  const path = url => url.split('?')[0] ?? url;
  if (!existsSync(spawn)) return { files: 0, bytes: 0 };
  for (const name of readdirSync(spawn)) {
    if (!/-(?:client|grid)-(?:phone|desktop)-[a-f0-9]{16}\.json$/u.test(name)) continue;
    const manifest = JSON.parse(readFileSync(join(spawn, name), 'utf8'));
    if (manifest.parts === undefined) { for (const file of manifest.files) kept.add(path(file.url)); continue; }
    for (const part of manifest.parts) {
      // A part homed on another origin (J138) has its own home; a file here is this deploy's only copy.
      if (!existsSync(resolve(outDir, `.${part.url}`))) continue;
      for (const [index] of part.members) packed.add(path(manifest.files[index].url));
    }
  }
  let files = 0, bytes = 0;
  for (const url of packed) {
    if (kept.has(url) || !url.startsWith('/shardfiles/')) continue;
    const file = resolve(outDir, `.${url}`);
    if (!existsSync(file)) continue;
    bytes += statSync(file).size; files++;
    rmSync(file);
  }
  return { files, bytes };
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
