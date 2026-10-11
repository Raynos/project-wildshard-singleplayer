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
});
