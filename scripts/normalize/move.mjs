#!/usr/bin/env node
// E357 F6: plan the whole transformation in memory before any write. F6c runs this in dry-run mode only.
import { existsSync, globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { changedLines, collisions, imports, layer, localSpecifier, pathRewriter, resolveImport, rewriteGlobs, rewriteImports } from './core.mjs';
import { classify } from './classify.mjs';

export const REPORT_FILE = '/private/tmp/e357-f6c/dry-run.json';
const SCAN = ['src/**/*', 'test/**/*', 'scripts/**/*.{mjs,js,sh,py,json}', 'vite.config.ts', 'vite/**/*.ts',
  '.oxlintrc.json', 'index.html', 'tsconfig.json', 'lint/ratchet.json', 'AGENTS.md', 'README.md',
  'docs/*.md', 'docs/design/**/*.md', 'docs/plans/**/*.md', '.claude/skills/**/*'];
const TEXT = /\.(ts|tsx|js|mjs|css|html|json|md|sh|py)$/;
const TOKENS = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

export function selectedMoves(map, row, files) {
  const moves = new Map();
  const missing = [];
  for (const entry of [...map.files, ...map.tests]) {
    const selected = row === 'F6' || new RegExp(`→\\s*${row.replaceAll('.', String.raw`\.`)}\\s*$`).test(entry.row);
    if (!selected) continue;
    const from = row === 'F6' ? entry.from : entry.f6;
    const to = row === 'F6' ? entry.f6 : entry.final;
    // F7 and later deletion rows belong to their owner; this tool never deletes.
    if (!from || !to) continue;
    if (files.has(from)) moves.set(from, to);
    else if (!files.has(to)) missing.push({ from, to });
  }
  return { moves, missing };
}

function pathPass(text, rewrite, comments) {
  let cursor = 0;
  let result = '';
  for (const token of text.matchAll(TOKENS)) {
    const outside = text.slice(cursor, token.index);
    result += comments ? rewrite(outside) : outside;
    result += token[0].startsWith('/') === comments ? rewrite(token[0]) : token[0];
    cursor = token.index + token[0].length;
  }
  const tail = text.slice(cursor);
  return result + (comments ? rewrite(tail) : tail);
}

function rewriteSrcHelpers(text, moves) {
  return text.replaceAll(/\bsrc\(\s*(['"`])([^'"`]+)\1\s*\)/g, (full, quote, value) => {
    const target = moves.get(`src/${value}`);
    return target ? `src(${quote}${target.slice(4)}${quote})` : full;
  });
}

function warnings(file, text, known) {
  const result = [];
  for (const token of text.matchAll(TOKENS)) {
    if (token[0].startsWith('/')) continue;
    for (const match of token[0].matchAll(/(?<![\w.-])src\/[\w./${}*?@{}[\],+-]+/g)) {
      const value = match[0].replace(/[.,]+$/, '');
      if (!known.has(value)) result.push({ file, line: text.slice(0, token.index).split('\n').length, literal: value });
    }
  }
  return result;
}

export function planMove(map, row = 'F6', root = process.cwd(), mapPath = '') {
  // Public assets never move, but moved tests' imports must still resolve to them. Include tooling targets too.
  const files = new Set(globSync(['src/**/*', 'test/**/*', 'api-tests/**/*', 'scripts/**/*', 'public/**/*',
    'vite/**/*', 'lint/**/*', 'index.html'], { cwd: root }).filter((file) => statSync(path.join(root, file)).isFile()));
  const { moves, missing } = selectedMoves(map, row, files);
  const rewrite = pathRewriter(moves);
  const collisionChecks = collisions(moves, files);
  for (const [from, to] of moves) if (existsSync(path.join(root, to)) && statSync(path.join(root, to)).isDirectory()) {
    collisionChecks.push({ from, to, kind: 'occupied directory', other: to });
  }
  const deleted = new Set(row === 'F6' ? map.files.filter((entry) => entry.f6 === null).map((entry) => entry.from) : []);
  const virtualFiles = new Set([...files].filter((file) => !deleted.has(file)).map((file) => moves.get(file) ?? file));
  const inputMap = mapPath ? path.relative(root, path.resolve(root, mapPath)) : '';
  const scans = [...new Set(globSync(SCAN, { cwd: root }))].filter((file) => file !== inputMap && file !== 'docs/MOVED.md'
    && TEXT.test(file) && !file.startsWith('scripts/normalize/') && !file.startsWith('test/fixtures/normalize/') && statSync(path.join(root, file)).isFile() && !deleted.has(file)).sort((a, b) => a.localeCompare(b));
  const rewrites = [];
  const contents = new Map();
  const unmatchedLiterals = [];
  const unresolvedImports = [];
  const edges = {};
  const edgeDetails = [];
  const known = new Set([...map.files, ...map.tests].flatMap((entry) => [entry.from, entry.f6, entry.final]).filter(Boolean));
  for (const file of scans) {
    const destination = moves.get(file) ?? file;
    const before = readFileSync(path.join(root, file), 'utf8');
    const source = /^(src|test)\//.test(file) && /\.[cm]?[jt]sx?$/.test(file);
    const imported = source ? rewriteImports(file, destination, before, files, moves) : before;
    const globbed = source ? rewriteGlobs(file, imported, map.globs, row) : imported;
    const strings = file.endsWith('.md') || file === 'AGENTS.md' ? globbed : rewriteSrcHelpers(pathPass(globbed, rewrite, false), moves);
    let comments = file.endsWith('.md') ? rewrite(strings) : pathPass(strings, rewrite, true);
    // HTML paths live in attributes; the ordinary quoted-string pass above handles them.
    if (file === 'lint/ratchet.json' || file === 'test/coverage-ratchet.json') comments = rewrite(comments);
    contents.set(destination, comments);
    if (before !== comments) rewrites.push({ from: file, to: destination, steps: {
      imports: changedLines(before, imported), globs: changedLines(imported, globbed),
      strings: changedLines(globbed, strings), comments: changedLines(strings, comments),
    } });
    if (!file.endsWith('.md')) unmatchedLiterals.push(...warnings(file, before, known));
    if (source) for (const entry of imports(destination, comments)) {
      if (!localSpecifier(entry.specifier)) continue;
      const target = resolveImport(destination, entry.specifier, virtualFiles);
      if (!target) { unresolvedImports.push({ file: destination, line: entry.line, specifier: entry.specifier }); continue; }
      const originLayer = layer(destination);
      const targetLayer = layer(target);
      let kind = '';
      if (originLayer.startsWith('shards/') && targetLayer.startsWith('shards/') && originLayer !== targetLayer) kind = 'shard → shard';
      else if (originLayer === 'engine' && ['game', 'kit'].includes(targetLayer)) kind = `engine → ${targetLayer}`;
      else if (['engine', 'game', 'kit'].includes(originLayer) && targetLayer.startsWith('shards/')) kind = `${originLayer} → shard`;
      if (kind) { edges[kind] = (edges[kind] ?? 0) + 1; edgeDetails.push({ kind, file: destination, line: entry.line, target }); }
    }
  }
  for (const kind of ['engine → game', 'engine → kit', 'engine → shard', 'game → shard', 'kit → shard', 'shard → shard']) edges[kind] ??= 0;
  const counts = {};
  for (const [from, to] of moves) if (from !== to) {
    const bucket = layer(to);
    counts[bucket] ??= { files: 0, lines: 0 };
    counts[bucket].files++;
    if (TEXT.test(from)) counts[bucket].lines += readFileSync(path.join(root, from), 'utf8').split('\n').length - 1;
  }
  const gitMoves = [...moves].filter(([from, to]) => from !== to).map(([from, to]) => ({ from, to }));
  const touchedPaths = [...new Set([...gitMoves.flatMap((entry) => [entry.from, entry.to]), ...rewrites.map((entry) => entry.to), 'docs/MOVED.md', 'lint/ratchet.json'])].sort((a, b) => a.localeCompare(b));
  const report = { row, counts, gitMoves, rewrites, missing, unresolvedImports, unmatchedLiterals, edges, edgeDetails,
    collisions: collisionChecks, touchedPaths, manual: map.manual, ratchetCommand: 'node lint/ratchet.mjs --add-rule wildshard/layer',
    ok: missing.length === 0 && unresolvedImports.length === 0 && collisionChecks.length === 0 && edges['shard → shard'] === 0 };
  return { report, contents };
}

export function executeMove(map, row, root, mapPath, dryRun) {
  if (!dryRun) {
    const tracked = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' });
    const code = execFileSync('git', ['status', '--porcelain', '--', 'src', 'test', 'scripts'], { cwd: root, encoding: 'utf8' });
    if (tracked || code) throw new Error('Real moves require a clean tracked tree and no untracked src/test/scripts files');
    const findings = classify(map, root);
    if (findings.length > 0) throw new Error(`Classifier refused the move: ${JSON.stringify(findings)}`);
    if (!existsSync(path.join(root, 'lint/ratchet.mjs'))) throw new Error('F4 ratchet tooling is required before the real move');
  }
  const { report, contents } = planMove(map, row, root, mapPath);
  if (dryRun) {
    mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  } else {
    if (!report.ok) throw new Error('Move refused: unresolved imports, missing files, collisions or cross-shard edges');
    // A second run must be a true no-op, including MOVED.md and the once-only ratchet bootstrap.
    if (report.gitMoves.length > 0 || report.rewrites.length > 0) {
      for (const entry of report.gitMoves) {
        mkdirSync(path.dirname(path.join(root, entry.to)), { recursive: true });
        execFileSync('git', ['mv', '--', entry.from, entry.to], { cwd: root });
      }
      for (const entry of report.rewrites) {
        const content = contents.get(entry.to);
        if (content === undefined) throw new Error(`Missing transformed text: ${entry.to}`);
        writeFileSync(path.join(root, entry.to), content);
      }
      const movedDoc = ['# Moved paths (E357)', '', '| Before | After F6 | Final |', '|---|---|---|',
        ...[...map.files, ...map.tests].map((entry) => `| ${entry.from} | ${entry.f6 ?? 'deleted by F7'} | ${entry.final ?? 'deleted by its owner'} |`), ''].join('\n');
      writeFileSync(path.join(root, 'docs/MOVED.md'), movedDoc);
      if (row === 'F6') {
        execFileSync('node', ['lint/ratchet.mjs', '--add-rule', 'wildshard/layer'], { cwd: root, stdio: 'inherit' });
      }
      execFileSync('node', ['lint/ratchet.mjs', '--update'], { cwd: root, stdio: 'inherit' });
    }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const mapPath = args.shift();
  let row = 'F6';
  let dryRun = false;
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--row' && args[0]) row = args.shift();
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!mapPath) throw new Error('Usage: move.mjs <map> [--row F6|<row>] [--dry-run]');
  const report = executeMove(JSON.parse(readFileSync(mapPath, 'utf8')), row, process.cwd(), mapPath, dryRun);
  console.info(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
