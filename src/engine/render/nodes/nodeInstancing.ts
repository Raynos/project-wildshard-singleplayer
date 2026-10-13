/** Node graphs use the classic renderer's per-object instance attributes.
 * Their names and layout are independent of instance count and material. */
import { InstancedMesh, type Object3D } from 'three';
import { Node, type NodeMaterial } from 'three/webgpu';
import { Fn, nodeObject, normalLocal, positionLocal, subBuild, transformNormal, varyingProperty } from 'three/tsl';

/** Reserved attributes are supplied by WebGLBindingStates from the draw object,
 * so they are deliberately independent of builder.geometry. */
class InstanceMatrixNode extends Node<'mat4'> {
  constructor() { super('mat4'); }
  override generate(): string { return 'instanceMatrix'; }
}
class InstanceColourNode extends Node<'vec3'> {
  constructor() { super('vec3'); }
  override generate(): string { return 'instanceColor'; }
}

/** Shader features only: neither object identity nor instance count adds a program. */
export function nodeInstanceKey(object: unknown): string {
  return object instanceof InstancedMesh ? `instances:${object.instanceColor === null ? 'plain' : 'colour'}` : 'mesh';
}

/** Replace only stock instancing while retaining morph, skin, displacement and
 * authored position-node order. Restoration also runs after a failed build. */
export function buildWithInstanceAttributes(material: NodeMaterial, build: () => void): void {
  const original: unknown = Reflect.get(material, 'setupPosition');
  const setup = material.setupPosition.bind(material);
  material.setupPosition = function setupPosition(builder) {
    const object = builder.object;
    if (!(object instanceof InstancedMesh)) return setup(builder);
    const position = this.positionNode;
    this.positionNode = Fn(() => {
      const matrix = nodeObject(new InstanceMatrixNode());
      positionLocal.assign(matrix.mul(positionLocal).xyz);
      if (builder.geometry.hasAttribute('normal')) normalLocal.assign(transformNormal(normalLocal, matrix));
      if (object.instanceColor !== null) varyingProperty('vec3', 'vInstanceColor').assign(nodeObject(new InstanceColourNode()));
      return position === null ? positionLocal : subBuild(position, 'POSITION', 'vec3');
    })();
    // Stock setup still owns the other deformation stages. Hide its instancing
    // branch only during this synchronous stage; no object or geometry is edited.
    builder.object = new Proxy(object, {
      get(target, property, receiver): unknown {
        return property === 'isInstancedMesh' ? false : Reflect.get(target, property, receiver);
      },
    });
    try { return setup(builder); }
    finally { builder.object = object; this.positionNode = position; }
  };
  try { build(); }
  finally { Reflect.set(material, 'setupPosition', original); }
}

/** Raw node shaders have no classic shader prefix. The classic binding states
 * resolve these two reserved names from the current object, never its geometry. */
export function instanceAttributeShader(shader: string, object: Object3D): string {
  if (!(object instanceof InstancedMesh)) return shader;
  return `in mat4 instanceMatrix;\n${object.instanceColor === null ? '' : 'in vec3 instanceColor;\n'}${shader}`;
}
