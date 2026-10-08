import { memoryAttribution, type MemoryLabel } from './memoryAttribution';

/** Record CPU backing storage, never the GPU texture estimate; arrays share their actual ArrayBuffer identity.
 * Browser image/canvas backing is an explicit RGBA estimate, not physical resident RAM. Dynamic resize/close is live. */
export function observeImageMemory(value: unknown, label: MemoryLabel): void {
  if (ArrayBuffer.isView(value)) { memoryAttribution.buffer(value, label); return; }
  if (typeof value !== 'object' || value === null) return;
  const data: unknown = Reflect.get(value, 'data');
  if (ArrayBuffer.isView(data)) memoryAttribution.buffer(data, label);
  const kind = typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement ? 'canvas'
    : typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas ? 'canvas'
      : typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap ? 'image-bitmap'
        : typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement ? 'image' : null;
  if (kind === null) return;
  memoryAttribution.label(value, label);
  memoryAttribution.observe(value, 'ram', kind, image => {
    const width: unknown = Reflect.get(image, 'naturalWidth') ?? Reflect.get(image, 'width');
    const height: unknown = Reflect.get(image, 'naturalHeight') ?? Reflect.get(image, 'height');
    return typeof width === 'number' && typeof height === 'number' ? width * height * 4 : 0;
  }, 'estimate');
}
/** Audio's decoded PCM capacity: float32 samples × frames × channels, once per shared AudioBuffer. */
export function observeAudioMemory<T extends Pick<AudioBuffer, 'length' | 'numberOfChannels'>>(buffer: T, label: MemoryLabel): T {
  memoryAttribution.label(buffer, label);
  memoryAttribution.observe(buffer, 'ram', 'audio-buffer', value => {
    const length: unknown = Reflect.get(value, 'length'), channels: unknown = Reflect.get(value, 'numberOfChannels');
    if (typeof length !== 'number' || typeof channels !== 'number') throw new TypeError('Invalid decoded audio identity');
    return length * channels * 4;
  });
  return buffer;
}
/** Linear-memory capacity follows growth; the diagnostic never calls a Wasm export or copies its bytes. */
export function observeWasmMemory(memory: WebAssembly.Memory, label: MemoryLabel): void {
  memoryAttribution.label(memory, label);
  memoryAttribution.observe(memory, 'ram', 'wasm', value => {
    if (!(value instanceof WebAssembly.Memory)) throw new TypeError('Invalid linear memory identity');
    return value.buffer.byteLength;
  });
}
