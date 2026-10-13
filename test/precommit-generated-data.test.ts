// oxlint-disable-next-line import/no-nodejs-modules -- Hash the actual immutable fixture bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the detached guard's actual CLI in an isolated fixture.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node binary as the test process.
import { execPath } from 'node:process';
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
    expect(() => materializeGuardData(root, snapshot)).toThrow('Missing pinned generated guard data');
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
    pin('src/shards/example/behaviour/stages.generated.json', hash);
    write(root, 'src/shards/example/behaviour/stages.generated.json', bytes);
    materializeGuardData(root, snapshot);
    expect(readFileSync(join(snapshot, 'src/shards/example/behaviour/stages.generated.json'), 'utf8')).toBe(bytes);
    pin('src/shards/example/data/../../escape.json', hash);
    expect(() => materializeGuardData(root, snapshot)).toThrow('Invalid generated guard data');
    pin('src/shards/example/data/evil.generated.ts', hash);
    write(root, 'src/shards/example/data/evil.generated.ts', bytes);
    materializeGuardData(root, snapshot);
    expect(existsSync(join(snapshot, 'src/shards/example/data/evil.generated.ts'))).toBe(false);
  } finally { rmSync(owned, { recursive: true, force: true }); }
});

it('materializes pinned JSON through the detached ratchet CLI without admitting wrong bytes', () => {
  const owned = mkdtempSync(join(tmpdir(), 'ratchet-data-'));
  const root = join(owned, 'root'), snapshot = join(owned, 'snapshot');
  const path = 'src/shards/example/data/rows.generated.json', bytes = '{"lifts":[]}\n';
  const write = (base: string, relativePath: string, content: string): void => {
    const file = join(base, relativePath); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content);
  };
  const command = (): void => {
    execFileSync(execPath, ['scripts/precommit-generated-data.mjs', root, snapshot], { stdio: 'pipe' });
  };
  try {
    write(snapshot, 'src/shards/example/data/lifts.ts', "import rows from './rows.generated.json' with {type:'json'}; export const lifts=rows.lifts;");
    write(snapshot, 'scripts/generation-jobs.json', JSON.stringify({ jobs: [{ buildOutputs: {
      [path]: createHash('sha256').update(bytes).digest('hex'),
    } }] }));
    expect(command).toThrow('Missing pinned generated guard data');
    expect(simClosure(snapshot)).toHaveLength(1);
    write(root, path, 'wrong bytes');
    expect(command).toThrow('does not match staged hash');
    expect(existsSync(join(snapshot, path))).toBe(false);
    write(root, path, bytes);
    command();
    expect(simClosure(snapshot)).toEqual([]);
    expect(readFileSync(join(snapshot, path), 'utf8')).toBe(bytes);
  } finally { rmSync(owned, { recursive: true, force: true }); }
});


it('uses verified commit blobs without requiring matching working output and refuses corrupt blobs', () => {
  const owned = mkdtempSync(join(tmpdir(), 'guard-produced-data-'));
  const root = join(owned, 'root'), snapshot = join(owned, 'snapshot'), blobs = join(owned, 'blobs');
  const output = 'src/shards/example/data/rows.generated.json', bytes = '{"rows":[1,2,3]}\n';
  const hash = createHash('sha256').update(bytes).digest('hex');
  try {
    mkdirSync(join(snapshot, 'scripts'), { recursive: true }); mkdirSync(blobs);
    writeFileSync(join(snapshot, 'scripts/generation-jobs.json'), JSON.stringify({ jobs: [{ buildOutputs: { [output]: hash } }] }));
    writeFileSync(join(blobs, hash), 'corrupt');
    expect(() => materializeGuardData(root, snapshot, blobs)).toThrow('does not match staged hash');
    expect(existsSync(join(snapshot, output))).toBe(false);
    writeFileSync(join(blobs, hash), bytes);
    materializeGuardData(root, snapshot, blobs);
    expect(readFileSync(join(snapshot, output), 'utf8')).toBe(bytes);
    expect(existsSync(join(root, output))).toBe(false);
  } finally { rmSync(owned, { recursive: true, force: true }); }
});
