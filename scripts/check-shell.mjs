// Exact Git inventory checks for the deployment shell; engine owns its layers.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validatePin } from './engine-pin.mjs';
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
export function checkShell(revision = 'HEAD') {
  const index = revision === '--index';
  const entries = git(index ? ['ls-files', '--stage', '-z'] : ['ls-tree', '-rz', revision]).split('\0').filter(Boolean).map(row => row.split('\t'));
  const blobs = new Map(entries.map(([meta, path]) => [path, meta.split(' ')[index ? 1 : 2]]));
  const files = [...blobs.keys()];
  const names = new Set(files);
  const read = file => git(['show', index ? `:${file}` : `${revision}:${file}`]);
  const pin = validatePin(JSON.parse(read('engine.pin.json')));
  const ledger = JSON.parse(read('release-deletions.json'));
  const retiring = new Set(ledger.state === 'retiring' ? ledger.files.map(row => row.path) : []);
  const forbidden = files.filter(file => !file.endsWith('/README.md') && (/^(?:drafts|vite|out|engine-source|shard-sources)\//u.test(file) || file.startsWith('src/') && !file.startsWith('src/shards/blender-template/') && !file.includes('/art/') && !file.endsWith('/README.md')));
  if (forbidden.filter(file => !retiring.has(file)).length > 0) throw new Error(`Shell contains project source: ${forbidden.filter(file => !retiring.has(file)).slice(0, 12).join(', ')}`);
  const pkg = JSON.parse(read('package.json'));
  if (Object.values(pkg.scripts ?? {}).some(value => /build-shardfiles|sharddev|src\/|gen:inputs/u.test(value))) throw new Error('Author compilation on release path');
  for (const file of ['.github/workflows/admin-deploy.yml', '.github/workflows/size-watch.yml']) {
    if (files.includes(file) && /^\s*(?:schedule:|cron:)/mu.test(read(file))) throw new Error(`Retired cron still active: ${file}`);
  }
  const workflow = read('.github/workflows/deploy.yml');
  if (!workflow.includes('node scripts/install-release.mjs install') || !workflow.includes('node scripts/build-release.mjs') || !workflow.includes('needs: [build-pinned, prove-pinned]')) throw new Error('CI does not gate the installed artifact');
  for (const file of ['scripts/repo-size.mjs', 'scripts/storage-policy.json', '.github/workflows/storage.yml']) if (!files.includes(file)) throw new Error(`Storage gate has no running home: ${file}`);
  for (const row of ledger.files) {
    if (names.has(row.path)) {
      if (ledger.state !== 'retiring') throw new Error(`Deleted source returned: ${row.path}`);
      const held = blobs.get(row.path);
      if (held !== row.blob) throw new Error(`Retiring source changed: ${row.path}`);
    }
    if (!/^[a-f0-9]{40}$/u.test(row.blob) || typeof row.home !== 'string' || row.reason.length < 8) throw new Error('Invalid deletion evidence');
  }
  console.log(`Shell ${ledger.state}: verified: engine ${pin.engine.tag}, seven shards, epoch ${pin.saveEpoch}, ${ledger.files.length} deletions, no active local project source`);
}
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) checkShell(process.argv[2] ?? 'HEAD');
