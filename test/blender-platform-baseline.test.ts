// oxlint-disable-next-line import/no-nodejs-modules -- Compare immutable policy fixture files outside the repository.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own temporary fixture root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Join the owned policy fixture paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';

it('admits the approved Blender first baseline only with zero runtime, then freezes it and rejects unknown shards', () => {
  const root = mkdtempSync(join(tmpdir(), 'sf55-baseline-'));
  const before = join(root, 'before.json'), after = join(root, 'after.json'), list = 'lint/shard-platform.json';
  const predecessor = { baseline: { _template: 550 }, enforced: { _template: 0 } };
  const candidate = { baseline: { _template: 550, 'blender-template': 90 }, enforced: { _template: 0, 'blender-template': 0 } };
  const write = () => writeFileSync(after, JSON.stringify(candidate));
  try {
    writeFileSync(before, JSON.stringify(predecessor)); write();
    expect(comparePlatformList(list, before, after)).toEqual([]);
    candidate.enforced['blender-template'] = 1; write();
    expect(comparePlatformList(list, before, after).join(',')).toContain('zero runtime ceiling');
    candidate.enforced['blender-template'] = 0; write();
    writeFileSync(before, JSON.stringify(candidate)); candidate.baseline['blender-template'] = 91; write();
    expect(comparePlatformList(list, before, after).join(',')).toContain('baseline must stay 90');
    writeFileSync(after, JSON.stringify({ ...candidate, baseline: { ...candidate.baseline, outside: 100 } }));
    expect(comparePlatformList(list, before, after).join(',')).toContain('unknown shard outside');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
