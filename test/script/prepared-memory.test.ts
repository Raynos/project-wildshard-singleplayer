import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compileScript } from '../../scripts/compile-script.mjs';
import { Scope } from '../../src/engine/app/scope';
import { bindConstructionEnvironment, withOwner } from '../../src/engine/app/ownership';
import { ScriptHost, withPreparedScriptMemories } from '../../src/engine/script/host';
import { admitScript } from '@wildshard/format/scriptAdmission';
import { ScriptWorld } from '../../src/engine/script/effects';
import { scriptSource } from './fixture';

const pause = (): Promise<void> => Promise.resolve();
let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(scriptSource('counter++; store<i32>(8192,load<i32>(8192)+1);', 'let counter:i32=0;')); });
function host(memoryBytes?: number): ScriptHost {
  return new ScriptHost({ world: new ScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 1 }, [
    { id: 1, name: 'actor', position: [0, 0, 0], fields: {}, frozen: false, interactive: true },
  ]), query: () => [], ...(memoryBytes === undefined ? {} : { limits: { memoryBytes } }) });
}
function installed(memoryBytes?: number): ScriptHost { const h = host(memoryBytes); h.install('policy', bytes); h.beginTick(0); return h; }

describe('fresh script memories prepared between frames', () => {
  it('allocates once per yield, preserves independent native state and matches the ordinary restored suffix', async () => {
    const ordinary = installed(), initial = ordinary.checkpoint();
    expect(ordinary.call('policy', 1, [0]).ok).toBe(true);
    const suffix = ordinary.checkpoint();
    const scope = new Scope('script-preparation'), allocations: number[] = [], memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      const hosts = await withPreparedScriptMemories([bytes, bytes], scope, () => { allocations.push(memory.mock.calls.length); return Promise.resolve(); }, () => [installed(), installed()]);
      expect(allocations).toEqual([0, 1, 2]); expect(memory).toHaveBeenCalledTimes(2);
      const [first, second] = hosts;
      if (first === undefined || second === undefined) throw new Error('Missing installed host');
      expect(first.checkpoint()).toEqual(initial); expect(second.checkpoint()).toEqual(initial);
      expect(first.call('policy', 1, [0]).ok).toBe(true); expect(first.checkpoint()).toEqual(suffix);
      expect(second.checkpoint()).toEqual(initial);
      first.restoreState(initial); expect(first.call('policy', 1, [0]).ok).toBe(true);
      expect(first.checkpoint()).toEqual(suffix); expect(memory).toHaveBeenCalledTimes(2);
    } finally { memory.mockRestore(); scope.dispose(); }
  });
  it('does not lend to an unrelated owner and permits the installer child scope', async () => {
    const scope = new Scope('prepared-owner'), foreign = new Scope('foreign-owner'), child = scope.child('installer');
    const memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      await withPreparedScriptMemories([bytes], scope, pause, () => {
        foreign.run(() => installed()); expect(memory).toHaveBeenCalledTimes(2);
        child.run(() => installed()); expect(memory).toHaveBeenCalledTimes(2);
      });
      scope.run(() => installed()); expect(memory).toHaveBeenCalledTimes(3);
    } finally { memory.mockRestore(); foreign.dispose(); scope.dispose(); }
  });
  it('keeps fresh memories available across an owned asynchronous installer without replaying initialization', async () => {
    const scope = new Scope('async-installer'), memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      const hosts = await withPreparedScriptMemories([bytes, bytes], scope, pause, async () => {
        const first = installed();
        await pause();
        const second = scope.run(() => installed());
        return [first, second];
      });
      expect(hosts[0]?.checkpoint()).toEqual(hosts[1]?.checkpoint());
      expect(memory).toHaveBeenCalledTimes(2);
    } finally { memory.mockRestore(); scope.dispose(); }
  });
  it('refuses an asynchronous installer result if its owner retired while it awaited', async () => {
    const scope = new Scope('retired-async-installer');
    await expect(withPreparedScriptMemories([bytes], scope, pause, async () => {
      const h = installed();
      await pause(); scope.dispose(); return h;
    })).rejects.toThrow('disposed');
  });
  it('uses the admitted construction owner after await without lending to explicit foreign or unowned callbacks', async () => {
    const scope = new Scope('construction-installer'), foreign = new Scope('foreign-callback');
    const leave = bindConstructionEnvironment(scope, () => () => undefined), memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      await withPreparedScriptMemories([bytes], scope, pause, async () => {
        await pause();
        foreign.run(() => installed());
        withOwner(null, () => installed());
        expect(memory).toHaveBeenCalledTimes(3);
        installed();
        expect(memory).toHaveBeenCalledTimes(3);
      });
    } finally { memory.mockRestore(); leave(); foreign.dispose(); scope.dispose(); }
  });
  it('rejects on retirement even when the caller frame wait can never complete', async () => {
    const scope = new Scope('cancelled-frame-wait');
    await expect(withPreparedScriptMemories([bytes], scope, () => {
      scope.dispose(); return new Promise<void>(() => { /* A cancelled rAF never completes. */ });
    }, () => installed())).rejects.toThrow('disposed');
  });
  it('rejects a pending installer on retirement without keeping its prepared pool available', async () => {
    const scope = new Scope('cancelled-pending-install');
    await expect(withPreparedScriptMemories([bytes], scope, pause, () => {
      scope.dispose(); return new Promise<void>(() => { /* The retired installer never completes. */ });
    })).rejects.toThrow('disposed');
  });
  it('keeps a lower host memory ceiling instead of consuming a broader prepared descriptor', async () => {
    const scope = new Scope('lower-ceiling'), admission = admitScript(bytes), memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      await withPreparedScriptMemories([bytes], scope, pause, () => {
        const h = installed(admission.initialPages * 3 * 65536);
        expect(h.call('policy', 1, [0]).ok).toBe(true);
      });
      expect(memory).toHaveBeenCalledTimes(2);
      expect(memory.mock.calls[1]?.[0]).toEqual({ initial: admission.initialPages, maximum: admission.initialPages });
    } finally { memory.mockRestore(); scope.dispose(); }
  });
  it('validates every module before allocating any memory or running the installer', async () => {
    const scope = new Scope('invalid-plan'), pauseMock = vi.fn(pause), install = vi.fn(), memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      await expect(withPreparedScriptMemories([bytes, new Uint8Array([0])], scope, pauseMock, install)).rejects.toThrow('Invalid');
      expect(memory).not.toHaveBeenCalled(); expect(pauseMock).not.toHaveBeenCalled(); expect(install).not.toHaveBeenCalled();
    } finally { memory.mockRestore(); scope.dispose(); }
  });
  it('drops unused references on cancellation and refuses a concurrent preparation for the owner', async () => {
    const scope = new Scope('cancelled-plan'), memory = vi.spyOn(WebAssembly, 'Memory'); let pauses = 0;
    try {
      await expect(withPreparedScriptMemories([bytes, bytes], scope, async () => {
        pauses++;
        await expect(withPreparedScriptMemories([bytes], scope, pause, () => installed())).rejects.toThrow('already active');
        if (pauses === 2) scope.dispose();
      }, () => installed())).rejects.toThrow('disposed');
      expect(memory).toHaveBeenCalledTimes(1);
    } finally { memory.mockRestore(); scope.dispose(); }
  });
  it('never reuses unused preparation after an installer fails', async () => {
    const scope = new Scope('failed-install'), memory = vi.spyOn(WebAssembly, 'Memory');
    try {
      await expect(withPreparedScriptMemories([bytes], scope, pause, () => { throw new Error('install failed'); })).rejects.toThrow('install failed');
      scope.run(() => installed()); expect(memory).toHaveBeenCalledTimes(2);
      await withPreparedScriptMemories([bytes], scope, pause, () => installed()); expect(memory).toHaveBeenCalledTimes(3);
    } finally { memory.mockRestore(); scope.dispose(); }
  });
});
