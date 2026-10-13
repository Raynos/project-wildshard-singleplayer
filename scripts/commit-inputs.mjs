// G367: build inputs are produced at commit; pushes restore verified bytes only.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** @param {string} root @param {string} tree */
export function inputKey(root, tree) {
  const entries = execFileSync('git', ['ls-tree', '-rz', tree], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const selected = entries.toString().split('\0').filter(entry => {
    const path = entry.slice(entry.indexOf('\t') + 1);
    return /^(src|scripts|lint|public|test|music|sfx)\//u.test(path) || /^(package|pnpm|vite|vitest|tsconfig|\.oxlint)/u.test(path);
  });
  return createHash('sha256').update(selected.join('\0')).digest('hex');
}
const hash = (/** @type {Uint8Array} */ bytes) => createHash('sha256').update(bytes).digest('hex');
/** @param {string} root @param {string} tree @param {string} snapshot @param {string[]} files */
export function saveCommitInputs(root, tree, snapshot, files) {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  const cache = resolve(common, 'commit-inputs'), blobs = resolve(cache, 'blobs');
  mkdirSync(blobs, { recursive: true });
  const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', tree], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n'));
  // The immutable producer export contains no foreign untracked working files.
  // Include runtime assets (Rapier/Basis), packs and generated source tables.
  const produced = globSync(['src/**/*', 'public/**/*'], { cwd: snapshot }).map(String)
    .filter(file => !tracked.has(file) && lstatSync(resolve(snapshot, file)).isFile());
  const outputs = {};
  for (const file of new Set([...files, ...produced])) {
    const bytes = readFileSync(resolve(snapshot, file)), digest = hash(bytes), object = resolve(blobs, digest);
    if (!existsSync(object)) writeFileSync(object, bytes);
    outputs[file] = digest;
  }
  writeFileSync(resolve(cache, `${inputKey(root, tree)}.json`), JSON.stringify(outputs));
}
/** @param {string} root @param {string} tree @param {string} snapshot */
export function restoreCommitInputs(root, tree, snapshot) {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  const cache = resolve(common, 'commit-inputs');
  const key = inputKey(root, tree), receipt = resolve(cache, `${key}.json`);
  if (!existsSync(receipt)) throw new Error(`Missing commit-time generation inputs for ${tree.slice(0, 9)}; commit-time generation must finish before push`);
  /** @type {Record<string,string>} */
  const outputs = JSON.parse(readFileSync(receipt, 'utf8'));
  for (const [file, digest] of Object.entries(outputs)) {
    if (!(file === 'lint/shard-words.generated.json' || /^(src|public)\//u.test(file)) || file.split('/').some(part => part === '..' || part === '.' || part === '') || file.includes('\\') || !/^[a-f0-9]{64}$/u.test(digest)) throw new Error(`Invalid commit input: ${file}`);
    const bytes = readFileSync(resolve(cache, 'blobs', digest));
    if (hash(bytes) !== digest) throw new Error(`Corrupt commit-time generation input: ${file}`);
    const target = resolve(snapshot, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}
if (process.argv[2] === '--restore') {
  try { restoreCommitInputs(process.argv[3] ?? '', process.argv[4] ?? '', process.argv[5] ?? ''); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
