/**
 * A shadow filter as one GLSL function call (G743 / G717, per-build CPU). A node filter's taps, as TSL nodes, are what
 * every node build processes again for every shadowed light (one stock node build is one slow phone frame); a filter
 * written as a GLSL function costs a build one call node. The function is the node filter's own expressions in their
 * order, so it draws the same. Its code is a `glsl` code node the call declares once in each program that calls it.
 */
import type * as THREE from 'three';
import { TempNode, TextureNode, type Node, type NodeBuilder } from 'three/webgpu';
import { nodeObject } from 'three/tsl';

/** a node's generated snippet (a build in the generate stage returns its code) */
function snippet(node: Node, builder: NodeBuilder, output: string): string {
  const code = node.build(builder, output);
  if (typeof code !== 'string') throw new Error('shadowFunction: an input generated no code');
  return code;
}

/** A shadow map handed to a function as its sampler: only its uniform is generated, so it builds no sample coordinate
 *  (TextureNode's flip select for the GLSL builder was set up and analysed for every call, never written) */
class ShadowMapNode extends TextureNode {
  setupUV(_builder: NodeBuilder, uvNode: Node): Node { return uvNode; }
}

/** `name( map, ...args )`: the shadow map as a compare sampler, then each argument as its GLSL type */
class ShadowFunctionNode extends TempNode<'float'> {
  private readonly code: Node;
  private readonly functionName: string;
  private readonly map: TextureNode;
  // the arguments as a node array (three's child walk reads node arrays: each is set up and analysed with the call)
  private readonly inputs: readonly Node[];
  private readonly types: readonly string[];

  constructor(code: Node, functionName: string, map: TextureNode, args: readonly (readonly [Node, string])[]) {
    super('float');
    this.code = code; this.functionName = functionName; this.map = map;
    this.inputs = args.map(([node]) => node); this.types = args.map(([, type]) => type);
  }

  override generate(builder: NodeBuilder): string {
    this.code.build(builder);
    const args = [snippet(this.map, builder, 'property'), ...this.inputs.map((node, i) => snippet(node, builder, this.types[i] ?? 'float'))];
    return `${this.functionName}( ${args.join(', ')} )`;
  }
}

/**
 * Call GLSL function `name`, declared by `code`, with the shadow's depth map (a compare sampler, so the program declares
 * a shadow sampler) and `args`, each with its GLSL type; `coord` is the shadow coordinate three hands the filter.
 */
export function shadowFunctionCall(code: Node, name: string, depth: THREE.DepthTexture, coord: Node<'vec3'>, args: readonly (readonly [Node, string])[]): Node<'float'> {
  const map = new ShadowMapNode(depth, coord.xy).compare(coord.z);
  return nodeObject(new ShadowFunctionNode(code, name, map, args));
}
