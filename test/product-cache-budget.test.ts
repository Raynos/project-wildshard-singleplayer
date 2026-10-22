// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { isDev, setDev } from '../src/engine/core/devMode';
import { jsonSlot } from '../src/engine/saves/slots';
import { browserShardfileOptions } from '../src/game/shardfile/runtimeProduct';
import { SHADER_WARM_PICK } from '../src/game/grid/keptPrograms';

const original = scopeEnvironment(), developer = isDev(), saved = jsonSlot(SHADER_WARM_PICK, 'device');
const prior = saved.read();
afterEach(() => { installScopeEnvironment(original); setDev(developer); saved.write(prior); vi.restoreAllMocks(); });
const microtasks = async (): Promise<void> => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test.each(['off', 'keep', 'held', 'frozen', 'budget'] as const)('public admission retains its frame boundary with saved %s', async choice => {
  setDev(false); saved.write(choice);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const frames: FrameRequestCallback[] = [];
  installScopeEnvironment({ ...original, frame: render => { frames.push(render); return frames.length; } });
  const options = browserShardfileOptions('https://example.invalid/'), pause = options.pause;
  expect(options.cacheBatch).toBe(false);
  if (pause === undefined) throw new Error('Missing browser admission policy');
  let done = false; const waiting = (async () => { await pause(); done = true; })();
  await microtasks(); expect(done).toBe(false); expect(frames).toHaveLength(1);
  frames[0]?.(performance.now()); await waiting;
});

test('only the Developer budget choice enables cache overlap, preserving the schema frame boundary', async () => {
  setDev(true); saved.write('budget');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const frames: FrameRequestCallback[] = [];
  installScopeEnvironment({ ...original, frame: render => { frames.push(render); return frames.length; } });
  const options = browserShardfileOptions('https://example.invalid/'), pause = options.pause;
  expect(options.cacheBatch).toBe(true);
  if (pause === undefined) throw new Error('Missing browser admission policy');
  let done = false; const waiting = (async () => { await pause(); done = true; })();
  await microtasks(); expect(done).toBe(false); expect(frames).toHaveLength(1);
  frames[0]?.(performance.now());
  await waiting; expect(done).toBe(true);
});
