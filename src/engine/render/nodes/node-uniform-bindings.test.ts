import { expect, test } from 'vitest';
import { Matrix4 } from 'three';
import { modelWorldMatrix } from 'three/tsl';
import type { BlockGroup } from './nodePlainUniforms';
import { classicModelUniform } from './nodeObjectUniforms';

test('keeps extensions first, removes only the stock matrix and preserves custom and buffer layouts', () => {
  const stock: unknown = Reflect.get(modelWorldMatrix, 'uniformNode');
  const original = '#extension GL_ANGLE_multi_draw : require\nprecision highp float;\nlayout( std140 ) uniform object {\nmat4 nodeUniform0;\nmat4 nodeUniform1;\n};\nvoid main() { gl_Position = nodeUniform0 * nodeUniform1 * vec4(1.0); }';
  const parameters = {vertexShader: original, fragmentShader: original};
  const own = {node: stock, name: 'nodeUniform0', type: 'mat4', value: new Matrix4()};
  const custom = {node: {}, name: 'nodeUniform1', type: 'mat4', value: new Matrix4()};
  const group: BlockGroup = {name: 'object', uniforms: [[own, custom]]};
  const bones: BlockGroup = {name: 'boneBuffer', uniforms: [{value: new Float32Array(16)}]};
  const result = classicModelUniform(parameters, [group, bones]);
  expect(parameters.vertexShader.startsWith('#extension')).toBe(true);
  expect(parameters.vertexShader.indexOf('precision')).toBeLessThan(parameters.vertexShader.indexOf('uniform highp mat4 modelMatrix;'));
  expect(parameters.vertexShader).toContain('gl_Position = modelMatrix * nodeUniform1');
  expect(parameters.fragmentShader).toBe(parameters.vertexShader);
  expect(group.uniforms).toEqual([custom]); expect(result[1]).toBe(bones);
  const untouched = {vertexShader: original, fragmentShader: original};
  classicModelUniform(untouched, [{name: 'object', uniforms: [custom]}]);
  expect(untouched.vertexShader).toBe(original);
});
