// GM2 consumes GM3's exact selection; it defines execution, never another graph.
import { commitCheckFailed, runCommitJobs } from './precommit-jobs.mjs';

/** @type {import('./push-subset-jobs.mjs').PushSubsetPorts} */
const NATIVE_PORTS = { run: runCommitJobs };

/** @param {import('./gate-selection.mjs').GateSelection} selection
 * @param {readonly string[]} changed @param {readonly string[]} paths
 * @param {Readonly<Record<string,readonly string[]>>} products
 * @returns {import('./push-subset-jobs.mjs').PushSubsetJob[]} */
export function pushSubsetJobs(selection, changed, paths, products) {
  const tracked = new Set(paths);
  const need = (/** @type {string} */ path) => {
    if (!tracked.has(path)) throw new Error(`Selected push input is not tracked: ${path}`);
    return path;
  };
  for (const file of selection.tests) need(file);
  for (const config of selection.projects) need(config);
  const source = [...new Set(changed.filter(file => tracked.has(file) && /\.[cm]?[jt]sx?$/u.test(file)))];
  /** @type {import('./push-subset-jobs.mjs').PushSubsetJob[]} */
  const jobs = [];
  const node = process.execPath;
  const heavy = (/** @type {string[]} */ command) => ['python3', need('scripts/heavy-lane.py'), 'build', '--', ...command];
  const needsInputs = selection.tests.length + selection.projects.length + selection.products.length + selection.generators.length + source.length > 0;
  if (!needsInputs) return jobs;
  // Normal gen restores its declared dependency closure from verified caches.
  // It also owns discovery and root setup; no loose generated input is copied.
  jobs.push({ name: 'generated-inputs', after: [], command: heavy([node, need('scripts/gen.mjs'), '--inputs-only', '--reuse',
    ...(selection.products.length === 0 ? [] : [`--shard=${selection.products.join(',')}`])]) });
  if (selection.projects.length > 0) jobs.push({ name: 'types', after: ['generated-inputs'],
    command: ['node_modules/.bin/tsc', '-b', ...selection.projects] });
  if (source.length > 0) jobs.push({ name: 'typed-lint', after: ['generated-inputs', ...(selection.projects.length > 0 ? ['types'] : [])],
    command: [node, 'node_modules/oxlint/bin/oxlint', '--type-aware', '-c', need('.oxlintrc.json'), ...source] });
  if (selection.products.length > 0) jobs.push({ name: 'products', after: ['generated-inputs'],
    command: heavy([node, '--input-type=module', '--eval',
      `const {buildShardfiles}=await import('./scripts/build-shardfiles.mjs');await buildShardfiles(process.cwd(),{strict:true,reuse:true,scope:${JSON.stringify(selection.products)}});`]) });
  for (const dependent of [false, true]) {
    const tests = selection.tests.filter(file => ((products[file]?.length ?? 0) > 0) === dependent);
    const ts = tests.filter(file => file.endsWith('.test.ts'));
    const native = tests.filter(file => /\.(?:test|spec)\.[cm]?js$/u.test(file));
    const unsupported = tests.filter(file => !ts.includes(file) && !native.includes(file));
    if (unsupported.length > 0) throw new Error(`No push runner for selected suites: ${unsupported.join(', ')}`);
    if (dependent && tests.some(file => products[file]?.some(product => !selection.products.includes(product))))
      throw new Error('Selected test product is absent from the shared gate selection');
    const after = ['generated-inputs', ...(dependent ? ['products'] : [])];
    const suffix = dependent ? 'products' : 'source';
    if (ts.length > 0) jobs.push({ name: `tests-${suffix}`, after,
      command: [node, 'node_modules/vitest/vitest.mjs', 'run', '--config', need('scripts/vitest-push.config.ts'), ...ts] });
    if (native.length > 0) jobs.push({ name: `node-tests-${suffix}`, after,
      command: [node, '--test', ...native] });
  }
  return jobs;
}

/** @param {string} root @param {import('./push-subset-jobs.mjs').PushSubsetJob[]} jobs
 * @param {number} deadline @param {NodeJS.ProcessEnv} [env]
 * @param {import('./push-subset-jobs.mjs').PushSubsetPorts} [ports]
 * @returns {Promise<import('./push-subset-jobs.mjs').PushSubsetResult[]>} */
export async function runPushSubset(root, jobs, deadline, env = process.env, ports = NATIVE_PORTS) {
  const names = new Set(jobs.map(job => job.name));
  if (names.size !== jobs.length || jobs.some(job => job.after.some(name => !names.has(name))))
    throw new Error('Invalid push subset dependencies');
  /** @type {Map<string,import('./push-subset-jobs.mjs').PushSubsetResult>} */
  const results = new Map();
  const pending = new Map(jobs.map(job => [job.name, job]));
  /** @type {Map<string,Promise<import('./precommit-jobs.mjs').CommitResult>>} */
  const active = new Map();
  const controller = new AbortController();
  let expired = false;
  // Abort enumerates owned descendants, including heavy-lane's detached child,
  // before killing its parent. The process-group-only fallback fires later.
  const timer = setTimeout(() => { expired = true; controller.abort(); }, Math.max(0, deadline - performance.now()));
  try {
    while (pending.size > 0 || active.size > 0) {
      for (const [name, job] of pending) {
        const blocked = job.after.filter(parent => {
          const result = results.get(parent);
          return result !== undefined && result.code !== 0;
        });
        if (blocked.length > 0) {
          results.set(name, { name, code: 1, timedOut: false, blocked, output: `Blocked by ${blocked.join(', ')}` });
          pending.delete(name);
        }
      }
      const ready = [...pending.values()].filter(job => job.after.every(parent => results.get(parent)?.code === 0));
      for (const job of ready) {
        pending.delete(job.name);
        if (performance.now() >= deadline) {
          expired = true; controller.abort();
          results.set(job.name, { name: job.name, code: 124, timedOut: true, output: 'Shared push deadline reached before this step started' });
          continue;
        }
        active.set(job.name, ports.run(root, [job], deadline + 1000, env, controller.signal).then(checked => {
          const result = checked[0];
          if (checked.length !== 1 || result?.name !== job.name) throw new Error('Incomplete push subset results');
          return result;
        }));
      }
      if (active.size === 0) {
        if (pending.size > 0 && ready.length === 0) throw new Error('Cyclic push subset dependencies');
        continue;
      }
      const result = await Promise.race(active.values());
      results.set(result.name, expired && result.cancelled ? { ...result, code: 124, timedOut: true } : result);
      active.delete(result.name);
    }
    return jobs.map(job => {
      const result = results.get(job.name);
      if (result === undefined) throw new Error(`Missing push result: ${job.name}`);
      return result;
    });
  } finally {
    clearTimeout(timer);
    // Tooling errors also drain every already-started sibling before the
    // mirror lease can be released or moved to another commit.
    controller.abort();
    await Promise.allSettled(active.values());
  }
}

/** @param {readonly import('./push-subset-jobs.mjs').PushSubsetResult[]} results */
export function pushSubsetVerdict(results) {
  const byName = new Map(results.map(result => [result.name, result]));
  if (byName.size !== results.length) throw new Error('Duplicate push subset result');
  /** @type {Map<string,'passed'|'failed'|'unfinished'>} */
  const states = new Map();
  const visiting = new Set();
  /** @param {string} name @returns {'passed'|'failed'|'unfinished'} */
  const state = name => {
    const cached = states.get(name);
    if (cached !== undefined) return cached;
    const result = byName.get(name);
    if (result === undefined || visiting.has(name)) throw new Error('Invalid blocked push subset result');
    visiting.add(name);
    /** @type {'passed'|'failed'|'unfinished'} */
    let value;
    if (result.blocked !== undefined) {
      const parents = result.blocked.map(state);
      if (parents.every(parent => parent === 'passed')) throw new Error('Unjustified blocked push result');
      value = parents.includes('failed') ? 'failed' : 'unfinished';
    } else value = result.code === 0 ? 'passed'
      : commitCheckFailed(result) || /\berror TS\d+:/u.test(result.output) ? 'failed' : 'unfinished';
    visiting.delete(name); states.set(name, value); return value;
  };
  return { failed: results.filter(result => state(result.name) === 'failed').map(result => result.name),
    unfinished: results.filter(result => state(result.name) === 'unfinished').map(result => result.name) };
}

/** @param {readonly import('./push-subset-jobs.mjs').PushSubsetJob[]} jobs @param {readonly string[]} names */
export function selectPushSteps(jobs, names) {
  const byName = new Map(jobs.map(job => [job.name, job]));
  if (byName.size !== jobs.length || new Set(names).size !== names.length) throw new Error('Duplicate CI handoff step');
  const selected = new Set(), visiting = new Set();
  const include = (/** @type {string} */ name) => {
    if (selected.has(name)) return;
    const job = byName.get(name);
    if (job === undefined || visiting.has(name)) throw new Error(`Invalid CI handoff dependency: ${name}`);
    visiting.add(name);
    for (const parent of job.after) include(parent);
    visiting.delete(name); selected.add(name);
  };
  for (const name of names) include(name);
  return jobs.filter(job => selected.has(job.name));
}

/** Keep the pipe control write compact; full diagnostics are emitted separately.
 * @param {readonly import('./push-subset-jobs.mjs').PushSubsetResult[]} results */
export function pushSubsetControlRecord(results) {
  return { results: results.map(result => ({ ...result, output: '' })), verdict: pushSubsetVerdict(results) };
}

/** @param {readonly import('./push-subset-jobs.mjs').PushSubsetJob[]} jobs @param {readonly string[]} roots
 * @returns {import('./push-subset-jobs.mjs').PushSubsetJob} */
export function nativeOutputReplayJob(jobs, roots) {
  if (!jobs.some(job => job.name === 'generated-inputs') || roots.length === 0 ||
      roots.some(file => file.startsWith('-') || file.startsWith('/') || file.split('/').some(part => ['', '.', '..'].includes(part)) || !/\.[cm]?[jt]sx?$/u.test(file)))
    throw new Error('Native output handoff requires the real producer and exact source roots');
  // Normal CI generation already owns and verifies these bytes. The ordinary
  // native linter reads that exact checkout, without a second Git-only provider.
  return { name: 'native-outputs', after: ['generated-inputs'],
    command: [process.execPath, 'scripts/lint-fast.mjs', ...new Set(roots)] };
}
