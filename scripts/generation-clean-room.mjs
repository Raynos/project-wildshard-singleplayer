// G320: a cold, destructive rehearsal in an owned archive, never in the source checkout.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditAuthoringInputs, isAuthoringInput } from './authoring-inputs.mjs';
import { discoverGeneration, generateShardJob } from './generate.mjs';
import { linkNodeModules } from './link-node-modules.mjs';

/** A retained byte is evidence only when present; absent build outputs need their pinned sidecar hash.
 * @param {string} root @param {string} file */
function sha(root, file) {
  return existsSync(resolve(root, file)) ? createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex') : null;
}

/** Delete runtime and legacy directories only inside this owned archive, before dependencies are linked.
 * @param {string} directory @param {string} prefix @param {string[]} removed */
function removeTrusted(directory, prefix, removed) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const name = `${prefix}/${entry.name}`;
    if (entry.name === 'runtime' || entry.name.endsWith('-legacy')) {
      rmSync(resolve(directory, entry.name), {recursive: true, force: true}); removed.push(name);
    } else if (entry.isDirectory()) removeTrusted(resolve(directory, entry.name), name, removed);
  }
}

/** Source metadata can key a job, but cannot supply geometry or gameplay authoring.
 * @param {string} path */
function metadata(path) { return ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(path); }

/** Rehearse every registered output from a pinned archive and fresh cache. Every blocked producer is explicit.
 * Darwin-only comparisons stay unavailable on Linux; report-only never grants a match to an unrun job.
 * @param {string} root
 * @param {{pin:string,onUpdate?:(report:import('./generation-clean-room.mjs').CleanRoomReport)=>void}} options
 * @returns {Promise<import('./generation-clean-room.mjs').CleanRoomReport>} */
export async function cleanRoomGeneration(root, options) {
  const work = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-clean-room-')));
  const tree = resolve(work, 'tree'), cacheDir = resolve(work, 'cache');
  /** @type {import('./generation-clean-room.mjs').CleanRoomReport} */
  const report = {schema: 'generation-clean-room/1', pin: options.pin, reportOnly: true,
    platform: process.platform, arch: process.arch, node: process.version, removed: [], jobs: [], unregistered: [], shardfiles: [], sourceProbes: []};
  try {
    mkdirSync(tree);
    const archive = resolve(work, 'source.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, options.pin], {cwd: root});
    execFileSync('tar', ['-xf', archive, '-C', tree]);
    const discovery = discoverGeneration(tree);
    report.unregistered = discovery.unregistered;
    const retained = new Map(discovery.jobs.map(job => [job.id, Object.fromEntries(job.outputs.map(file => [file, sha(tree, file) ?? job.buildOutputs?.[file] ?? null]))]));
    removeTrusted(resolve(tree, 'src'), 'src', report.removed);
    // Delete ALL generated outputs before the first producer: one job cannot consume another job's retained bytes.
    for (const job of discovery.jobs) for (const file of job.outputs) rmSync(resolve(tree, file), {force: true});
    linkNodeModules(root, tree);
    const coatPage = 'src/shards/pine-hollow/generators/pineCoatsPage.ts';
    if (existsSync(resolve(tree, coatPage))) report.sourceProbes.push({shard: 'pine-hollow', ...auditAuthoringInputs(tree, 'pine-hollow', coatPage)});
    for (const job of discovery.jobs) {
      /** @type {import('./generation-clean-room.mjs').CleanRoomJob} */
      const row = {id: job.id, entry: job.entry, status: 'blocked', reasons: [], outputs: []};
      if (job.shard === null) row.reasons.push('Producer has no shard-owned authoring sources');
      else {
        const audit = auditAuthoringInputs(tree, job.shard, job.entry);
        row.reasons.push(...audit.issues.map(issue => `${issue.reason}: ${issue.from ?? '<entry>'} -> ${issue.file}`));
        const forbidden = job.inputRoots.filter(file => !isAuthoringInput(file, job.shard ?? '') && !metadata(file));
        row.reasons.push(...forbidden.map(file => `Input root outside authoring: ${file}`));
      }
      if (job.capture === true || job.preview === true || job.browser === true) row.reasons.push('Page/browser-bound producer cannot run in the authoring clean room');
      if ((job.seedOutputs?.length ?? 0) > 0) row.reasons.push('Producer still imports a generated output as a source seed');
      if (job.command.includes('--import')) row.reasons.push('Runtime loader must be replaced by an authoring-only producer command');
      if (job.platform === 'darwin' && process.platform !== 'darwin') row.reasons.push('Darwin-only byte comparison unavailable on this platform');
      const expected = retained.get(job.id);
      if (expected === undefined) throw new Error(`Missing retained evidence: ${job.id}`);
      if (Object.values(expected).some(hash => hash === null)) row.reasons.push('An output has neither retained bytes nor a pinned sidecar hash');
      if (row.reasons.length === 0) {
        try {
          const result = await generateShardJob(tree, job, {cacheDir});
          if (result.hit) throw new Error('Clean-room producer unexpectedly reused a warm cache');
          row.outputs = job.outputs.map(file => ({file, expected: expected[file] ?? null, generated: result.hashes[file] ?? null, exact: expected[file] === result.hashes[file]}));
          row.status = row.outputs.every(output => output.exact) ? 'matched' : 'different';
          // Only verified products become inputs for a later producer in this same clean tree.
          if (row.status === 'matched') for (const file of job.outputs) {
            mkdirSync(dirname(resolve(tree, file)), {recursive: true});
            copyFileSync(resolve(result.directory, file), resolve(tree, file));
          }
        } catch (error) {row.status = 'failed'; row.reasons.push(error instanceof Error ? error.message : String(error));}
      }
      report.jobs.push(row);
      options.onUpdate?.(report);
    }
    // A legacy native manifest is not a product generator. Until each product has a retained job it remains a gap.
    const shards = readdirSync(resolve(tree, 'src/shards'), {withFileTypes: true});
    for (const shard of shards.filter(entry => entry.isDirectory() && !entry.name.endsWith('-legacy'))) {
      const products = discovery.jobs.filter(job => job.shard === shard.name && job.outputs.some(file => file.endsWith('/shard.json')));
      const matched = products.length > 0 && products.every(job => report.jobs.some(row => row.id === job.id && row.status === 'matched'));
      report.shardfiles.push({shard: shard.name, status: matched ? 'matched' : 'unavailable', reason: matched ? 'Cold product regenerated exactly' : products.length === 0 ? 'No retained shardfile generation job declared' : 'Shardfile generation did not match'});
    }
    options.onUpdate?.(report);
    return report;
  } finally {rmSync(work, {recursive: true, force: true});}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    const output = resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? '.git/generation-clean-room.json');
    /** @type {{GITHUB_SHA?:string}} */
    const environment = process.env;
    const pin = environment.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
    mkdirSync(dirname(output), {recursive: true});
    const report = await cleanRoomGeneration(root, {pin, onUpdate: partial => {writeFileSync(output, `${JSON.stringify(partial, null, 2)}\n`);}});
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.info(`Clean room: ${String(report.jobs.filter(job => job.status === 'matched').length)} matched, ${String(report.jobs.filter(job => job.status !== 'matched').length)} open; report-only`);
  } catch (error) {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;}
}
