import { afterEach, beforeAll, beforeEach, expect, test, vi, type Mock } from 'vitest';
import type { bakeSkyTexture, bakeSkyTextures } from '../scripts/bake/skyTexturesPage';

const blob = new Blob([new Uint8Array([0, 128, 255])], { type: 'image/jpeg' });
class Canvas {
  width = 3;
  height = 2;
  readonly draw = vi.fn();
  readonly getContext = vi.fn(() => ({ drawImage: this.draw }));
  blob: Blob | null = blob;
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- This fake implements the native HTMLCanvasElement.toBlob callback contract.
  readonly toBlob = vi.fn((callback: BlobCallback, _type?: string, _quality?: number) => { callback(this.blob); });
  readonly toDataURL = vi.fn(() => { throw new Error('Encoded canvas handoff is forbidden'); });
}
const upload = vi.fn<typeof fetch>();
const createElement = vi.fn(() => new Canvas());
const originals = new Map<string, PropertyDescriptor | undefined>();
let bake: typeof bakeSkyTexture, bakeMany: typeof bakeSkyTextures;
let image: Canvas, encoded: Canvas;
let texture: { image: Canvas; dispose: Mock<() => void> };

beforeAll(async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  try {
    const page = await import('../scripts/bake/skyTexturesPage'); bake = page.bakeSkyTexture; bakeMany = page.bakeSkyTextures;
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'window'); else Object.defineProperty(globalThis, 'window', original);
  }
});
afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, descriptor);
  }
  originals.clear();
});
beforeEach(() => {
  for (const [name, value] of Object.entries({ HTMLCanvasElement: Canvas, document: { createElement }, fetch: upload })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  image = new Canvas(); encoded = new Canvas(); texture = { image, dispose: vi.fn<() => void>() };
  createElement.mockReturnValue(encoded);
  upload.mockResolvedValue(new Response(null, { status: 204 }));
});

test('sends the native JPEG blob once and returns only dimensions and format', async () => {
  await expect(bake('planet', texture, 'https://binary-bake.invalid/owned/')).resolves.toEqual({ lossless: false, width: 3, height: 2 });
  expect(encoded.draw).toHaveBeenCalledWith(image, 0, 0);
  expect(encoded.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
  expect(encoded.toDataURL).not.toHaveBeenCalled();
  expect(upload).toHaveBeenCalledExactlyOnceWith('https://binary-bake.invalid/owned/planet', { method: 'POST', body: blob });
  expect(texture.dispose).toHaveBeenCalledOnce();
});

test('refuses a failed encoder and releases its painted texture', async () => {
  encoded.blob = null;
  await expect(bake('planet', texture, 'https://binary-bake.invalid/owned/')).rejects.toThrow('encoding failed');
  expect(upload).not.toHaveBeenCalled(); expect(texture.dispose).toHaveBeenCalledOnce();
});

test('refuses rejected byte handoffs and releases its painted texture', async () => {
  upload.mockResolvedValueOnce(new Response(null, { status: 400 }));
  await expect(bake('planet', texture, 'https://binary-bake.invalid/owned/')).rejects.toThrow('handoff refused');
  expect(texture.dispose).toHaveBeenCalledOnce();
});

test('refuses unknown painters before producing or uploading bytes', async () => {
  await expect(bakeMany(['missing'], 'https://binary-bake.invalid/owned/')).rejects.toThrow('no painter');
  expect(createElement).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
});
