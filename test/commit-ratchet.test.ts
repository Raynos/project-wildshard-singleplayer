// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual detached reader against owned Git repositories.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the fixture's exact pinned JSON bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Every write is confined to an owned temporary fixture.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Canonical temporary Git roots.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files without touching the shared index.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Child fixtures inherit only intentional process settings.
import { env } from 'node:process';
import { expect, it } from 'vitest';

function fixture(run: (root: string, put: (path: string, value: string) => void, git: (args: string[]) => string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'commit-ratchet-fixture-'));
  const put = (path: string, value: string): void => { const file = join(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  const git = (args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    put('package.json', '{"type":"module"}');
    put('.oxlintrc.ratchet.json', '{}');
    put('src/engine/value.ts', 'export const value = "committed";\n');
    put('scripts/generation-jobs.json', '{"jobs":[]}');
    for (const file of ['scripts/commit-ratchet.sh', 'scripts/link-node-modules.mjs', 'scripts/precommit-generated-data.mjs']) {
      mkdirSync(dirname(join(root, file)), { recursive: true }); cpSync(file, join(root, file));
    }
    put('lint/ratchet.mjs', `import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync('src/engine/value.ts', 'utf8');
if (process.env['FIXTURE_REQUIRE_JSON']) readFileSync('src/shards/example/data/rows.generated.json');
writeFileSync(process.env['FIXTURE_MEASURE_MARKER'], 'measured');
console.log(JSON.stringify({ source, gitKeys: Object.keys(process.env).filter(key => ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'].includes(key)) }));
`);
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.name', 'Ratchet fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
    git(['config', 'core.hooksPath', '.no-fixture-hooks']);
    git(['add', '--', 'src', 'scripts', 'lint', 'package.json', '.oxlintrc.ratchet.json']);
    git(['commit', '-qm', 'fixture baseline']);
    run(root, put, git);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('reads committed source and helper bytes after clearing inherited private Git state', () => {
  fixture((root, put, git) => {
    const sha = git(['rev-parse', 'HEAD']);
    put('src/engine/value.ts', 'export const value = "foreign staged source";\n');
    git(['add', '--', 'src/engine/value.ts']);
    put('scripts/link-node-modules.mjs', 'throw new Error("foreign working helper executed");\n');
    const result = spawnSync('bash', [resolve('scripts/commit-ratchet.sh'), sha], { cwd: root, encoding: 'utf8', env: {
      ...env, COMMIT_RATCHET_LOCKED: '1', GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root,
      GIT_INDEX_FILE: join(root, '.git/index'), FIXTURE_MEASURE_MARKER: join(root, '.git/measured'),
    } });
    expect(result.status, result.stderr).toBe(0);
    const report = readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8');
    expect(report).toContain(`${sha} ok`);
    expect(report).toContain('committed');
    expect(report).not.toContain('foreign');
    expect(report).toContain('"gitKeys":[]');
    expect(git(['diff', '--cached', '--name-only'])).toBe('src/engine/value.ts');
  });
});

it('derives missing vocabulary through the committed helper before measurement', () => {
  fixture((root, put, git) => {
    put('scripts/gen-shard-words.mjs', `import{readFileSync,writeFileSync}from'node:fs';writeFileSync('lint/shard-words.generated.json',JSON.stringify({source:readFileSync('src/engine/value.ts','utf8')}));`);
    put('lint/wildshard-plugin.js', '// This plugin consumes the generated vocabulary.');
    put('lint/ratchet.mjs', `import{readFileSync}from'node:fs';const words=JSON.parse(readFileSync('lint/shard-words.generated.json','utf8'));if(!words.source.includes('committed'))throw Error('wrong vocabulary');console.log('immutable vocabulary passed');`);
    git(['add', '--', 'scripts/gen-shard-words.mjs', 'lint/ratchet.mjs', 'lint/wildshard-plugin.js']);
    git(['commit', '-qm', 'build-derived vocabulary']);
    const sha = git(['rev-parse', 'HEAD']);
    put('scripts/gen-shard-words.mjs', "throw Error('working helper must not execute');");
    put('lint/shard-words.generated.json', 'foreign invalid JSON');
    const result = spawnSync('bash', [resolve('scripts/commit-ratchet.sh'), sha], { cwd: root, encoding: 'utf8', env: { ...env, COMMIT_RATCHET_LOCKED: '1' } });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8')).toContain(`${sha} ok`);
    expect(readFileSync(join(root, 'lint/shard-words.generated.json'), 'utf8')).toBe('foreign invalid JSON');
  });
});

it('imports the defining guard reader and declarations through the real narrowed commit export',()=>{
  fixture((root,put,git)=>{
    for(const file of ['scripts/guard-counts.mjs','scripts/guard-index-tree.mjs','scripts/guard-index-tree.d.mts'])put(file,readFileSync(file,'utf8'));
    put('.oxlintrc.json','{"overrides":[]}');
    put('lint/ratchet.mjs',`import {hardRules} from '../scripts/guard-counts.mjs';
hardRules('.oxlintrc.json');readFileSync('scripts/guard-index-tree.d.mts');
${readFileSync(join(root,'lint/ratchet.mjs'),'utf8')}`);
    mkdirSync(join(root,'node_modules'));symlinkSync(resolve('node_modules/vite'),join(root,'node_modules/vite'));
    git(['add','--','scripts','lint/ratchet.mjs','.oxlintrc.json']);git(['commit','-qm','real guard import fixture']);
    const sha=git(['rev-parse','HEAD']);
    put('scripts/guard-index-tree.mjs',"throw Error('foreign guard helper');");
    const result=spawnSync('bash',[resolve('scripts/commit-ratchet.sh'),sha],{cwd:root,encoding:'utf8',env:{...env,COMMIT_RATCHET_LOCKED:'1',FIXTURE_MEASURE_MARKER:join(root,'.git/measured')}});
    expect(result.status,result.stderr).toBe(0);
    expect(readFileSync(join(root,'.git/ratchet-last.txt'),'utf8')).toContain(`${sha} ok`);
    expect(readFileSync(join(root,'.git/measured'),'utf8')).toBe('measured');
  });
});

it('refuses missing pinned JSON before measurement and admits only its exact bytes', () => {
  fixture((root, put, git) => {
    const path = 'src/shards/example/data/rows.generated.json', bytes = '{"rows":[]}\n';
    put('scripts/generation-jobs.json', JSON.stringify({ jobs: [{ id: 'example-rows', buildOutputs: {
      [path]: createHash('sha256').update(bytes).digest('hex'),
    } }] }));
    git(['commit', '-qm', 'pin JSON fixture', '--', 'scripts/generation-jobs.json']);
    const sha = git(['rev-parse', 'HEAD']), marker = join(root, '.git/measured');
    const command = (): void => {
      const result = spawnSync('bash', [resolve('scripts/commit-ratchet.sh'), sha], { cwd: root, encoding: 'utf8', env: {
        ...env, COMMIT_RATCHET_LOCKED: '1', FIXTURE_MEASURE_MARKER: marker, FIXTURE_REQUIRE_JSON: '1',
      } });
      expect(result.status, result.stderr).toBe(0);
    };
    command();
    expect(existsSync(marker)).toBe(false);
    const missing = readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8');
    expect(missing).toContain(`${sha} REFUSED`);
    expect(missing).toContain(`Missing pinned generated guard data: ${path} (job example-rows)`);
    expect(missing).not.toContain('Ratchet rose');
    put(path, bytes);
    command();
    expect(readFileSync(marker, 'utf8')).toBe('measured');
    expect(readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8')).toContain(`${sha} ok`);
  });
});

it('refuses a historical export whose committed helper silently skips missing JSON', () => {
  fixture((root, put, git) => {
    const path = 'src/shards/example/data/rows.generated.json';
    put('scripts/generation-jobs.json', JSON.stringify({ jobs: [{ id: 'historical-rows', buildOutputs: {
      [path]: createHash('sha256').update('{"rows":[]}\n').digest('hex'),
    } }] }));
    put('scripts/precommit-generated-data.mjs', '// Historical missing-data fallback leaves the export incomplete.\n');
    git(['commit', '-qm', 'pin historical JSON', '--', 'scripts/generation-jobs.json', 'scripts/precommit-generated-data.mjs']);
    const sha = git(['rev-parse', 'HEAD']), marker = join(root, '.git/measured');
    const result = spawnSync('bash', [resolve('scripts/commit-ratchet.sh'), sha], { cwd: root, encoding: 'utf8', env: {
      ...env, COMMIT_RATCHET_LOCKED: '1', FIXTURE_MEASURE_MARKER: marker,
    } });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(marker)).toBe(false);
    const report = readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8');
    expect(report).toContain(`${sha} REFUSED`);
    expect(report).toContain(`Missing pinned generated guard data: ${path} (job historical-rows)`);
    expect(report).not.toContain('Ratchet rose');
  });
});


it('refuses wrong JSON copied by a historical CLI-only helper before measurement', () => {
  fixture((root, put, git) => {
    const path = 'src/shards/example/data/rows.generated.json';
    put('scripts/generation-jobs.json', JSON.stringify({jobs: [{id: 'old-cli', buildOutputs: {
      [path]: createHash('sha256').update('{"rows":[]}\n').digest('hex'),
    }}]}));
    put('scripts/precommit-generated-data.mjs', `import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
if (process.argv[1].endsWith('precommit-generated-data.mjs')) {
  const file=resolve(process.argv[3], '${path}'); mkdirSync(dirname(file), {recursive:true}); writeFileSync(file, '{"wrong":true}');
}
`);
    git(['commit', '-qm', 'historical CLI fixture', '--', 'scripts/generation-jobs.json', 'scripts/precommit-generated-data.mjs']);
    const sha=git(['rev-parse', 'HEAD']), marker=join(root, '.git/measured');
    const result=spawnSync('bash', [resolve('scripts/commit-ratchet.sh'), sha], {cwd:root, encoding:'utf8', env:{...env, COMMIT_RATCHET_LOCKED:'1', FIXTURE_MEASURE_MARKER:marker}});
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(marker)).toBe(false);
    const report=readFileSync(join(root, '.git/ratchet-last.txt'), 'utf8');
    expect(report).toContain(`${sha} REFUSED`);
    expect(report).toContain('does not match staged hash');
    expect(report).not.toContain('Ratchet rose');
  });
});
