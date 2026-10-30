import { afterEach, expect, test, vi } from 'vitest';
import { CompressedTexture, RGBA_S3TC_DXT5_Format, WebGLRenderer } from 'three';
import { uploadCompressedTexture } from './compressedUpload';
import { pageScope } from '../app/resources';

/** a renderer whose GL error queue the test scripts: `queued` errors are pending before the upload, `upload` is what the
 *  upload itself raises */
function renderer(queued: number[], upload: number) {
  const target: unknown = Object.create(WebGLRenderer.prototype);
  if (!(target instanceof WebGLRenderer)) throw new Error('Missing native renderer fixture');
  const records = new WeakMap<object, Record<string, unknown>>(), errors = [...queued];
  const get = (value: object): Record<string, unknown> => { let row = records.get(value); if (row === undefined) { row = {}; records.set(value, row); } return row; };
  const fields: Record<string, unknown> = {
    properties: { get },
    initTexture: () => { if (upload !== 0) errors.push(upload); },
    getContext: () => ({ isContextLost: () => false, NO_ERROR: 0, getError: () => errors.shift() ?? 0 }),
    renderBufferDirect: () => undefined,
  };
  for (const [name, value] of Object.entries(fields)) Reflect.set(target, name, value);
  return target;
}
const texture = (): CompressedTexture => new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, RGBA_S3TC_DXT5_Format);

afterEach(() => { vi.restoreAllMocks(); });
const frames = (): void => {
  vi.spyOn(pageScope, 'raf').mockImplementation(run => { queueMicrotask(() => { run(0); }); return 0; });
  vi.spyOn(pageScope, 'timeout').mockImplementation((_ms, run) => { queueMicrotask(run); return 0; });
};

test('a GL error queued before a loading upload fails it and names that stage', async () => {
  frames();
  const upload = texture();
  await expect(uploadCompressedTexture(renderer([1282], 0), upload)).rejects.toThrow(`Graphics error 1282 before compressed texture ${String(RGBA_S3TC_DXT5_Format)} (#${String(upload.id)}, 4x4, 1 mips)`);
  upload.dispose();
});

test('an error the upload raises still fails it as before, with the texture named', async () => {
  frames();
  const upload = texture();
  await expect(uploadCompressedTexture(renderer([], 1280), upload)).rejects.toThrow(`Graphics error 1280 after compressed texture ${String(RGBA_S3TC_DXT5_Format)} (#${String(upload.id)}, 4x4, 1 mips)`);
  upload.dispose();
});

test('a clean queue uploads', async () => {
  frames();
  const upload = texture();
  await expect(uploadCompressedTexture(renderer([], 0), upload, () => true, false)).resolves.toBeUndefined();
  upload.dispose();
});

test('back-to-back uploads share the paint between them; each still lands in its own frame, a later one waits its own', async () => {
  const order: string[] = [];
  // frames and timers as tasks, as in the page: the frame wait is a rAF, then a task after its paint
  vi.spyOn(pageScope, 'raf').mockImplementation(run => { order.push('raf'); setTimeout(() => { order.push('paint'); run(0); }, 0); return 0; });
  vi.spyOn(pageScope, 'timeout').mockImplementation((_ms, run) => { setTimeout(run, 0); return 0; });
  const target = renderer([], 0), init = target.initTexture.bind(target), textures = [texture(), texture(), texture(), texture()];
  Reflect.set(target, 'initTexture', (value: CompressedTexture) => { order.push('upload'); init(value); });
  await Promise.all(textures.map(value => uploadCompressedTexture(target, value, () => true, false)));
  expect(order.filter(step => step === 'raf')).toHaveLength(5); // was 8: one before the first, one after each
  expect(order.join(' ')).toBe('raf paint upload raf paint upload raf paint upload raf paint upload raf paint');
  await new Promise(resolve => { setTimeout(resolve, 5); }); // a later task: the next upload waits for its own paint first
  const late = texture(); order.length = 0;
  await uploadCompressedTexture(target, late, () => true, false);
  expect(order.join(' ')).toBe('raf paint upload raf paint');
  for (const value of [...textures, late]) value.dispose();
});
