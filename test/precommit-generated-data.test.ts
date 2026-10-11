// oxlint-disable-next-line import/no-nodejs-modules -- Hash the actual immutable fixture bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- All writes belong to the temporary fixture.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture outside the shared tree.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the isolated fixture paths.
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { materializeGuardData } from '../scripts/precommit-generated-data.mjs';
import { simClosure } from '../lint/sim-closure.mjs';

it('admits only staged-hash JSON bytes and leaves missing dependencies fail-closed', () => {
  const owned = mkdtempSync(join(tmpdir(), 'guard-data-'));
  const root = join(owned, 'root'), snapshot = join(owned, 'snapshot');
  const output = 'src/shards/example/data/rows.generated.json', bytes = '{"rows":[1,2,3]}\n';
  const write = (base: string, path: string, text: string): void => {
    const file = join(base, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text);
  };
  const pin = (path: string, hash: string): void => {
    write(snapshot, 'scripts/generation-jobs.json', JSON.stringify({ jobs: [{ buildOutputs: { [path]: hash } }] }));
  };
  const hash = createHash('sha256').update(bytes).digest('hex');
  try {
    write(snapshot, 'src/shards/example/data/rows.ts', "import rows from './rows.generated.json' with {type:'json'}; export const data=rows;");
    write(root, output, bytes);
    write(snapshot, 'scripts/generation-jobs.json', JSON.stringify({ jobs: [{ buildOutputs: {} }] }));
    materializeGuardData(root, snapshot);
    expect(existsSync(join(snapshot, output))).toBe(false);
    expect(simClosure(snapshot).map(site => site.id)).toEqual(['src/shards/example/data/rows.ts:unresolved:./rows.generated.json']);
    rmSync(join(root, output));
    pin(output, hash);
    materializeGuardData(root, snapshot);
    expect(simClosure(snapshot).map(site => site.id)).toEqual(['src/shards/example/data/rows.ts:unresolved:./rows.generated.json']);
    write(root, output, '{"unrelated":true}');
    expect(() => materializeGuardData(root, snapshot)).toThrow('does not match staged hash');
    expect(existsSync(join(snapshot, output))).toBe(false);
    write(root, output, bytes);
    materializeGuardData(root, snapshot);
    expect(readFileSync(join(snapshot, output), 'utf8')).toBe(bytes);
    expect(simClosure(snapshot)).toEqual([]);
    write(root, output, 'later working edit');
    materializeGuardData(root, snapshot);
    expect(readFileSync(join(snapshot, output), 'utf8')).toBe(bytes);
    pin('src/shards/example/data/../../escape.json', hash);
    expect(() => materializeGuardData(root, snapshot)).toThrow('Invalid generated guard data');
    pin('src/shards/example/data/evil.generated.ts', hash);
    write(root, 'src/shards/example/data/evil.generated.ts', bytes);
    materializeGuardData(root, snapshot);
    expect(existsSync(join(snapshot, 'src/shards/example/data/evil.generated.ts'))).toBe(false);
  } finally { rmSync(owned, { recursive: true, force: true }); }
});
