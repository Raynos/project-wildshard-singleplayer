// J189: immutable release inputs. Shard authors are installed, never built here.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ORG = 'project-wildshard';
export const SHARDS = ['shard-driftwood', 'shard-sky-reach', 'shard-dunes', 'shard-nalati', 'shard-pine-hollow', 'shard-nine-dragon', 'shard-open-plots'];
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export function validatePin(pin, floor = 1) {
  if (pin.schema !== 1 || !Number.isSafeInteger(pin.saveEpoch) || pin.saveEpoch < floor || pin.engine.repo !== 'engine' || !/^v\d+\.\d+\.\d+$/u.test(pin.engine.tag) || !/^[a-f0-9]{40}$/u.test(pin.engine.commit)) throw new Error('Invalid engine pin or save epoch downgrade');
  if (pin.shards.length !== SHARDS.length || SHARDS.some(repo => pin.shards.filter(row => row.repo === repo && /^[a-f0-9]{40}$/u.test(row.commit)).length !== 1)) throw new Error('All seven immutable shard revisions are required');
  return pin;
}
export function tagCommit(repo, tag) {
  const rows = run('git', ['ls-remote', `https://github.com/${ORG}/${repo}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`]).split('\n').map(line => line.split(/\s+/u));
  const peeled = rows.find(row => row[1] === `refs/tags/${tag}^{}`) ?? rows.find(row => row[1] === `refs/tags/${tag}`);
  if (peeled === undefined || !/^[a-f0-9]{40}$/u.test(peeled[0] ?? '')) throw new Error(`Missing immutable tag ${repo}#${tag}`);
  return peeled[0];
}
export function green(repo, commit, workflows = ['ci']) {
  const runs = JSON.parse(run('gh', ['api', `repos/${ORG}/${repo}/actions/runs?head_sha=${commit}&per_page=100`]));
  for (const name of workflows) {
    const latest = runs.workflow_runs.filter(row => row.name === name && row.head_sha === commit && row.event === 'push').sort((a, b) => b.id - a.id)[0];
    if (latest?.conclusion !== 'success') throw new Error(`${repo} ${commit}: latest exact-SHA ${name} is not green`);
  }
}
export function verify(pin) {
  validatePin(pin);
  if (tagCommit('engine', pin.engine.tag) !== pin.engine.commit) throw new Error('Engine tag moved');
  green('engine', pin.engine.commit, ['ci', 'ring-1']);
  const metadata = JSON.parse(run('gh', ['api', `repos/${ORG}/engine/contents/save-epoch.json?ref=${pin.engine.commit}`, '-H', 'Accept: application/vnd.github.raw+json']));
  if (metadata.saveEpoch !== pin.saveEpoch) throw new Error('Engine save epoch differs from pin');
  for (const shard of pin.shards) green(shard.repo, shard.commit);
  return pin;
}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, tag, ...shardRefs] = process.argv.slice(2);
  const current = validatePin(JSON.parse(readFileSync('engine.pin.json', 'utf8')));
  if (command === 'verify') verify(current);
  else if (command === 'bump' && tag !== undefined) {
    const commit = tagCommit('engine', tag);
    const metadata = JSON.parse(run('gh', ['api', `repos/${ORG}/engine/contents/save-epoch.json?ref=${commit}`, '-H', 'Accept: application/vnd.github.raw+json']));
    const shards = current.shards.map(row => {
      const selected = shardRefs.find(ref => ref.startsWith(`${row.repo}=`));
      if (selected === undefined) return row;
      const ref = selected.slice(row.repo.length + 1);
      return { repo: row.repo, commit: /^[a-f0-9]{40}$/u.test(ref) ? ref : tagCommit(row.repo, ref) };
    });
    if (shardRefs.some(ref => !SHARDS.includes(ref.split('=')[0]))) throw new Error('Unknown shard pin');
    const next = validatePin({ schema: 1, engine: { repo: 'engine', tag, commit }, saveEpoch: metadata.saveEpoch, shards }, Math.max(1, current.saveEpoch));
    verify(next);
    writeFileSync('engine.pin.json', `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Pinned engine ${tag} ${commit}, epoch ${next.saveEpoch}, seven shards`);
  } else throw new Error('Usage: node scripts/engine-pin.mjs verify|bump vX.Y.Z [shard-repo=tag-or-SHA...]');
}
