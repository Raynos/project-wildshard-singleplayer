// oxlint-disable-next-line import/no-nodejs-modules -- Prove the workspace CLI builds without an installed SDK distribution.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable CLI output.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture output and subprocess paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the gate's own Node binary.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { parseShardfile } from '../src/game/shardfile/schema';

it('builds the template through the real workspace author CLI with deterministic product bytes', () => {
  const output = mkdtempSync(join(tmpdir(), 'sdk-repo-build-'));
  try {
    const args = ['scripts/wildshard.mjs', 'build', 'src/shards/_template', output, '--product-only'];
    execFileSync(execPath, args, { encoding: 'utf8' });
    const first = readFileSync(join(output, 'shard.json'), 'utf8');
    const shard = parseShardfile(JSON.parse(first)); expect(shard.identity.slug).toBe('template');
    execFileSync(execPath, args, { encoding: 'utf8' });
    expect(readFileSync(join(output, 'shard.json'), 'utf8')).toBe(first);
  } finally { rmSync(output, { recursive: true, force: true }); }
}, 30000);
