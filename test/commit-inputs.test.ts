import { expect, it } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';
import { restoreCommitInputs } from '../scripts/commit-inputs.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise an isolated real index and its immutable export.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this fixture's temporary files are written or removed.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place the fixture outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture-owned paths.
import { join } from 'node:path';

it('generates from staged bytes, includes tracked tables and refuses corrupt cached inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'commit-inputs-fixture-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null');
    for (const dir of ['src', 'lint', 'scripts']) mkdirSync(join(root, dir));
    writeFileSync(join(root, 'package.json'), '{"name":"fixture"}');
    writeFileSync(join(root, 'src/value.ts'), 'before');
    writeFileSync(join(root, 'lint/ask-ids.json'), '[]');
    writeFileSync(join(root, 'lint/shard-words.generated.json'), '{}');
    writeFileSync(join(root, 'scripts/generation-jobs.json'), '{"jobs":[]}');
    writeFileSync(join(root, 'scripts/gen.mjs'), `import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/assets/physics',{recursive:true});writeFileSync('public/assets/physics/rapier.wasm',new Uint8Array([0,97,115,109]));
const value=readFileSync('src/value.ts','utf8');
writeFileSync('src/value.generated.json',JSON.stringify({value}));
writeFileSync('lint/ask-ids.json',JSON.stringify([value]));`);
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture');
    writeFileSync(join(root, 'src/value.ts'), 'staged'); git('add', 'src/value.ts');
    writeFileSync(join(root, 'src/value.ts'), 'foreign working bytes');
    precommitInputs(root);
    expect(git('show', ':lint/ask-ids.json')).toBe('["staged"]');
    expect(readFileSync(join(root, 'src/value.ts'), 'utf8')).toBe('foreign working bytes');
    const tree = git('write-tree'), target = join(root, 'restore');
    mkdirSync(target);
    restoreCommitInputs(root, tree, target);
    expect([...readFileSync(join(target, 'public/assets/physics/rapier.wasm'))]).toEqual([0,97,115,109]);
    expect(readFileSync(join(target, 'src/value.generated.json'), 'utf8')).toBe('{"value":"staged"}');
    const hash = execFileSync('node', ['--input-type=module', '-e', "import{createHash}from'node:crypto';console.log(createHash('sha256').update('{\"value\":\"staged\"}').digest('hex'))"], { encoding: 'utf8' }).trim();
    writeFileSync(join(root, '.git/commit-inputs/blobs', hash), 'corrupt');
    expect(() => restoreCommitInputs(root, tree, target)).toThrow('Corrupt commit-time');
    expect(() => restoreCommitInputs(root, 'HEAD', target)).toThrow('Missing commit-time');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
