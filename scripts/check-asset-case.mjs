#!/usr/bin/env node
// E357 F3.2: exact directory spelling, even on a case-insensitive Mac volume.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'vite';

/** @param {string} root @returns {string[]} */
function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** @param {string} url */
const normalize = (url) => url.replace(/[?#].*$/, '').replace(/^\.?\/?assets\//, '/assets/');

/** @param {string} root @param {string} url @returns {{ exists: boolean, closest: string | null }} */
function spelling(root, url) {
  let parent = root;
  let exact = true;
  const closest = [];
  for (const segment of url.split('/').filter(Boolean)) {
    let names;
    try { names = readdirSync(parent); } catch { return { exists: false, closest: null }; }
    const name = names.includes(segment) ? segment : names.find((candidate) => candidate.toLowerCase() === segment.toLowerCase());
    if (!name) return { exists: false, closest: null };
    exact &&= name === segment;
    closest.push(name);
    parent = join(parent, name);
  }
  return { exists: exact, closest: exact ? null : `/${closest.join('/')}` };
}

/** @param {string} root @param {string} url */
function stemExists(root, url) {
  const parts = url.split('/').filter(Boolean), stem = parts.pop();
  try { return readdirSync(join(root, ...parts)).some((name) => name.startsWith(`${stem}.`)); } catch { return false; }
}
/** @typedef {{ url: string, from: string, closest: string | null }} Missing */
/** @typedef {{ checked: number, missing: Missing[] }} AssetReport */

/** @param {string} root @returns {AssetReport} */
export function checkAssetCase(root) {
  const files = filesUnder(root);
  const inventory = [...new Set(files.flatMap((file) => {
    const path = `/${relative(root, file).replaceAll('\\', '/')}`;
    return [path, ...path.split('/').slice(1, -1).map((_segment, index, segments) => `/${segments.slice(0, index + 1).join('/')}/`)];
  }))];
  /** @type {Map<string, string>} */
  const urls = new Map();
  /** @param {string} value @param {string} from */
  const add = (value, from) => { if (/^\/?(?:\.\/)?assets\//.test(value)) urls.set(normalize(value), from); };
  for (const file of files.filter((path) => /\.(?:js|css|html|json|webmanifest)$/.test(path))) {
    const source = readFileSync(file, 'utf8');
    const from = relative(root, file).replaceAll('\\', '/');
    if (/\.(?:css|html)$/.test(file)) {
      for (const match of source.matchAll(/["'(=\s]((?:\/?|\.\/)assets\/[^\s"'<>)]*)/g)) add(match[1], from);
      continue;
    }
    // TypeScript 7 has no compiler AST API; Vite exports its own bundle parser.
    const tree = parseSync(file.endsWith('.js') ? file : `${file}.js`, /\.(?:json|webmanifest)$/.test(file) ? `(${source})` : source).program;
    /** @type {WeakMap<import('vite').ESTree.Node, import('vite').ESTree.Node>} */
    const parents = new WeakMap();
    /** @param {unknown} value @returns {value is import('vite').ESTree.Node} */
    const isNode = (value) => typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
    /** @param {import('vite').ESTree.Node} node */
    const children = (node) => Object.values(node).flatMap((value) => Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : []);
    /** @param {import('vite').ESTree.Node} node */
    const index = (node) => { for (const child of children(node)) { parents.set(child, node); index(child); } };
    index(tree);
    /** Resolve declared alternatives without executing bundle code. @param {import('vite').ESTree.Node} node @param {Set<string>} [seen] @returns {string[] | null} */
    const values = (node, seen = new Set()) => {
      if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
      if (node.type === 'ConditionalExpression') {
        const yes = values(node.consequent, seen), no = values(node.alternate, seen);
        return yes && no ? [...new Set([...yes, ...no])] : null;
      }
      if (node.type === 'ArrayExpression') {
        const rows = node.elements.map((element) => element ? values(element, seen) : null);
        return rows.every((row) => row !== null) ? rows.flat() : null;
      }
      if (node.type === 'Identifier' && !seen.has(node.name)) {
        const next = new Set([...seen, node.name]);
        let scope = parents.get(node);
        while (scope) {
          if ((scope.type === 'ArrowFunctionExpression' || scope.type === 'FunctionExpression') && scope.params.some((parameter) => parameter.type === 'Identifier' && parameter.name === node.name)) {
            const call = parents.get(scope);
            if (call?.type === 'CallExpression' && call.callee.type === 'MemberExpression' && call.callee.property.type === 'Identifier' && call.callee.property.name === 'map') return values(call.callee.object, next);
            return null;
          }
          const statements = scope.type === 'Program' || scope.type === 'BlockStatement' ? scope.body : [];
          for (const statement of statements) {
            if (statement.type !== 'VariableDeclaration') continue;
            for (const declaration of statement.declarations) {
              if (declaration.id.type === 'Identifier' && declaration.id.name === node.name && declaration.init) return values(declaration.init, next);
            }
          }
          scope = parents.get(scope);
        }
      }
      return null;
    };
    /** @param {string} part */
    const escape = (part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    /** @param {import('vite').ESTree.Node} node */
    const visit = (node) => {
      if (node.type === 'Literal' && typeof node.value === 'string') add(node.value, from);
      if (node.type === 'TemplateLiteral' && /^\/?(?:\.\/)?assets\//.test(node.quasis[0]?.value.cooked ?? '')) {
        let alternatives = [node.quasis[0]?.value.cooked ?? ''];
        for (let i = 0; i < node.expressions.length; i++) {
          const choices = values(node.expressions[i]) ?? ['*'];
          alternatives = alternatives.flatMap((prefix) => choices.map((choice) => prefix + choice + (node.quasis[i + 1]?.value.cooked ?? '')));
        }
        for (const alternative of alternatives) {
          const url = normalize(alternative);
          if (!url.includes('*')) { add(url, from); continue; }
          // Unknown function arguments: match their fixed path spelling against the build's asset inventory.
          const pattern = `^${url.split('*').map(escape).join('.*')}$`;
          const exact = new RegExp(pattern), folded = new RegExp(pattern, 'i');
          const matches = inventory.filter((candidate) => exact.test(candidate));
          if (matches.length > 0) for (const candidate of matches) add(candidate, from);
          else {
            const candidates = inventory.filter((candidate) => folded.test(candidate));
            if (candidates.length > 0) for (const candidate of candidates) {
              // Preserve the template's fixed spelling, replacing only its holes.
              const captures = new RegExp(`^${url.split('*').map(escape).join('(.*)')}$`, 'i').exec(candidate);
              let capture = 0;
              add(url.replaceAll('*', () => captures?.[++capture] ?? ''), from);
            }
            else add(url, from);
          }
        }
      }
      for (const child of children(node)) visit(child);
    };
    visit(tree);
  }
  /** @type {Missing[]} */
  const missing = [];
  for (const [url, from] of urls) {
    // A prefix the code completes at runtime is not a fetch: a folder ('…/') or a stem with no extension
    // ('…/qwantani_sunset_puresky_2k' + '.hdr'). A stem passes when a file in its folder starts with it + '.'.
    if (url.endsWith('/')) continue;
    const verdict = spelling(root, url);
    if (!verdict.exists && !/\.[a-z0-9]+$/i.test(url) && stemExists(root, url)) continue;
    if (!verdict.exists) missing.push({ url, from, closest: verdict.closest });
  }
  return { checked: urls.size, missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'dist');
    const report = checkAssetCase(root);
    const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
    if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.checked} URLs checked; ${report.missing.length} missing`);
    for (const item of report.missing) console.error(`${item.from}: ${item.url}${item.closest ? ` (wrong case; disk: ${item.closest})` : ' (missing)'}`);
    if (report.missing.length > 0) process.exitCode = 1;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}
