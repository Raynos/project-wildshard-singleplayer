// SF73: only exact reviewed frozen snapshots receive the legacy-folder policy.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const LEGACY_INVENTORY = 'lint/legacy-shards.json';
/** @typedef {{primary:string, source:string, files:Record<string,string>}} LegacyRow */
/** @typedef {{version:1, sealed:boolean, shards:Record<string,LegacyRow>}} LegacyInventory */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Read a bounded, exact inventory; a filename suffix never grants an exemption. */
export function legacyInventory(root) {
  const path = resolve(root, LEGACY_INVENTORY);
  if (!existsSync(path)) return /** @type {LegacyInventory} */ ({version:1, sealed:false, shards:{}});
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!object(data) || data.version !== 1 || typeof data.sealed !== 'boolean' || !object(data.shards) || Object.keys(data.shards).length > 6) throw new Error('Invalid legacy inventory');
  for (const [slug, row] of Object.entries(data.shards)) {
    if (!object(row) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(row.primary) || slug !== `${row.primary}-legacy` || !/^[a-f0-9]{40}$/u.test(row.source) || !object(row.files) || Object.keys(row.files).length === 0 || Object.keys(row.files).length > 10000) throw new Error('Invalid legacy pair');
    for (const [file, digest] of Object.entries(row.files)) if (file.startsWith('/') || file.split('/').some(part => part === '..' || part === '.' || part === '') || !/^[a-f0-9]{64}$/u.test(digest)) throw new Error('Invalid legacy file identity');
    if (!Object.hasOwn(row.files, 'manifest.ts') || !Object.hasOwn(row.files, 'plugin.ts')) throw new Error('Incomplete legacy pair');
  }
  return /** @type {LegacyInventory} */ (data);
}
/** Exact pair lookup used by discovery and historical layout budgets. */
export function legacyPrimary(root, slug) { return legacyInventory(root).shards[slug]?.primary; }
/** Registered frozen paths, not arbitrary -legacy folders, stay outside the primary metrics and historical debt. */
export function registeredLegacyFile(inventory, file) {
  const match = /^src\/shards\/([^/]+)\/(.+)$/u.exec(file);
  return match !== null && Object.hasOwn(inventory.shards[match[1]]?.files ?? {}, match[2]);
}
/** Verify every file, including binary assets, before a frozen copy can gain policy privileges. */
export function checkLegacyInventory(root, inventory = legacyInventory(root)) {
  const failures = [];
  for (const [slug, row] of Object.entries(inventory.shards)) {
    const found = [];
    const scan = dir => { for (const entry of readdirSync(resolve(root, `src/shards/${slug}`, dir), {withFileTypes:true})) {
      const name = dir === '' ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(name); else found.push(name);
    } };
    if (!existsSync(resolve(root, `src/shards/${slug}`))) { failures.push(`${slug}: legacy folder missing`); continue; }
    scan('');
    if (found.length !== Object.keys(row.files).length || found.some(file => !Object.hasOwn(row.files, file))) failures.push(`${slug}: frozen file set changed`);
    for (const [file, digest] of Object.entries(row.files)) {
      const path = resolve(root, `src/shards/${slug}/${file}`);
      if (!existsSync(path) || hash(readFileSync(path)) !== digest) failures.push(`${slug}/${file}: frozen bytes changed without an inventory update`);
    }
    if (!existsSync(resolve(root, `src/shards/${row.primary}/manifest.ts`))) failures.push(`${slug}: primary manifest missing`);
  }
  return failures;
}
/** Immutable pair provenance; the list can shrink only when the entire frozen folder is retired. */
export function compareLegacyInventory(before, after, changed, message) {
  const failures = [], fix = /^Legacy-Crash-Fix: \S.+$/mu.test(message);
  if (before.sealed && !after.sealed) failures.push('Legacy inventory cannot be unsealed');
  if (before.sealed) for (const slug of Object.keys(after.shards)) if (!Object.hasOwn(before.shards, slug)) failures.push(`${slug}: legacy inventory can only shrink`);
  for (const [slug, row] of Object.entries(before.shards)) {
    const next = after.shards[slug];
    if (next !== undefined && (next.primary !== row.primary || next.source !== row.source)) failures.push(`${slug}: immutable legacy provenance changed`);
    const touched = changed.filter(file => file.startsWith(`src/shards/${slug}/`));
    if (next === undefined) continue;
    if (!fix && (touched.length > 0 || JSON.stringify(row.files) !== JSON.stringify(next.files))) failures.push(`${slug}: frozen feature edit refused; crash fixes require Legacy-Crash-Fix: <reason>`);
  }
  return failures;
}
/** Commit-message check reads the staged inventory and HEAD, never the shared working tree. */
export function checkLegacyCommit(root, message) {
  const git = args => {
    const result = spawnSync('git', args, {cwd:root, encoding:'utf8'});
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout;
  };
  const read = spec => {
    const result = spawnSync('git', ['show', spec], {cwd:root, encoding:'utf8'});
    return result.status === 0 ? /** @type {LegacyInventory} */ (JSON.parse(result.stdout)) : /** @type {LegacyInventory} */ ({version:1,sealed:false,shards:{}});
  };
  const before = read(`HEAD:${LEGACY_INVENTORY}`), after = read(`:${LEGACY_INVENTORY}`);
  const changed = git(['diff','--cached','--name-only']).trim().split('\n');
  const failures = compareLegacyInventory(before, after, changed, message);
  const remaining = git(['ls-files','--cached']).split('\n');
  for (const slug of Object.keys(before.shards)) if (!Object.hasOwn(after.shards, slug) && remaining.some(file => file.startsWith(`src/shards/${slug}/`))) failures.push(`${slug}: retirement must delete the complete folder`);
  return failures;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures = process.argv[2] === '--commit-message' ? checkLegacyCommit(resolve(import.meta.dirname, '..'), readFileSync(process.argv[3], 'utf8')) : checkLegacyInventory(resolve(import.meta.dirname, '..'));
  if (failures.length > 0) { console.error(failures.join('\n')); process.exitCode = 1; }
}
