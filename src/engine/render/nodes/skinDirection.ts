/** Client-only skeletal direction transform for custom graph channels.
 * Shares the draw object's live skeleton with ordinary position skinning; rigid
 * meshes retain the input. Directions never take bind-pose translation. */
import { SkinnedMesh } from 'three';
import { Node, ConvertNode, type NodeBuilder } from 'three/webgpu';
import { Fn, attribute, mat3, reference, referenceBuffer } from 'three/tsl';

export function skinDirection(value: Node<'vec3'>): Node<'vec3'> {
  return Fn((builder: NodeBuilder): Node<'vec3'> => {
    const object = builder.object;
    if (!(object instanceof SkinnedMesh)) return value;
    const bones = referenceBuffer('skeleton.boneMatrices', 'mat4', object.skeleton.bones.length, null);
    const bone = (at: Node): Node<'mat4'> => {
      const element: unknown = Reflect.get(bones, 'element');
      if (typeof element !== 'function') throw new Error('Skeleton buffer has no element accessor');
      const node: unknown = Reflect.apply(element, bones, [at]);
      if (!(node instanceof Node)) throw new Error('Skeleton element is not a node');
      return new ConvertNode<'mat4'>(node, 'mat4');
    };
    const index = attribute('skinIndex', 'uvec4'), weight = attribute('skinWeight', 'vec4');
    const matrix = bone(index.x).mul(weight.x).add(bone(index.y).mul(weight.y))
      .add(bone(index.z).mul(weight.z)).add(bone(index.w).mul(weight.w));
    return mat3(reference('bindMatrixInverse', 'mat4', null).mul(matrix).mul(reference('bindMatrix', 'mat4', null))).mul(value);
  })();
}
