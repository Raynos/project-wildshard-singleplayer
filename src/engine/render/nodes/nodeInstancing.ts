/** Node graphs use the classic renderer's per-object instance attributes.
 * Their names and layout are independent of instance count and material. */
import { BatchedMesh, InstancedMesh, ShaderChunk, type Object3D } from 'three';
import { Node, type NodeBuilder, type NodeMaterial } from 'three/webgpu';
import { Fn, nodeObject, normalLocal, positionLocal, subBuild, transformNormal, varyingProperty, vec3 } from 'three/tsl';

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
/** Classic renderer updates these reserved texture uniforms for each draw. */
class BatchMatrixNode extends Node<'mat4'> {
  constructor() { super('mat4'); }
  override generate(): string { return 'getBatchingMatrix( getIndirectIndex( gl_DrawID ) )'; }
}
class BatchColourNode extends Node<'vec4'> {
  constructor() { super('vec4'); }
  override generate(): string { return 'getBatchingColor( getIndirectIndex( gl_DrawID ) )'; }
}

const batchHasColour = (object: BatchedMesh): boolean => Reflect.get(object, '_colorsTexture') !== null;

/** Full renderer-bound member transform for instances and existing batches; ordinary objects use identity. Vertex stage only. */
export function instanceTransformNode(value: Node<'vec4'>): Node<'vec4'> {
  return Fn((builder: NodeBuilder): Node<'vec4'> => {
    if (builder.object instanceof InstancedMesh) return nodeObject(new InstanceMatrixNode()).mul(value);
    if (builder.object instanceof BatchedMesh) return nodeObject(new BatchMatrixNode()).mul(value);
    return value;
  })();
}

/** Renderer-bound instance tint. Like the matrix, it follows cull compaction. */
export function instanceColourNode(): Node<'vec3'> {
  return Fn((builder: NodeBuilder): Node<'vec3'> => {
    if (builder.object instanceof InstancedMesh && builder.object.instanceColor !== null) return nodeObject(new InstanceColourNode());
    if (builder.object instanceof BatchedMesh && batchHasColour(builder.object)) return nodeObject(new BatchColourNode()).rgb;
    return vec3(1);
  })();
}

/** Shader features only: neither object identity nor instance count adds a program. */
export function nodeInstanceKey(object: unknown): string {
  if (object instanceof BatchedMesh) return batchHasColour(object) ? 'batch:colour' : 'batch:plain';
  return object instanceof InstancedMesh ? `instances:${object.instanceColor === null ? 'plain' : 'colour'}` : 'mesh';
}

/** Replace stock instance/batch placement while retaining morph, skin, displacement and
 * authored position-node order. Restoration also runs after a failed build. */
export function buildWithInstanceAttributes(material: NodeMaterial, build: () => void): void {
  const original: unknown = Reflect.get(material, 'setupPosition');
  const setup = material.setupPosition.bind(material);
  material.setupPosition = function setupPosition(builder) {
    const object = builder.object;
    if (!(object instanceof InstancedMesh || object instanceof BatchedMesh)) return setup(builder);
    const position = this.positionNode;
    this.positionNode = Fn(() => {
      const matrix = object instanceof InstancedMesh ? nodeObject(new InstanceMatrixNode()) : nodeObject(new BatchMatrixNode());
      positionLocal.assign(matrix.mul(positionLocal).xyz);
      if (builder.geometry.hasAttribute('normal')) normalLocal.assign(transformNormal(normalLocal, matrix));
      if (object instanceof InstancedMesh && object.instanceColor !== null) varyingProperty('vec3', 'vInstanceColor').assign(nodeObject(new InstanceColourNode()));
      if (object instanceof BatchedMesh && batchHasColour(object)) varyingProperty('vec4', 'vBatchColor').assign(nodeObject(new BatchColourNode()));
      return position === null ? positionLocal : subBuild(position, 'POSITION', 'vec3');
    })();
    // Stock setup still owns the other deformation stages. Hide its instancing
    // branch only during this synchronous stage; no object or geometry is edited.
    builder.object = new Proxy(object, {
      get(target, property, receiver): unknown {
        return property === 'isInstancedMesh' || property === 'isBatchedMesh' ? false : Reflect.get(target, property, receiver);
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
export function instanceAttributeShader(shader: string, object: Object3D, multiDraw = false): string {
  if (object instanceof BatchedMesh) {
    // The same stock helpers and draw-ID fallback as classic BatchedMesh. This
    // adds no draw path: WebGLRenderer still dispatches the existing batches.
    const extensions = shader.match(/^#extension[^\n]*$/gmu) ?? [];
    const body = shader.replaceAll(/^#extension[^\n]*\n?/gmu, '');
    const drawExtension = multiDraw && !extensions.some(line => line.includes('GL_ANGLE_multi_draw')) ? '#extension GL_ANGLE_multi_draw : require\n' : '';
    return `${drawExtension}${extensions.join('\n')}\n#define USE_BATCHING\n${batchHasColour(object) ? '#define USE_BATCHING_COLOR\n' : ''}${ShaderChunk.batching_pars_vertex}\n${body}`;
  }
  if (!(object instanceof InstancedMesh)) return shader;
  return `in mat4 instanceMatrix;\n${object.instanceColor === null ? '' : 'in vec3 instanceColor;\n'}${shader}`;
}
