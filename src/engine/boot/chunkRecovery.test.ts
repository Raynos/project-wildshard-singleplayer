import {expect, test, vi} from 'vitest';
import {createChunkRecovery, staleChunkFailure} from './chunkRecovery';

const base = 'https://game.test/';
const missingJs = new TypeError('Failed to fetch dynamically imported module: https://game.test/assets/pageEntry-1234abcd.js');
const missingCss = new Error('Stylesheet failed: https://game.test/assets/main-abcd1234.css');
function fixture() {
  let taken = false;
  const version = vi.fn(() => Promise.resolve('new-build'));
  const prepare = vi.fn((_build: string) => Promise.resolve(true));
  const claim = vi.fn(() => { if (taken) return false; taken = true; return true; });
  const reload = vi.fn<() => void>();
  const ports = {base, runningBuild: 'old-build', version, prepare, claimed: () => taken, claim, reload};
  return {ports, version, prepare, claim, reload};
}
test('only same-origin deployment code and sheets classify as stale chunk failures', () => {
  for (const error of [missingJs, missingCss, new TypeError('Importing a module script failed.')]) expect(staleChunkFailure(error, base)).toBe(true);
  for (const error of [new Error('application invariant'), new TypeError('Failed to fetch'), new Error('Stylesheet failed: https://other.test/assets/main-abcd1234.css'),
    new Error('Stylesheet failed: https://game.test/unversioned.css')]) expect(staleChunkFailure(error, base)).toBe(false);
});
test.each([missingJs, missingCss])('a missing chunk prepares the actual new worker and reloads once (%s)', async failure => {
  const f = fixture(), recover = createChunkRecovery(f.ports);
  expect(await Promise.all([recover(failure), recover(failure)])).toEqual([true, true]);
  expect(f.version).toHaveBeenCalledOnce(); expect(f.prepare).toHaveBeenCalledExactlyOnceWith('new-build');
  expect(f.claim).toHaveBeenCalledOnce(); expect(f.reload).toHaveBeenCalledOnce();
  expect(await createChunkRecovery(f.ports)(failure)).toBe(false);
  expect(f.reload).toHaveBeenCalledOnce();
});
test('same-build, offline and failed adoption retain the original failure without a reload claim', async () => {
  const f = fixture(); f.version.mockResolvedValue('old-build');
  expect(await createChunkRecovery(f.ports)(missingJs)).toBe(false); expect(f.prepare).not.toHaveBeenCalled();
  const offline = createChunkRecovery({...f.ports, version: () => Promise.resolve(null)});
  expect(await offline(missingCss)).toBe(false);
  f.version.mockResolvedValue('new-build'); f.prepare.mockResolvedValue(false);
  expect(await createChunkRecovery(f.ports)(missingCss)).toBe(false);
  expect(f.claim).not.toHaveBeenCalled(); expect(f.reload).not.toHaveBeenCalled();
});
test('adoption must finish before the new document starts and unrelated errors never probe', async () => {
  const f = fixture(); let ready: ((result: boolean) => void) | undefined;
  f.prepare.mockImplementation(() => new Promise(resolve => {ready = resolve;}));
  const recover = createChunkRecovery(f.ports), pending = recover(missingJs);
  await Promise.resolve(); expect(f.reload).not.toHaveBeenCalled();
  if (ready === undefined) throw new Error('Adoption was not requested'); ready(true);
  expect(await pending).toBe(true);
  const ordinary = fixture(); expect(await createChunkRecovery(ordinary.ports)(new Error('real source refusal'))).toBe(false);
  expect(ordinary.version).not.toHaveBeenCalled();
});
