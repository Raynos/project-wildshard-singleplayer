import type { WebGLProgramParametersWithUniforms } from 'three';
import { modelWorldMatrix } from 'three/tsl';
import type { BlockGroup } from './nodeUniformBuffers';

const members = (entry: BlockGroup['uniforms'][number]): readonly { readonly value: unknown }[] => 'value' in entry ? [entry] : entry;

/** Only the stock model-world input has the classic renderer's modelMatrix
 * semantics. Custom matrices, normal/world-inverse and high-precision view
 * inputs keep their original node and block ownership. */
export function classicModelUniform(parameters: Pick<WebGLProgramParametersWithUniforms, 'vertexShader' | 'fragmentShader'>, groups: readonly BlockGroup[]): BlockGroup[] {
  const stock: unknown = Reflect.get(modelWorldMatrix, 'uniformNode');
  if (typeof stock !== 'object' || stock === null) throw new Error('Missing stock model matrix input');
  const names = new Set<string>();
  for (const group of groups) for (const entry of group.uniforms) {
    const list = members(entry);
    for (const uniform of list) {
      if (Reflect.get(uniform, 'node') !== stock || Reflect.get(uniform, 'type') !== 'mat4') continue;
      const name: unknown = Reflect.get(uniform, 'name');
      if (typeof name !== 'string' || !/^nodeUniform\d+$/u.test(name)) throw new Error('Invalid stock model matrix uniform');
      names.add(name);
    }
  }
  if (names.size === 0) return [...groups];
  const rewrite = (source: string): string => {
    const declared: string[] = [];
    let result = source.replaceAll(/layout\s*\(\s*std140\s*\)\s*uniform\s+\w+\s*\{([^{}]*)\};/gu, (block: string, fields: string) => {
      const before = declared.length;
      const kept = fields.replaceAll(/(?:^|\n)[\t ]*(?:(?:lowp|mediump|highp)\s+)?mat4\s+(nodeUniform\d+)\s*;/gu, (field: string, name: string) => {
        if (!names.has(name)) return field;
        declared.push(name); return '';
      });
      if (kept === fields) return block;
      return (before === 0 ? 'uniform highp mat4 modelMatrix;\n' : '') + (kept.trim() === '' ? '' : block.replace(fields, kept));
    });
    if (declared.length === 0) return source;
    result = result.replaceAll(/\bnodeUniform\d+\b/gu, name => names.has(name) ? 'modelMatrix' : name);
    return result;
  };
  parameters.vertexShader = rewrite(parameters.vertexShader);
  parameters.fragmentShader = rewrite(parameters.fragmentShader);
  return groups.flatMap(group => {
    if (!group.uniforms.some(entry => members(entry).some(uniform => names.has(String(Reflect.get(uniform, 'name')))))) return [group];
    const uniforms = group.uniforms.flatMap(entry => members(entry).filter(uniform => !names.has(String(Reflect.get(uniform, 'name')))));
    // The group is this build's fresh UniformsGroup, not the shared node input.
    Reflect.set(group, 'uniforms', uniforms); return uniforms.length === 0 ? [] : [group];
  });
}
