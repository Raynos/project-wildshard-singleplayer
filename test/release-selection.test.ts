import { expect, test } from 'vitest';
import { newestCiGreen, newestCiGreenAfterBoot, PendingBootSmokeError, releaseReady, releaseSlot } from '../scripts/deploy-pin.mjs';

const newer = 'a'.repeat(40), proven = 'b'.repeat(40), oldest = 'c'.repeat(40);
const completed = '2026-10-21T14:00:00Z', now = Date.parse('2026-10-21T14:01:00Z');
const success = `boot-smoke\tsuccess\tExact built dist passed\t${completed}`;
const pending = `boot-smoke\tpending\tExact proof running\t${completed}`;

function queryFor(candidates: readonly string[], proofs: Readonly<Record<string, string>>): (args: string[]) => string {
  return args => {
    const path = args[0] ?? '';
    if (path.includes('/actions/workflows/deploy.yml/runs?branch=main&event=push&status=success')) {
      return candidates.map(sha => `${sha}\t${completed}`).join('\n');
    }
    const sha = /\/commits\/([a-f0-9]{40})\/status$/u.exec(path)?.[1];
    if (sha === undefined || !Object.hasOwn(proofs, sha)) throw new Error(`Unexpected proof request: ${path}`);
    return proofs[sha] ?? '';
  };
}

test('a newer pending smoke cannot block a just-proven release', async () => {
  const query = queryFor([newer, proven, oldest], { [newer]: pending, [proven]: success, [oldest]: success });
  expect(newestCiGreen(query, () => undefined, now)).toBe(proven);
  expect(releaseReady(query, () => undefined, now)).toEqual({ ready: true, sha: proven });
  await expect(newestCiGreenAfterBoot(query, () => undefined, {
    now: () => now,
    wait: () => Promise.reject(new Error('A proven release must not wait')),
  })).resolves.toBe(proven);
});

test('a fresh CI success without a smoke status cannot block an older exact proof', () => {
  const query = queryFor([newer, proven], { [newer]: '', [proven]: success });
  expect(releaseReady(query, () => undefined, now)).toEqual({ ready: true, sha: proven });
});

test('continuous newer pending candidates never reset eligibility', () => {
  for (const candidates of [[newer, proven], [newer, oldest, proven], [oldest, newer, proven]]) {
    const query = queryFor(candidates, { [newer]: pending, [oldest]: pending, [proven]: success });
    expect(newestCiGreen(query, () => undefined, now)).toBe(proven);
  }
});

test('the newest fully proven candidate wins over older proven commits', () => {
  expect(newestCiGreen(queryFor([newer, proven], { [newer]: success, [proven]: success }), () => undefined, now)).toBe(newer);
});

test('a newer exact-SHA failure overrides its previous success', () => {
  const failed = `boot-smoke\tfailure\tLatest failed\t${completed}\n${success}`;
  expect(newestCiGreen(queryFor([newer, proven], { [newer]: failed, [proven]: success }), () => undefined, now)).toBe(proven);
});

test('pending smoke still defers when no exact proven candidate exists', () => {
  const query = queryFor([newer], { [newer]: pending });
  expect(() => newestCiGreen(query, () => undefined, now)).toThrow(PendingBootSmokeError);
  expect(releaseReady(query, () => undefined, now)).toEqual({ ready: false, sha: newer });
});

test('a release with no proof waits only within its existing bound', async () => {
  let clock = now;
  const query = queryFor([newer], { [newer]: pending });
  await expect(newestCiGreenAfterBoot(query, () => undefined, {
    now: () => clock, maxWaitMs: 30,
    wait: ms => { clock += ms; return Promise.resolve(); },
  })).rejects.toThrow('exact-SHA boot-smoke still unresolved');
});

test('terminal failures and unreadable proof queries never supply a release', () => {
  const query = queryFor([newer], { [newer]: `boot-smoke\tfailure\tFailed\t${completed}` });
  expect(() => releaseReady(query, () => undefined, now)).toThrow('no successful push CI');
  expect(() => releaseReady(() => { throw new Error('GitHub unavailable'); }, () => undefined, now)).toThrow('GitHub unavailable');
});

test('the hourly slot still refuses queued or recent releases', () => {
  expect(releaseSlot(now, () => `123\tqueued\t${completed}`)).toMatchObject({ free: false });
  expect(releaseSlot(now, () => `123\tcompleted\t${completed}`)).toMatchObject({ free: false });
  expect(releaseSlot(now, () => '')).toMatchObject({ free: true });
});
