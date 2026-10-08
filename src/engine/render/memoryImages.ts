import { memoryAttribution, type MemoryLabel } from '../core/memoryAttribution';

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
