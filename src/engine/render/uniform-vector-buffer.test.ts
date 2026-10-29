import { expect, test } from 'vitest';
import { Color, Vector3 } from 'three';
import { WebGLUniforms } from 'three/src/renderers/webgl/WebGLUniforms.js';
import type { WebGLProgram } from 'three/src/renderers/webgl/WebGLProgram.js';
import { installUniformCacheKinds } from './uniformCaches';
import { installUniformCacheKinds as installBefore } from '../test/uniform-caches-before';

/** Actual Three uniform construction/setters over a recorder of native float32
 * uploads. Each call records a copy, so reuse cannot overwrite its predecessor. */
function fixture(buffered: boolean, array = false, install = installUniformCacheKinds) {
  const uploads: number[][] = [], buffers: Float32Array[] = [];
  const location: unknown = {}, program: unknown = {};
  const native: unknown = {
    ACTIVE_UNIFORMS: 0x8b86,
    getProgramParameter: () => 1,
    getActiveUniform: () => ({ name: array ? 'value[0]' : 'value', type: 0x8b51, size: array ? 2 : 1 }),
    getUniformLocation: () => location,
    uniform3f: (addr: unknown, x: number, y: number, z: number) => {
      expect(addr).toBe(location); uploads.push([Math.fround(x), Math.fround(y), Math.fround(z)]);
    },
    uniform3fv: (addr: unknown, value: Float32Array | number[]) => {
      expect(addr).toBe(location); uploads.push(Array.from(value, Math.fround));
      if (value instanceof Float32Array) buffers.push(value);
    },
  };
  const gl = native as WebGLRenderingContext;
  const uniforms = new WebGLUniforms(gl, program as WebGLProgram);
  if (buffered) {
    const target = { getUniforms: () => uniforms };
    install({ info: { programs: [target] } }); target.getUniforms();
  }
  const setter: unknown = Reflect.get(uniforms, 'setValue');
  if (typeof setter !== 'function') throw new Error('Missing native Three setter');
  const capture = (): ((value: unknown) => void) => {
    const seq: unknown = Reflect.get(uniforms, 'seq');
    if (!Array.isArray(seq)) throw new Error('Missing actual native uniform list');
    const rows: readonly unknown[] = seq, leaf = rows[0];
    if (typeof leaf !== 'object' || leaf === null) throw new Error('Missing actual native uniform binding');
    const saved: unknown = Reflect.get(leaf, 'setValue');
    if (typeof saved !== 'function') throw new Error('Missing actual native leaf setter');
    return value => { Reflect.apply(saved, leaf, [gl, value]); };
  };
  return { uploads, buffers, capture, set: (value: unknown) => { Reflect.apply(setter, uniforms, [gl, 'value', value]); } };
}

test('buffered native vector/color uploads retain every original float32 value and cache skip', () => {
  const before = fixture(false), after = fixture(true);
  const values = [new Vector3(0.1, -0.2, 0.3), new Vector3(0.1, -0.2, 0.3),
    new Color().setRGB(0.125, 0.5, 0.875), new Color().setRGB(0.125, 0.5, 0.875),
    new Vector3(-0, 0, Number.MIN_VALUE), new Vector3(1 + Number.EPSILON, 1e30, -1e30),
    new Vector3(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    new Vector3(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)];
  for (const value of values) { before.set(value); after.set(value); }
  expect(after.uploads).toEqual(before.uploads);
  expect(after.uploads).toHaveLength(6);
  expect(after.buffers).toHaveLength(6);
  expect(new Set(after.buffers).size).toBe(1);
});

test('array/vector transitions keep the actual native length and unrounded double cache', () => {
  const before = fixture(false), after = fixture(true);
  const values = [new Vector3(0.1, 0.2, 0.3), [0.1, 0.2, 0.3], new Float32Array([0.1, 0.2, 0.3]),
    new Vector3(0.1, 0.2, 0.3), [0.1, 0.2], [0.1, 0.2, 0.3, 0.4], new Vector3(0.1, 0.2, 0.3),
    [0.1, 0.2, 0.3], [0.1, 0.2, 0.3], new Vector3(0.1 + Number.EPSILON, 0.2, 0.3)];
  for (const value of values) { before.set(value); after.set(value); }
  expect(after.uploads).toEqual(before.uploads);
  // The native array setter retains its input and validation path.
  expect(after.buffers.some(buffer => buffer === values[2])).toBe(true);
});

test('pure vector arrays keep native flattening and their complete upload', () => {
  const before = fixture(false, true), after = fixture(true, true);
  for (const value of [[new Vector3(0.1, 0.2, 0.3), new Vector3(0.4, 0.5, 0.6)],
    new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])]) {
    before.set(value); after.set(value);
  }
  expect(after.uploads).toEqual(before.uploads);
  expect(after.uploads[0]).toHaveLength(6);
});

test('incomplete vector values keep native cache and upload behavior across numeric values', () => {
  const before = fixture(false), after = fixture(true);
  for (const value of [new Vector3(0.1, 0.2, 0.3), { x: 1 }, { x: 1 }, { r: 0.2, g: 0.3 },
    new Vector3(0.1, 0.2, 0.3), new Vector3(0.1, 0.2, 0.3)]) {
    before.set(value); after.set(value);
  }
  expect(after.uploads).toEqual(before.uploads);
});


test('binding-local dispatch retains original getter order and captured setters across value kinds', () => {
  const before = fixture(true, false, installBefore), after = fixture(true);
  const oldSaved = before.capture(), newSaved = after.capture(), oldLog: string[] = [], newLog: string[] = [];
  function value(kind: 'rgb' | 'xyz', log: string[], base: number): object {
    const source = {};
    for (const [index, key] of (kind === 'rgb' ? ['r', 'g', 'b'] : ['x', 'y', 'z']).entries()) {
      Object.defineProperty(source, key, { get: () => { log.push(key); return base + index * .1; } });
    }
    Object.defineProperty(source, kind === 'rgb' ? 'x' : 'r', { get: () => { log.push('absent'); return undefined; } });
    return source;
  }
  for (let tick = 0; tick < 64; tick++) {
    const kind = tick % 3 === 0 ? 'rgb' : 'xyz', a = value(kind, oldLog, tick / 256), b = value(kind, newLog, tick / 256);
    before.set(a); after.set(b);
    oldSaved(a); newSaved(b);
    before.set(new Float32Array([.1, .2, .3])); after.set(new Float32Array([.1, .2, .3]));
    expect(newLog).toEqual(oldLog); expect(after.uploads).toEqual(before.uploads);
  }
});

test('changing component getters retain native undefined and null typed-store coercion', () => {
  const before = fixture(true, false, installBefore), after = fixture(true);
  function value(second: unknown): object {
    let reads = 0;
    return { get x(): unknown { return reads++ % 2 === 0 ? 0.25 : second; }, y: 0.5, z: 0.75 };
  }
  for (const second of [undefined, null, -0, Number.NaN, Number.POSITIVE_INFINITY]) {
    before.set(value(second)); after.set(value(second));
    before.set(value(second)); after.set(value(second));
    expect(after.uploads).toEqual(before.uploads);
  }
});
