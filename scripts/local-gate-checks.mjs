// G363: changed roots with their real dependency types; CI checks all roots.
import ts from '@typescript/typescript6';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textReferencedTests } from './gate-cache.mjs';

/** @param {string[]} changed */
export function checkChangedTypes(changed) {
  const configs = ['tsconfig.json', 'scripts/tsconfig.json', 'api/tsconfig.json', 'admin/tsconfig.json', 'drafts/tsconfig.json'];
  const diagnostics = [];
  for (const config of configs) {
    if (!existsSync(config)) continue;
    const file = ts.readConfigFile(config, path => ts.sys.readFile(path));
    if (file.error) { diagnostics.push(file.error); continue; }
    const parsed = ts.parseJsonConfigFileContent(file.config, ts.sys, resolve(config, '..'));
    const members = new Set(parsed.fileNames.map(path => resolve(path)));
    const roots = changed.map(path => resolve(path)).filter(path => members.has(path) && existsSync(path));
    if (roots.length === 0) continue;
    const ambient = parsed.fileNames.filter(path => /\.d\.[cm]?ts$/u.test(path) || /\bdeclare\s+global\s*\{/u.test(readFileSync(path, 'utf8')));
    const program = ts.createProgram([...new Set([...roots, ...ambient])], { ...parsed.options, noEmit: true });
    diagnostics.push(...parsed.errors, ...ts.getPreEmitDiagnostics(program));
  }
  if (diagnostics.length > 0) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => ts.sys.getCurrentDirectory(), getNewLine: () => '\n',
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    /** @type {string[]} */
    const changed = JSON.parse(readFileSync(process.argv[3] ?? '', 'utf8'));
    if (process.argv[2] === 'types') checkChangedTypes(changed);
    else if (process.argv[2] === 'plan') {
      // Never substitute the full suite after a red; only dependencies of this push.
      const present = changed.filter(path => existsSync(path) && /\.[cm]?[jt]sx?$/u.test(path));
      writeFileSync('.local-gate-plan.json', JSON.stringify([...new Set([...present, ...textReferencedTests(process.cwd(), changed)])]));
    } else throw new Error('Use types|plan <changed.json>');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
