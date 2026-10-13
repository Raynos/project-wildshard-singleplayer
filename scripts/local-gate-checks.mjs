// G363: changed roots with their real dependency types; CI checks all roots.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { textReferencedTests } from './gate-cache.mjs';

/** @param {string[]} changed */
export async function checkChangedTypes(changed) {
  const { default: ts } = await import('@typescript/typescript6');
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

/** Fit fast affected files locally; all deferred files still run in full required CI.
 * @param {string[]} affected @param {Record<string,number>} timings @param {string[]} changed */
export function budgetTests(affected, timings, changed) {
  const touched = new Set(changed), local = [], ci = [];
  let predicted = 0;
  const cost = path => Math.max(1.5, (Object.hasOwn(timings,path) ? timings[path] : 3.5) + 1.5);
  const ordered = [...new Set(affected)].sort((a,b) => Number(touched.has(b))-Number(touched.has(a)) || cost(a)-cost(b) || a.localeCompare(b));
  for (const file of ordered) {
    const seconds = cost(file);
    if (seconds > 8 || predicted + seconds > 45 || local.length >= 40) ci.push(file);
    else { local.push(file); predicted += seconds; }
  }
  return {local, ci, predictedSeconds: predicted, affected: ordered.length};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    /** @type {string[]} */
    const changed = JSON.parse(readFileSync(process.argv[3] ?? '', 'utf8'));
    if (process.argv[2] === 'types') await checkChangedTypes(changed);
    else if (process.argv[2] === 'plan') {
      // Never substitute the full suite after a red; only dependencies of this push.
      const present = changed.filter(path => existsSync(path) && /\.[cm]?[jt]sx?$/u.test(path));
      const roots = [...new Set([...present, ...textReferencedTests(process.cwd(), changed)])];
      const {createVitest} = await import('vitest/node');
      const vitest = await createVitest({watch:false, related: roots, passWithNoTests:true});
      let affected;
      try { affected = (await vitest.getRelevantTestSpecifications()).map(spec => relative(process.cwd(),spec.moduleId)); }
      finally { await vitest.close(); }
      const timings = {};
      const directory = process.argv.at(4);
      if (directory !== undefined && existsSync(directory)) {
        const reports = readdirSync(directory).filter(file => file.endsWith('.json'));
        for (const name of reports) {
          const report = JSON.parse(readFileSync(resolve(directory,name),'utf8'));
          for (const row of report.testResults ?? []) {
            const file = row.name?.split('/tree/').at(1);
            if (typeof file !== 'string') continue;
            const seconds = Math.max(0,(row.endTime-row.startTime)/1000);
            if (Number.isFinite(seconds)) timings[file] = Math.max(timings[file] ?? 0, seconds);
          }
        }
      }
      const plan = budgetTests(affected, timings, changed);
      console.log(`affected tests: ${plan.affected}; local ${plan.local.length} (~${plan.predictedSeconds.toFixed(1)}s budget); required CI ${plan.ci.length}`);
      for (const file of plan.ci) console.log(`CI handoff: ${file}`);
      writeFileSync('.local-gate-plan.json', JSON.stringify(plan));
    } else throw new Error('Use types|plan <changed.json>');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
