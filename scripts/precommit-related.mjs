// CF1: working-tree related tests and warm types, one bounded, fail-open attempt.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { runCommitJobs } from './precommit-jobs.mjs';
import { stagedFiles, stagedProjectFailures, stagedProjects } from './precommit-projects.mjs';

const SOURCE = /^(?:src|test|scripts)\//u;
const TEXT = /\.(?:[cm]?[jt]sx?|json|glsl|wgsl|css)$/u;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const SUITE_LIMIT = 20;

/** Consume one invocation budget, including time already spent waiting for the
 * commit lock and running mandatory guards. Direct callers get the same cap.
 * @param {string} [started] @param {number} [wall] @param {number} [clock] */
export function relatedDeadline(started = process.env.WS_COMMIT_STARTED_AT, wall = Date.now(), clock = performance.now()) {
  if (started === undefined) return clock + 60_000;
  const timestamp = Number(started);
  return clock + (Number.isFinite(timestamp) && timestamp >= 0
    ? Math.max(0, 60_000 - Math.max(0, wall - timestamp)) : 0);
}

/** Only this named error refuses; loading/runner infrastructure may defer. */
class CommitRelatedRefusalError extends Error {
  constructor(/** @type {string[]} */ failures) { super(failures.join('\n')); this.name = 'CommitRelatedRefusalError'; }
}

/** Nested fixture output cannot impersonate this worker's executed-test red.
 * A real red remains fatal even in a timed-out result.
 * @param {import('./precommit-jobs.mjs').CommitResult} result @param {string} token */
export function relatedTestFailed(result, token) {
  return result.name === 'related tests' && result.output.includes(`CF1 TEST FAILURE: ${token} `);
}

/** Override only differing tracked text modules, including peer WIP. Never
 * copy a tree or change loose files/the shared index. Generated inputs retain
 * the existing verified-product preflight and CI authority.
 * @param {string} root @param {ReturnType<typeof stagedFiles>} staged */
export function stagedInputOverride(root, staged) {
  const dirty = execFileSync('git', ['diff', '--name-only', '-z', '--no-renames'], { cwd: root, encoding: 'utf8' }).split('\0').filter(file => TEXT.test(file));
  const overrides = new Map(dirty.map(file => [resolve(root, file), staged.read(file)]));
  return {
    name: 'wildshard:commit-inputs', enforce: /** @type {const} */ ('pre'),
    load(/** @type {string} */ id) {
      const path = id.split('?', 1)[0];
      if (path === undefined || !overrides.has(path)) return null;
      const source = overrides.get(path);
      if (source === undefined) throw new Error(`Absent staged module: ${relative(root, path)}`);
      return source;
    },
  };
}

/** Only a collected, executed test failure is a red. Tool/collection failures
 * are conspicuous deferrals, including product or server prerequisites.
 * @param {string} root @param {string[]} files */
export async function relatedWorker(root, files) {
  process.argv.splice(2, process.argv.length - 2, 'related', '--run', ...files);
  const { createVitest } = await import('vitest/node');
  const { WS_COMMIT_RELATED_TOKEN: token } = process.env;
  const staged = stagedFiles(root);
  const loose = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(file => TEXT.test(file));
  const override = stagedInputOverride(root, staged);
  // Keep the hook's index only long enough to seal overrides. Fixture Git
  // commands must never inherit and rewrite the enclosing commit's index.
  for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) Reflect.deleteProperty(process.env, key);
  let count = 0, failures = 0;
  const executing = new WeakSet();
  const started = performance.now();
  const vitest = await createVitest({ root, related: files, run: true, watch: false, passWithNoTests: true,
    reporters: ['default', {
      onTestRunStart(specifications) {
        count = specifications.length;
        console.info(`CF1: selected ${count} related suites from ${files.length} staged paths`);
      },
      onTestCaseReady(test) { executing.add(test); },
      onTestCaseResult(test) {
        if (test.result().state === 'failed' && executing.has(test)) {
          failures++;
          // Flush each red immediately: the deadline must never hide it.
          console.error(`CF1 TEST FAILURE: ${token ?? 'direct'} ${relative(root, test.module.moduleId)}: ${test.fullName}`);
        }
      },
    }],
  }, { plugins: [override] });
  try {
    // A peer's new tests are not part of this candidate. Newly staged tests
    // are absent from --others and keep the ordinary executed-red refusal.
    for (const project of vitest.projects) project.config.exclude.push(...loose);
    if (loose.length > 0) console.warn(`CF1: exclude ${loose.length} loose text paths absent from the candidate index`);
    const specifications = await vitest.getRelevantTestSpecifications();
    count = specifications.length;
    if (count > SUITE_LIMIT) {
      console.warn(`CF1 DEFERRED TO CI: selected ${count} related suites exceed the ${SUITE_LIMIT}-suite local ceiling; no tests executed`);
    } else if (count > 0) {
      // Keep Vitest's ordinary initialization, hooks and reporter lifecycle.
      // The exact selected paths prevent a second, broader related selection.
      await vitest.start(specifications.map(specification => specification.moduleId));
    }
    if (process.exitCode !== undefined && process.exitCode !== 0 && failures === 0)
      console.warn('CF1 DEFERRED TO CI: collection/runner failed without an executed failing test');
    console.info(`CF1: ${count} suites, ${failures} failing tests, ${(performance.now() - started).toFixed(0)} ms`);
  } finally { await vitest.close(); }
}

/** Warm means this project's incremental metadata already exists. Never build
 * references/declarations or run a generator to make the type check possible.
 * @param {string} root @param {string[]} files */
export function warmTypeJobs(root, files) {
  const staged = stagedFiles(root), { projects, project, name } = stagedProjects(root, staged), jobs = [];
  if (staged.paths.includes('tsconfig.json') && files.some(file => file.startsWith('test/'))) project('tsconfig.json');
  for (const [config, parsed] of projects) {
    if (!parsed.fileNames.some(file => files.includes(name(file)))) continue;
    const cache = config === 'tsconfig.json' ? 'node_modules/.cache/ws-root.tsbuildinfo' : parsed.options.tsBuildInfoFile;
    if (cache === undefined || !existsSync(resolve(root, cache))) {
      console.warn(`CF1 DEFERRED TO CI: cold type project ${config}`); continue;
    }
    mkdirSync(resolve(root, 'node_modules/.cache'), { recursive: true });
    jobs.push({ name: `types ${config}`, command: [resolve(root, 'node_modules/.bin/tsc'), '-p', config, '--noEmit',
      '--incremental', '--tsBuildInfoFile', config === 'tsconfig.json' ? cache : `node_modules/.cache/commit-${config.replaceAll('/', '-')}.tsbuildinfo`] });
  }
  return jobs;
}

/** The injected deadline is for deterministic cap regressions; hooks use 60s.
 * Tooling fails open, observed test reds and staged TS6307 edges refuse.
 * @param {string} root @param {string[]} changed @param {number} [deadline] */
export async function commitRelated(root, changed, deadline = relatedDeadline()) {
  const started = performance.now(), files = changed.filter(file => SOURCE.test(file));
  if (files.length === 0) { console.info('CF1: 0 staged source paths, 0 suites, 0 ms'); return; }
  console.info(`CF1: ${files.length} staged paths; related suite count follows collection`);
  /** @type {string[]} */
  let failures = [];
  try { failures = stagedProjectFailures(root, files); }
  catch (error) { console.warn(`CF1 DEFERRED TO CI: staged project tooling: ${String(error)}`); }
  if (failures.length > 0) {
    console.info(`CF1: static project refusal after ${(performance.now() - started).toFixed(0)} ms`);
    throw new CommitRelatedRefusalError(failures);
  }
  try {
    if (performance.now() >= deadline) throw new Error('60-second commit deadline reached before selection');
    if (!existsSync(resolve(root, 'node_modules/vitest/vitest.mjs'))) throw new Error('Vitest is not installed');
    const jobs = warmTypeJobs(root, files);
    const selectedTests = files.filter(file => TEST.test(file)).length;
    if (selectedTests > SUITE_LIMIT)
      console.warn(`CF1 DEFERRED TO CI: ${selectedTests} staged test files exceed the ${SUITE_LIMIT}-suite local ceiling; selection and execution skipped`);
    else jobs.unshift({ name: 'related tests', command: [process.execPath, import.meta.filename, '--worker', JSON.stringify(files)] });
    mkdirSync(resolve(root, 'tmp'), { recursive: true });
    const temporary = mkdtempSync(resolve(root, 'tmp/commit-related-'));
    const env = resolve(root) === process.cwd() ? process.env
      : Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const token = randomUUID();
    let results;
    try { results = await runCommitJobs(root, jobs, deadline, { ...env, VITEST_TMP_ROOT: temporary, WS_COMMIT_RELATED_TOKEN: token }); }
    finally { rmSync(temporary, { recursive: true, force: true }); }
    for (const result of results) {
      if (result.output !== '') console.error(result.output.trimEnd());
      if (relatedTestFailed(result, token)) failures.push('Related tests refused the staged selection');
      // Static candidate membership above is authoritative. A warm working-tree
      // compiler can also see unstaged peer files, so its diagnostics defer.
      else if (result.timedOut || result.code === 124) console.warn(`CF1 DEFERRED TO CI: ${result.name} reached the 60-second wall cap`);
      else if (result.code !== 0) console.warn(`CF1 DEFERRED TO CI: ${result.name} tooling/prerequisite failed (exit ${result.code})`);
    }
  } catch (error) { console.warn(`CF1 DEFERRED TO CI: related/type tooling: ${String(error)}`); }
  console.info(`CF1: ${files.length} staged paths, related/types wall ${(performance.now() - started).toFixed(0)} ms`);
  if (failures.length > 0) throw new CommitRelatedRefusalError(failures);
}

if (import.meta.main && process.argv[2] === '--worker') {
  try { await relatedWorker(process.cwd(), JSON.parse(process.argv[3] ?? '[]')); }
  catch (error) { console.error(`CF1 DEFERRED TO CI: related runner: ${String(error)}`); process.exitCode = 2; }
}
