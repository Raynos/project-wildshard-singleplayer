// oxlint-disable-next-line import/no-nodejs-modules -- Run the exact opt-in browser diagnostic without a GL driver.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The initializer is emitted into the frame-floor helper HTML.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const code = readFileSync('scripts/frame-floor-programs.mjs', 'utf8').replace('export const PROGRAM_NAMES_SCRIPT', 'const PROGRAM_NAMES_SCRIPT');
const script: unknown = runInNewContext(`${code}\nPROGRAM_NAMES_SCRIPT`);
if (typeof script !== 'string') throw new Error('Program initializer missing');

it('names submitted shader variants without GL queries or changing driver arguments/results', () => {
  const calls: { method: string; args: readonly unknown[] }[] = [];
  class Context {
    shaderSource(shader: object | null, source: string): string { calls.push({ method: 'source', args: [shader, source] }); return 'source-result'; }
    attachShader(program: object | null, shader: object | null): string { calls.push({ method: 'attach', args: [program, shader] }); return 'attach-result'; }
  }
  const window: { WebGLRenderingContext: typeof Context; WebGL2RenderingContext: typeof Context; __frameFloorProgramName?: unknown } = { WebGLRenderingContext: Context, WebGL2RenderingContext: Context };
  runInNewContext(script, { window });
  runInNewContext(script, { window }); // A repeated helper does not wrap sources twice.
  const gl = new Context(), vertex = {}, fragment = {}, program = {}, variant = {}, second = {};
  const source = '#define SHADER_NAME Ground\nvoid main(){}';
  expect(gl.shaderSource(vertex, source)).toBe('source-result');
  gl.shaderSource(fragment, '#define SHADER_NAME Ground\n#define USE_FOG\nvoid main(){}');
  expect(gl.attachShader(program, vertex)).toBe('attach-result');
  gl.attachShader(program, fragment);
  gl.shaderSource(variant, '#define SHADER_NAME Ground\n#define USE_BATCHING\nvoid main(){}');
  gl.attachShader(second, variant);
  const reader = window.__frameFloorProgramName;
  if (typeof reader !== 'function') throw new Error('Program reader missing');
  const name: unknown = Reflect.apply(reader, window, [program]);
  expect(name).toMatch(/^Ground\/[0-9a-f]+\+Ground\/[0-9a-f]+$/u);
  expect(Reflect.apply(reader, window, [second])).not.toBe(name);
  expect(Reflect.apply(reader, window, [{}])).toBe('unobserved');
  expect(calls.map(call => call.method)).toEqual(['source', 'source', 'attach', 'attach', 'source', 'attach']);
  expect(calls[0]?.args).toEqual([vertex, source]);
  expect(gl.shaderSource(null, source)).toBe('source-result');
  expect(gl.attachShader(null, null)).toBe('attach-result');
  expect(calls.at(-1)?.args).toEqual([null, null]);
  const unnamed = {}, unnamedProgram = {};
  gl.shaderSource(unnamed, '#define SHADER_NAME \n#define HAS_NORMAL\nvoid main(){}');
  gl.attachShader(unnamedProgram, unnamed);
  expect(Reflect.apply(reader, window, [unnamedProgram])).toMatch(/^unnamed\/[0-9a-f]+$/u);
  gl.shaderSource(unnamed, '#define SHADER_TYPE MeshDepthMaterial\n#define SHADER_NAME \n#define HAS_NORMAL\nvoid main(){}');
  const depth = {};
  gl.attachShader(depth, unnamed);
  expect(Reflect.apply(reader, window, [depth])).toMatch(/^MeshDepthMaterial\/[0-9a-f]+$/u);
});


it('times synchronous GL queries and readbacks without adding a query or changing results', () => {
  const source = readFileSync('scripts/frame-floor.mjs', 'utf8');
  const start = source.indexOf('const GL_TIMED ='), end = source.indexOf('// op-hitch47:', start);
  if (start === -1 || end < start) throw new Error('GL timing initializer missing');
  const initializer: unknown = runInNewContext(`const glTime=true, PROGRAM_NAMES_SCRIPT='';${source.slice(start, end)}\nGL_TIME_SCRIPT`);
  if (typeof initializer !== 'string') throw new Error('GL timing initializer is not a string');
  const calls: (readonly unknown[])[] = [], failure = new Error('readback refused');
  let now = 0;
  class Context {
    getError(): number { calls.push([this, 'getError']); now += 7; return 0; }
    getParameter(key: number): number { calls.push([this, 'getParameter', key]); now += 8; return 42; }
    checkFramebufferStatus(key: number): number { calls.push([this, 'checkFramebufferStatus', key]); now += 9; return 36053; }
    finish(): void { calls.push([this, 'finish']); now += 10; }
    getBufferSubData(target: number, offset: number, out: Uint8Array): void {
      calls.push([this, 'getBufferSubData', target, offset, out]); now += 11;
      if (offset < 0) throw failure;
      out.set([1, 2]);
    }
  }
  const window: { WebGLRenderingContext: typeof Context; WebGL2RenderingContext: typeof Context; __frameFloorGlTake?: unknown } = { WebGLRenderingContext: Context, WebGL2RenderingContext: Context };
  const globals = { window, performance: { now: () => now } };
  runInNewContext(initializer, globals); runInNewContext(initializer, globals);
  const gl = new Context(), out = new Uint8Array(2);
  expect(gl.getError()).toBe(0); expect(gl.getParameter(1)).toBe(42);
  expect(gl.checkFramebufferStatus(2)).toBe(36053); gl.finish();
  gl.getBufferSubData(3, 0, out); expect([...out]).toEqual([1, 2]);
  expect(() => gl.getBufferSubData(3, -1, out)).toThrow(failure);
  expect(calls).toEqual([[gl, 'getError'], [gl, 'getParameter', 1], [gl, 'checkFramebufferStatus', 2], [gl, 'finish'],
    [gl, 'getBufferSubData', 3, 0, out], [gl, 'getBufferSubData', 3, -1, out]]);
  const take = window.__frameFloorGlTake;
  if (typeof take !== 'function') throw new Error('GL timing take missing');
  expect(Reflect.apply(take, window, [])).toEqual({ getError: [7, 1], getParameter: [8, 1], checkFramebufferStatus: [9, 1], finish: [10, 1], getBufferSubData: [22, 2] });
  expect(Reflect.apply(take, window, [])).toBeNull();
});
