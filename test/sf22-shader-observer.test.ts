import { expect, it, vi } from 'vitest';
import { observeShaderCompilations } from '../scripts/sf22-shader-observer.mjs';

it('preserves native receivers and calls, captures source changes, and queries no driver metadata', () => {
  const shader: WebGLShader = {}, other: WebGLShader = {};
  let at = 0;
  const source = vi.fn<(shader: WebGLShader, text: string) => void>(), compile = vi.fn<(shader: WebGLShader) => void>(), query = vi.fn(() => { throw new Error('Native query'); });
  const gl = { shaderSource: source, compileShader: compile, getShaderSource: query };
  const observer = observeShaderCompilations(gl, () => ++at);
  try {
    gl.shaderSource(shader, '#define SHADER_NAME road\n#define USE_FOG\nuniform PointLight pointLights[2];');
    gl.compileShader(shader);
    expect(observer.duringWarmUp(() => observer.duringWarmUp(() => { gl.compileShader(shader); return 7; }))).toBe(7);
    gl.shaderSource(shader, '#define SHADER_NAME changed'); gl.compileShader(shader); gl.compileShader(other);
    expect(source.mock.contexts).toEqual([gl, gl]); expect(compile.mock.contexts).toEqual([gl, gl, gl, gl]);
    expect(compile.mock.calls).toEqual([[shader], [shader], [shader], [other]]);
    expect(observer.snapshot()).toEqual([
      { start: 1, end: 2, phase: 'draw-or-driver', sourceKnown: true, name: 'road', lightCounts: [['pointLights', 2]], flags: ['USE_FOG'] },
      { start: 3, end: 4, phase: 'explicit-warm-up', sourceKnown: true, name: 'road', lightCounts: [['pointLights', 2]], flags: ['USE_FOG'] },
      { start: 5, end: 6, phase: 'draw-or-driver', sourceKnown: true, name: 'changed', lightCounts: [], flags: [] },
      { start: 7, end: 8, phase: 'draw-or-driver', sourceKnown: false, name: null, lightCounts: [], flags: [] },
    ]);
    expect(query).not.toHaveBeenCalled();
  } finally { observer.dispose(); }
  expect(gl.shaderSource).toBe(source); expect(gl.compileShader).toBe(compile);
});

it('preserves thrown native errors and resets nesting, including when warm-up fails', () => {
  const shader: WebGLShader = {}, failure = new Error('Native compilation failure');
  let at = 0;
  const gl = { shaderSource: vi.fn<(shader: WebGLShader, text: string) => void>(), compileShader: vi.fn<(shader: WebGLShader) => void>(() => { throw failure; }) };
  const observer = observeShaderCompilations(gl, () => ++at);
  try {
    expect(() => observer.duringWarmUp(() => gl.compileShader(shader))).toThrow(failure);
    expect(() => gl.compileShader(shader)).toThrow(failure);
    expect(observer.snapshot().map(row => row.phase)).toEqual(['explicit-warm-up', 'draw-or-driver']);
    const replacement = vi.fn<(shader: WebGLShader) => void>(); gl.compileShader = replacement; observer.dispose();
    expect(gl.compileShader).toBe(replacement);
  } finally { observer.dispose(); }
});
