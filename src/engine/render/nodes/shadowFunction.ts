/**
 * A shadow filter as one GLSL function call (G743 / G717, per-build CPU). A node filter's taps, as TSL nodes, are what
 * every node build processes again for every shadowed light (one stock node build is one slow phone frame); a filter
 * written as a GLSL function costs a build one call node. The function is the node filter's own expressions in their
 * order, so it draws the same. Its code is a `glsl` code node the call declares once in each program that calls it.
 */
import { TempNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import { nodeObject } from 'three/tsl';

/** a node's generated snippet (a build in the generate stage returns its code) */
function snippet(node: Node, builder: NodeBuilder, output: string): string {
  const code = node.build(builder, output);
  if (typeof code !== 'string') throw new Error('shadowFunction: an input generated no code');
  return code;
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
 * Call GLSL function `name`, declared by `code`, with the shadow map and `args` (each with its GLSL type). `map` must be a
 * compare sample of the shadow's depth map (shadowDepthSample(...).compare(...)), so the program declares the map as a
 * shadow sampler; the call generates only its uniform.
 */
export function shadowFunctionCall(code: Node, name: string, map: TextureNode, args: readonly (readonly [Node, string])[]): Node<'float'> {
  return nodeObject(new ShadowFunctionNode(code, name, map, args));
}
