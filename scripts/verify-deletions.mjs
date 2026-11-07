// Prepare a reviewable deletion ledger before any source file is removed.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const home = process.env.HOME;
const lift = resolve(home, '.cache/wildshard/lift-work/d3');
const repos = ['engine', 'sharddev', 'shard-driftwood', 'shard-sky-reach', 'shard-dunes', 'shard-nalati', 'shard-pine-hollow', 'shard-nine-dragon', 'shard-open-plots'];
const reports = new Map(repos.map(repo => [repo, JSON.parse(readFileSync(resolve(lift, `${repo}.json`), 'utf8'))]));
const claims = new Map();
for (const [repo, report] of reports) for (const path of report.claimed) if (!claims.has(path)) claims.set(path, repo);
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const rows = git(['ls-tree', '-rz', 'HEAD']).split('\0').filter(Boolean).map(row => { const [meta, path] = row.split('\t'); return { path, blob: meta.split(' ')[2] }; });
const keep = new Set(JSON.parse(readFileSync('release-keep.json', 'utf8')).files);
const repoTrees = new Map(repos.map(repo => {
  const root = resolve(home, 'projects/games/wildshard', repo);
  const tree = gitAt(root, ['ls-tree', '-rz', 'HEAD']).split('\0').filter(Boolean);
  return [repo, { root, tree, blobs: new Map(tree.map(entry => [entry.split('\t')[0].split(' ')[2], entry.split('\t')[1]])), paths: new Set(tree.map(entry => entry.split('\t')[1])), commit: gitAt(root, ['rev-parse', 'HEAD']).trim() }];
}));
const files = [];
function mapped(path, repo, info) {
  const options = [path];
  if (repo === 'engine') {
    options.push(path.replace(/^src\/(engine|game)\/(client|shared|server|cook)\//u, 'src/$2/$1/'));
    options.push(path.replace(/^src\/(engine|game)\/test\//u, 'src/test/$1/'));
    options.push(path.replace(/^src\/(engine|game)\/([^/]+\.test\.ts)$/u, 'src/test/$1/$2'));
    if (path === 'src/sharddev/author.ts') options.push('src/shared/host/author.ts');
    if (path === 'src/sharddev/formatJsonSchema.ts') options.push('src/shared/host/formatJsonSchema.ts');
    if (path === 'src/sharddev/bake/format-hook.mjs') options.push('scripts/format-hook.mjs');
    const app = /^src\/([^/]+)$/u.exec(path); if (app) options.push(`src/client/app/${app[1]}`);
    const sdk = /^src\/sdk\/(.+)$/u.exec(path);
    if (sdk) for (const side of ['client','shared','server','cook','test']) options.push(`src/${side}/host/${sdk[1]}`);
  }
  return options.find(candidate => info.paths.has(candidate));
}
for (const row of rows) {
  if (keep.has(row.path) || /^(?:art|progress|sources|docs|project|\.claude|\.agents|\.codex|ios|android|admin|api|deploy\/ota)\//u.test(row.path) || row.path.includes('/art/') || /(?:^|\/)README\.md$/u.test(row.path)) continue;
  let repo = claims.get(row.path);
  if (repo !== undefined && !repoTrees.get(repo).blobs.has(row.blob) && mapped(row.path, repo, repoTrees.get(repo)) === undefined) {
    const other = [...repoTrees].find(([, info]) => info.blobs.has(row.blob));
    if (other !== undefined) repo = other[0];
  }
  if (repo === undefined) continue;
  const info = repoTrees.get(repo), root = info.root;
  const target = info.blobs.get(row.blob) ?? mapped(row.path, repo, info);
  const same = target === undefined ? undefined : `blob\t${target}`;
  let reason = info.blobs.has(row.blob) ? 'Byte-identical blob in installed home' : target !== undefined ? 'Verified lifted target; imports and layer paths rewritten' : 'Unresolved: keep until a disposition is verified';
  if (row.path.endsWith('.test.ts') && same === undefined && repo.startsWith('shard-')) {
    const ledger = JSON.parse(readFileSync(resolve(root, 'test/lift-disposition.json'), 'utf8'));
    const disposition = ledger.find(entry => entry.file === row.path);
    if (disposition !== undefined) reason = `J186 ${disposition.disposition}: ${disposition.reason}`;
  }
  files.push({ ...row, home: repo, commit: info.commit, target: same?.split('\t')[1] ?? null, reason });
}
function gitAt(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
writeFileSync('release-deletions.json', JSON.stringify({ schema: 1, source: git(['rev-parse', 'HEAD']).trim(), files }, null, 2) + '\n');
console.log(`Reviewed ${files.length} homed deletions; root source not deleted by this command`);
