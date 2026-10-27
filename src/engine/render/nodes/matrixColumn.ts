/**
 * Column `index` of a mat3 node, as a vec3 (three's typings give a matrix node no element read). The engine's shared
 * layout functions (graph/compile.ts `physicalDirect`, cascadeLightNode.ts's cascade gate) return several vec3 results
 * as a mat3's columns; each caller reads them back with this (G717.O4.4).
 */
import { Node as BaseNode, type Node, type NodeBuilder } from 'three/webgpu';

export class MatrixColumnNode extends BaseNode<'vec3'> {
  readonly matrix: Node;
  readonly index: number;
  constructor(matrix: Node, index: number) { super('vec3'); this.matrix = matrix; this.index = index; }
  override generate(builder: NodeBuilder): string {
    const matrix = this.matrix.build(builder, 'mat3');
    if (typeof matrix !== 'string') throw new Error('MatrixColumnNode: a matrix generated no code');
    return `${matrix}[ ${String(this.index)} ]`;
  }
}
