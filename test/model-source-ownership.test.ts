// oxlint-disable-next-line import/no-nodejs-modules -- The source-ownership guard runs against an isolated repository fixture.
import { execFileSync, spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures contain only their own synthetic Blender source files.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Each fixture has a fresh temporary root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Test paths remain inside the fixture root.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the same Node source guard used by the build.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

it('keeps claimed shard Blender sources checked and refuses an unclaimed sibling', () => {
  const root = mkdtempSync(join(tmpdir(), 'model-source-ownership-'));
  try {
    mkdirSync(join(root, 'scripts/blender'), { recursive: true });
    mkdirSync(join(root, 'src/shards/source-fixture/blender'), { recursive: true });
    copyFileSync('scripts/check-model-sources.mjs', join(root, 'scripts/check-model-sources.mjs'));
    writeFileSync(join(root, 'scripts/blender/targets.json'), JSON.stringify({ targets: { fixture: { script: 'src/shards/source-fixture/blender/world.py', outputs: [] } } }));
    writeFileSync(join(root, 'src/shards/source-fixture/blender/world.py'), '# retained source\n');
    expect(execFileSync(execPath, ['scripts/check-model-sources.mjs'], { cwd: root, encoding: 'utf8' })).toContain('no orphans');
    writeFileSync(join(root, 'src/shards/source-fixture/blender/forgotten.py'), '# unclaimed source\n');
    const refused = spawnSync(execPath, ['scripts/check-model-sources.mjs'], { cwd: root, encoding: 'utf8' });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('src/shards/source-fixture/blender/forgotten.py: an orphan');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
