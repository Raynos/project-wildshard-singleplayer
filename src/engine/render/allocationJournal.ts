import { allocationImageBytes } from './allocationBytes';
import { memoryAttribution, memoryCreationLabel, type MemoryAttribution } from '../core/memoryAttribution';
import { pageScope } from '../app/resources';

interface Context { readonly canvas: EventTarget }
interface Level { width: number; height: number; depth: number; format: number; external: number; type: number }
interface TextureStorage { levels: Map<number, Level> }
const installed = new WeakMap<object, () => void>();
const object = (value: unknown): value is object => typeof value === 'object' && value !== null;
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
function dimensions(value: unknown): [number, number] {
  if (!object(value)) return [0, 0];
  return [number(Reflect.get(value, 'naturalWidth')) || number(Reflect.get(value, 'videoWidth')) || number(Reflect.get(value, 'width')),
    number(Reflect.get(value, 'naturalHeight')) || number(Reflect.get(value, 'videoHeight')) || number(Reflect.get(value, 'height'))];
}

/** Observe storage operations on this context only, without querying GL, reading pixels or retaining source arrays.
 * Uses the same native identities gpuLabels sends to the external census. Subuploads do not allocate storage. */
export function installAllocationJournal(context: Context, ledger: MemoryAttribution = memoryAttribution): () => void {
  const previous = installed.get(context); if (previous !== undefined) return previous;
  const scope = pageScope.child('memory.context');
  let unit = 0, renderbuffer: object | null = null, closed = false;
  let vertexArray: object | null = null, defaultElements: object | null = null;
  const elements = new WeakMap<object, object>();
  const textures = new WeakMap<object, TextureStorage>(), bindings = new Map<string, object>(), buffers = new Map<number, object>();
  const handles = new Set<WeakRef<object>>(), originals: (() => void)[] = [];
  const key = (target: number): string => `${unit}:${target >= 0x8515 && target <= 0x851a ? 0x8513 : target}`;
  const track = (resource: object, kind: string, bytes: number): void => { ledger.allocation(resource, 'gpu', kind, Math.ceil(bytes)); };
  const setLevel = (target: number, index: number, level: Level): void => {
    const resource = bindings.get(key(target)); if (resource === undefined) return;
    let storage = textures.get(resource);
    if (storage === undefined) { storage = { levels: new Map() }; textures.set(resource, storage); }
    storage.levels.set((target >= 0x8515 && target <= 0x851a ? target - 0x8515 : 0) * 64 + index, level);
    let bytes = 0;
    for (const row of storage.levels.values()) bytes += allocationImageBytes(row.format, row.width, row.height, row.depth, row.external, row.type);
    track(resource, 'texture', bytes);
  };
  const wrap = (name: string, after: (args: readonly unknown[], result: unknown) => void): void => {
    const original: unknown = Reflect.get(context, name); if (typeof original !== 'function') return;
    const descriptor = Object.getOwnPropertyDescriptor(context, name);
    const wrapped = (...args: unknown[]): unknown => {
      const result: unknown = Reflect.apply(original, context, args);
      if (!closed) after(args, result);
      return result;
    };
    Reflect.set(context, name, wrapped);
    originals.push(() => {
      if (Reflect.get(context, name) !== wrapped) return;
      if (descriptor === undefined) Reflect.deleteProperty(context, name); else Object.defineProperty(context, name, descriptor);
    });
  };
  const source = (value: unknown, resource?: object): void => { if (ArrayBuffer.isView(value)) { ledger.buffer(value); if (resource !== undefined) ledger.source(resource, value); } };
  for (const [method, kind] of [['createTexture', 'texture'], ['createBuffer', 'buffer'], ['createRenderbuffer', 'renderbuffer']] as const)
    wrap(method, (_args, result) => { if (object(result)) { handles.add(new WeakRef(result)); track(result, kind, 0); const label = memoryCreationLabel(); if (label !== null) ledger.label(result, label); } });
  wrap('activeTexture', args => { unit = number(args[0]) - 0x84c0; });
  wrap('bindTexture', args => { const target = key(number(args[0])); if (object(args[1])) bindings.set(target, args[1]); else bindings.delete(target); });
  const bindBuffer = (target: number, value: unknown): void => {
    if (object(value)) buffers.set(target, value); else buffers.delete(target);
    if (target !== 0x8893) return;
    if (vertexArray === null) defaultElements = object(value) ? value : null;
    else if (object(value)) elements.set(vertexArray, value); else elements.delete(vertexArray);
  };
  wrap('bindBuffer', args => { bindBuffer(number(args[0]), args[1]); });
  for (const method of ['bindBufferBase', 'bindBufferRange']) wrap(method, args => { bindBuffer(number(args[0]), args[2]); });
  wrap('bindVertexArray', args => {
    vertexArray = object(args[0]) ? args[0] : null;
    const buffer = vertexArray === null ? defaultElements : elements.get(vertexArray);
    if (buffer === undefined || buffer === null) buffers.delete(0x8893); else buffers.set(0x8893, buffer);
  });
  wrap('bindRenderbuffer', args => { renderbuffer = object(args[1]) ? args[1] : null; });
  wrap('bufferData', args => {
    const resource = buffers.get(number(args[0])); if (resource === undefined) return;
    const value = args[1], elementBytes = object(value) ? number(Reflect.get(value, 'BYTES_PER_ELEMENT')) || 1 : 1;
    const bytes = typeof value === 'number' ? value : ArrayBuffer.isView(value) || value instanceof ArrayBuffer ? value.byteLength : 0;
    const offset = number(args[3]) * elementBytes, length = number(args[4]) * elementBytes;
    track(resource, 'buffer', length > 0 ? length : Math.max(0, bytes - offset)); source(value, resource);
  });
  const image = (args: readonly unknown[], is3d: boolean, compressed: boolean): void => {
    const target = number(args[0]), index = number(args[1]), format = number(args[2]);
    const explicit = is3d || compressed || args.length >= 8;
    const [width, height] = explicit ? [number(args[3]), number(args[4])] : dimensions(args[5]);
    const depth = is3d ? number(args[5]) : 1;
    setLevel(target, index, { width, height, depth, format, external: compressed ? format : number(args[is3d ? 7 : explicit ? 6 : 3]), type: compressed ? 0x1401 : number(args[is3d ? 8 : explicit ? 7 : 4]) });
    source(args[compressed ? is3d ? 7 : 6 : is3d ? 9 : explicit ? 8 : 5], bindings.get(key(target)));
  };
  wrap('texImage2D', args => { image(args, false, false); });
  wrap('texImage3D', args => { image(args, true, false); });
  wrap('compressedTexImage2D', args => { image(args, false, true); });
  wrap('compressedTexImage3D', args => { image(args, true, true); });
  wrap('copyTexImage2D', args => { setLevel(number(args[0]), number(args[1]), { width: number(args[5]), height: number(args[6]), depth: 1, format: number(args[2]), external: number(args[2]), type: 0x1401 }); });
  const storage = (args: readonly unknown[], is3d: boolean): void => {
    const target = number(args[0]), levels = number(args[1]), format = number(args[2]);
    for (const face of target === 0x8513 ? [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851a] : [target])
      for (let level = 0; level < levels; level++) setLevel(face, level, { width: Math.max(1, number(args[3]) >> level), height: Math.max(1, number(args[4]) >> level),
        depth: is3d ? target === 0x806f ? Math.max(1, number(args[5]) >> level) : number(args[5]) : 1, format, external: format, type: 0x1401 });
  };
  wrap('texStorage2D', args => { storage(args, false); }); wrap('texStorage3D', args => { storage(args, true); });
  wrap('generateMipmap', args => {
    const target = number(args[0]), resource = bindings.get(key(target));
    const levels = resource === undefined ? undefined : textures.get(resource)?.levels;
    if (levels === undefined) return;
    for (const [index, row] of levels) {
      if (index % 64 !== 0) continue;
      let { width, height, depth } = row;
      const count = Math.floor(Math.log2(Math.max(width, height, target === 0x806f ? depth : 1)));
      for (let level = 1; level <= count; level++) {
        width = Math.max(1, width >> 1); height = Math.max(1, height >> 1); if (target === 0x806f) depth = Math.max(1, depth >> 1);
        setLevel(target === 0x8513 ? 0x8515 + Math.floor(index / 64) : target, level, { ...row, width, height, depth });
      }
    }
  });
  for (const [name, samples] of [['renderbufferStorage', false], ['renderbufferStorageMultisample', true]] as const)
    wrap(name, args => {
      if (renderbuffer === null) return;
      const shift = samples ? 1 : 0;
      track(renderbuffer, 'renderbuffer', allocationImageBytes(number(args[1 + shift]), number(args[2 + shift]), number(args[3 + shift])) * Math.max(1, samples ? number(args[1]) : 1));
    });
  for (const name of ['deleteTexture', 'deleteBuffer', 'deleteRenderbuffer']) wrap(name, args => {
    const resource = args[0]; if (!object(resource)) return;
    ledger.release(resource, 'gpu'); textures.delete(resource);
    for (const [binding, value] of bindings) if (value === resource) bindings.delete(binding);
    for (const [binding, value] of buffers) if (value === resource) buffers.delete(binding);
    if (renderbuffer === resource) renderbuffer = null;
  });
  const retire = (): void => { for (const weak of handles) { const resource = weak.deref(); if (resource !== undefined) ledger.release(resource, 'gpu'); } handles.clear(); bindings.clear(); buffers.clear(); renderbuffer = null; vertexArray = null; defaultElements = null; };
  scope.listen(context.canvas, 'webglcontextlost', retire);
  const dispose = (): void => { if (closed) return; closed = true; retire(); for (const restore of originals.reverse()) restore(); installed.delete(context); scope.dispose(); };
  scope.onDispose(dispose);
  installed.set(context, dispose); return dispose;
}
