// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { memoryAttribution } from '../../src/engine/core/memoryAttribution';
import { observeAudioMemory, observeWasmMemory } from '../../src/engine/core/memoryResources';
import { observeImageMemory } from '../../src/engine/render/memoryImages';

it('reads resized canvases, shared PCM and grown linear memory without copying their data', () => {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const label = { owner: 'level.environment', asset: 'generated/grass' };
  observeImageMemory(canvas, label); observeImageMemory(canvas, label);
  const audio = { length: 48000, numberOfChannels: 2 };
  observeAudioMemory(audio, { owner: 'level.audio', asset: 'audio/hash' });
  observeAudioMemory(audio, { owner: 'level.audio', asset: 'audio/hash' });
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 4 });
  observeWasmMemory(memory, { owner: 'level.script', asset: 'script/hash' });
  const rows = () => memoryAttribution.snapshot().allocations;
  expect(rows().filter(row => row.asset === 'audio/hash')).toHaveLength(1);
  expect(rows().find(row => row.asset === 'audio/hash')?.bytes).toBe(384000);
  expect(rows().find(row => row.asset === label.asset)).toMatchObject({ kind: 'canvas', precision: 'estimate', bytes: 2097152 });
  canvas.width = 1; canvas.height = 1; memory.grow(1);
  expect(rows().find(row => row.asset === label.asset)?.bytes).toBe(4);
  expect(rows().find(row => row.asset === 'script/hash')?.bytes).toBe(131072);
  for (const resource of [canvas, audio, memory]) memoryAttribution.release(resource, 'ram');
});
