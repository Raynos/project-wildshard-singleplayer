/** G649: JSON holds text/rows, never encoded binary. Existing debt is exact-path, shrinking-only policy. */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, posix, resolve } from 'node:path';
import process from 'node:process';

export const BINARY_JSON_POLICY = 'lint/no-binary-json.json';
const ROOTS = ['src', 'public', 'scripts', 'test', 'lint'];
/** @typedef {{base64Chars:number,dataUris:number}} BinaryCounts */
/** @typedef {{schema:'no-binary-json/1',source:string,files:Record<string,BinaryCounts>}} BinaryPolicy */

/** Decode JSON before inspecting strings: escaped slashes/Unicode cannot hide payloads.
 * Object keys count too; traversal is iterative for deeply nested authored rows.
 * @param {unknown} value @returns {BinaryCounts} */
export function binaryJsonCounts(value) {
  let base64Chars = 0, dataUris = 0;
  const pending = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (typeof next === 'string') {
      for (const match of next.matchAll(/[A-Za-z0-9+/]{1024,}={0,2}/gu)) base64Chars += match[0].length;
      for (const _match of next.matchAll(/\bdata:[^,\s]*,/giu)) dataUris++;
    } else if (Array.isArray(next)) { for (const row of next) pending.push(row); }
    else if (next !== null && typeof next === 'object') {
      for (const [key, row] of Object.entries(next)) { pending.push(key); pending.push(row); }
    }
  }
  return { base64Chars, dataUris };
}

/** @param {string} path */
function safePath(path) { return !isAbsolute(path) && path === posix.normalize(path) && !path.startsWith('../') && !path.includes('\\') && path.endsWith('.json'); }
/** @param {unknown} value @returns {BinaryPolicy} */
export function binaryJsonPolicy(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('BINARY-JSON invalid policy');
  const schema = Reflect.get(value, 'schema'), source = Reflect.get(value, 'source'), files = Reflect.get(value, 'files');
  if (schema !== 'no-binary-json/1' || typeof source !== 'string' || !/^[a-f0-9]{40}$/u.test(source)
    || files === null || typeof files !== 'object' || Array.isArray(files)) throw new Error('BINARY-JSON invalid policy');
  /** @type {Record<string,BinaryCounts>} */
  const checked = {};
  for (const [path, row] of Object.entries(files)) {
    if (!safePath(path) || row === null || typeof row !== 'object' || Array.isArray(row)
      || Object.keys(row).sort().join(',') !== 'base64Chars,dataUris') throw new Error(`BINARY-JSON invalid allowance ${path}`);
    const chars = Reflect.get(row, 'base64Chars'), uris = Reflect.get(row, 'dataUris');
    if (typeof chars !== 'number' || typeof uris !== 'number' || !Number.isSafeInteger(chars) || !Number.isSafeInteger(uris)
      || chars < 0 || uris < 0 || chars + uris === 0) throw new Error(`BINARY-JSON invalid allowance ${path}`);
    Object.defineProperty(checked, path, { value: { base64Chars: chars, dataUris: uris }, enumerable: true });
  }
  return { schema, source, files: checked };
}

/** Exact reviewed corrections are the only exception to shrinking debt.
 * @param {BinaryPolicy} before @param {BinaryPolicy} after @param {string} [message] @returns {string[]} */
export function binaryPolicyIncreases(before, after, message = '') {
  const expected = new Map(), failures = [], approved = new Set();
  for (const [path, row] of Object.entries(after.files)) {
    const previous = Object.hasOwn(before.files, path) ? before.files[path] : undefined;
    if (previous === undefined || row.base64Chars > previous.base64Chars || row.dataUris > previous.dataUris)
      expected.set(`Binary-JSON-Approved: wildshard-new ${path} ${row.base64Chars} ${row.dataUris}`, path);
  }
  const content = message.trimEnd().replace(/\n\nAssisted-by:[^\n]+$/u, '').replaceAll(/\n[ \t]+/gu, ' ');
  const footer = content.split(/\n\s*\n/u).at(-1) ?? '';
  for (const line of content.split('\n').filter(item => item.startsWith('Binary-JSON-Approved:'))) {
    if (!footer.split('\n').includes(line) || !expected.has(line) || approved.has(line)) failures.push(`BINARY-JSON ${BINARY_JSON_POLICY}: invalid or unmatched approval ${line}`);
    approved.add(line);
  }
  for (const [line, path] of expected) if (!approved.has(line)) failures.push(`BINARY-JSON ${BINARY_JSON_POLICY}: allowance grew for ${path}; missing ${line}`);
  return failures;
}

/** Preserve JSON strings while accepting comments/trailing commas in repository config JSON.
 * @param {string} text @returns {unknown} */
export function binaryJsonValue(text) {
  try { return JSON.parse(text); } catch { /* Config JSON may use comments and trailing commas. */ }
  const comments = text.replaceAll(/"(?:\\[\s\S]|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu, token => token.startsWith('"') ? token : ' ');
  const commas = comments.replaceAll(/"(?:\\[\s\S]|[^"\\])*"|,\s*(?=[}\]])/gu, token => token.startsWith('"') ? token : '');
  // Historical Python measurement reports contain non-finite numeric tokens.
  return JSON.parse(commas.replaceAll(/"(?:\\[\s\S]|[^"\\])*"|(?<![\w])(?:-?Infinity|NaN)(?![\w])/gu, token => token.startsWith('"') ? token : 'null'));
}

/** @param {string} path @param {string} text @param {BinaryPolicy} policy @returns {string[]} */
export function binaryJsonFailures(path, text, policy) {
  let value;
  try { value = binaryJsonValue(text); }
  catch (error) { throw new Error(`BINARY-JSON ${path}: invalid JSON`, { cause: error }); }
  return binaryJsonValueFailures(path, value, policy);
}

/** @param {string} path @param {unknown} value @param {BinaryPolicy} policy @returns {string[]} */
export function binaryJsonValueFailures(path, value, policy) {
  const counts = binaryJsonCounts(value);
  const allowed = (Object.hasOwn(policy.files, path) ? policy.files[path] : undefined) ?? { base64Chars: 0, dataUris: 0 };
  return counts.base64Chars <= allowed.base64Chars && counts.dataUris <= allowed.dataUris ? []
    : [`BINARY-JSON ${path}: base64Chars=${counts.base64Chars} dataUris=${counts.dataUris}; allowed ${allowed.base64Chars}/${allowed.dataUris}. Emit a binary file beside the JSON.`];
}

/** @param {string} root @param {string[]} args @param {Buffer} [input] */
function git(root, args, input) { return execFileSync('git', args, { cwd: root, input, maxBuffer: 256 * 1024 * 1024 }); }
/** @param {string} root @param {string} revision */
function entries(root, revision) {
  const output = revision === ':' ? git(root, ['ls-files', '--stage', '-z']) : git(root, ['ls-tree', '-rz', revision]);
  /** @type {Map<string,{mode:string,oid:string}>} */
  const found = new Map();
  for (const record of output.toString().split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t');
    if (tab === -1) throw new Error('BINARY-JSON malformed Git path');
    const path = record.slice(tab + 1), [mode, middle, last] = record.slice(0, tab).split(' ');
    if (mode === undefined || middle === undefined || last === undefined) throw new Error('BINARY-JSON malformed Git entry');
    if (revision === ':' && last !== '0') throw new Error('BINARY-JSON unmerged index');
    found.set(path, { mode, oid: revision === ':' ? middle : last });
  }
  return found;
}
/** @param {string} root @param {Map<string,{mode:string,oid:string}>} tree @param {string[]} paths */
function blobs(root, tree, paths) {
  const selected = paths.filter(path => tree.has(path));
  if (selected.length > 32) {
    const found = new Map();
    for (let at = 0; at < selected.length; at += 32) for (const [path, text] of blobs(root, tree, selected.slice(at, at + 32))) found.set(path, text);
    return found;
  }
  const raw = git(root, ['cat-file', '--batch'], Buffer.from(selected.map(path => `${tree.get(path)?.oid}\n`).join('')));
  /** @type {Map<string,string>} */
  const found = new Map(); let at = 0;
  for (const path of selected) {
    const mode = tree.get(path)?.mode;
    if (mode !== '100644' && mode !== '100755') throw new Error(`BINARY-JSON non-regular input ${path}`);
    const end = raw.indexOf(10, at), size = Number(raw.subarray(at, end).toString().split(' ')[2]);
    if (end === -1 || !Number.isSafeInteger(size) || size < 0) throw new Error('BINARY-JSON malformed Git blob');
    found.set(path, raw.subarray(end + 1, end + 1 + size).toString()); at = end + size + 2;
  }
  return found;
}

/** Check exact immutable/index blobs, never a neighbour's working file.
 * @param {string} root @param {string} revision @param {string} previous @param {readonly string[]} changed */
export function checkBinaryRevision(root, revision, previous, changed) {
  const tree = entries(root, revision), parent = entries(root, previous);
  if (!tree.has(BINARY_JSON_POLICY)) return parent.has(BINARY_JSON_POLICY) ? [`BINARY-JSON ${BINARY_JSON_POLICY}: policy deleted`] : [];
  const policy = binaryJsonPolicy(JSON.parse(blobs(root, tree, [BINARY_JSON_POLICY]).get(BINARY_JSON_POLICY) ?? 'null'));
  const before = parent.has(BINARY_JSON_POLICY) ? binaryJsonPolicy(JSON.parse(blobs(root, parent, [BINARY_JSON_POLICY]).get(BINARY_JSON_POLICY) ?? 'null')) : undefined;
  const message = revision === ':' ? process.env['WS_COMMIT_MESSAGE'] ?? '' : git(root, ['show', '-s', '--format=%B', revision]).toString();
  const failures = before === undefined ? [] : binaryPolicyIncreases(before, policy, message);
  const selected = changed.includes(BINARY_JSON_POLICY) ? [...tree.keys()].filter(path => path.endsWith('.json')) : changed.filter(path => path.endsWith('.json'));
  for (const [path, text] of blobs(root, tree, selected)) failures.push(...binaryJsonFailures(path, text, policy));
  return failures;
}

/** Scan tracked and declared outputs plus unexpected JSON outputs in the runtime/source roots.
 * @param {string} root @returns {string[]} */
export function binaryJsonFiles(root) {
  const listing = resolve(root, '.push-tracked.json');
  /** @type {string[]} */
  const tracked = existsSync(listing) ? JSON.parse(readFileSync(listing, 'utf8')) : git(root, ['ls-files', '-z']).toString().split('\0');
  const files = new Set(tracked.filter(path => path.endsWith('.json')));
  for (const folder of ROOTS) {
    const base = resolve(root, folder); if (!existsSync(base)) continue;
    for (const path of readdirSync(base, { recursive: true, encoding: 'utf8' })) if (path.endsWith('.json') && !path.split('/').includes('node_modules')) files.add(`${folder}/${path}`);
  }
  return [...files].sort();
}

/** @param {string} directory @param {BinaryPolicy} [baseline] @returns {string[]} */
export function checkBinaryTree(directory, baseline) {
  const root = resolve(directory);
  const policy = baseline ?? binaryJsonPolicy(JSON.parse(readFileSync(resolve(root, BINARY_JSON_POLICY), 'utf8'))), failures = [];
  for (const path of binaryJsonFiles(root)) {
    const target = resolve(root, path); if (!existsSync(target)) continue;
    if (!safePath(path)) throw new Error(`BINARY-JSON escaping path ${path}`);
    for (let parent = target; parent !== root; parent = resolve(parent, '..')) if (lstatSync(parent).isSymbolicLink()) throw new Error(`BINARY-JSON symlink ${path}`);
    if (lstatSync(target).isFile()) failures.push(...binaryJsonFailures(path, readFileSync(target, 'utf8'), policy));
  }
  return failures;
}

if (import.meta.main) {
  const root = process.cwd(), [mode, base, tip] = process.argv.slice(2);
  /** @type {string[]} */
  const failures = [];
  if (mode === '--staged') {
    const paths = git(root, ['diff', '--cached', '--name-only', '--no-renames', '-z']).toString().split('\0').filter(Boolean);
    failures.push(...checkBinaryRevision(root, ':', 'HEAD', paths));
  } else if (mode === '--range' && base !== undefined && tip !== undefined) {
    const revisions = git(root, ['rev-list', '--reverse', `${base}..${tip}`]).toString().trim().split('\n').filter(Boolean);
    for (const revision of revisions) {
      const previous = git(root, ['rev-parse', `${revision}^`]).toString().trim();
      const paths = git(root, ['diff', '--name-only', '--no-renames', '-z', previous, revision]).toString().split('\0').filter(Boolean);
      failures.push(...checkBinaryRevision(root, revision, previous, paths));
    }
  } else if (mode === '--all') failures.push(...checkBinaryTree(root));
  else throw new Error('usage: no-binary-json.mjs --staged | --range <base> <tip> | --all');
  if (failures.length > 0) { for (const failure of failures) console.error(failure); process.exitCode = 1; }
  else console.info('no-binary-json: pass');
}
