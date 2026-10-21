// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as gpuFiles from '../src/engine/boot/gpuFiles';
import { initializeTier, TIER } from '../src/engine/core/tier';
import type { Renderer } from '../src/engine/render/renderer';
import { initKtx2 } from '../src/engine/core/ktx2';

class Transcoder extends EventTarget {
  readonly messages: unknown[] = [];
  readonly terminate = vi.fn();
  postMessage(message: unknown): void { this.messages.push(message); }
  reply(value: unknown): void { this.dispatchEvent(new MessageEvent('message', { data: value })); }
}

test('phone KTX2 textures share one real transcode worker and drain queued jobs', async () => {
  const tier = TIER;
  let captured: KTX2Loader | undefined;
  const detect = vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockImplementation(function detectSupport(this: KTX2Loader) {
    this.workerConfig = { astcSupported: false, etc1Supported: false, etc2Supported: false, dxtSupported: false, bptcSupported: false, pvrtcSupported: false };
    return this;
  });
  const init = vi.spyOn(KTX2Loader.prototype, 'init').mockResolvedValue(undefined);
  const mode = vi.spyOn(gpuFiles, 'texMode').mockReturnValue('ktx2');
  try {
    initializeTier('phone');
    initKtx2({} as Renderer);
    captured = detect.mock.contexts[0];
    if (captured === undefined) throw new Error('KTX2 did not detect its renderer');
    const pool = captured.workerPool, workers: Transcoder[] = [];
    pool.setWorkerCreator(() => { const worker = new Transcoder(); workers.push(worker); return worker as Worker; });
    const first = pool.postMessage({ job: 1 }, []), second = pool.postMessage({ job: 2 }, []);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.messages).toEqual([{ job: 1 }]);
    workers[0]?.reply({ result: 1 });
    expect((await first).data).toEqual({ result: 1 });
    expect(workers).toHaveLength(1);
    expect(workers[0]?.messages).toEqual([{ job: 1 }, { job: 2 }]);
    workers[0]?.reply({ result: 2 });
    expect((await second).data).toEqual({ result: 2 });
  } finally { captured?.dispose(); detect.mockRestore(); init.mockRestore(); mode.mockRestore(); initializeTier(tier); }
});
