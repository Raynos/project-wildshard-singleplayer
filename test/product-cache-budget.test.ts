// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { isDev, setDev } from '../src/engine/core/devMode';
import { browserShardfileOptions } from '../src/game/shardfile/runtimeProduct';

const original = scopeEnvironment(), developer = isDev();
afterEach(() => { installScopeEnvironment(original); setDev(developer); vi.restoreAllMocks(); });
const microtasks = async (): Promise<void> => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test('browser admission overlaps cache requests and retains its frame boundary, public or Developer', async () => {
  for (const mode of [false, true]) {
    setDev(mode);
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
    vi.restoreAllMocks();
  }
});
