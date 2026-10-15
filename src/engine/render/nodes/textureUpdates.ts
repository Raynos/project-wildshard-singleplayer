/** Coalesce pure sampler reads without caching across object-dependent updates. */
import type { Texture } from 'three';
import { NodeUpdateType, TextureNode, type Node, type NodeFrame } from 'three/webgpu';

interface FlipTexture extends TextureNode {
  readonly _matrixUniform: object | null;
  readonly _flipYUniform: { value: boolean } | null;
}
type SampleTexture = Texture & { readonly isDepthTexture?: boolean; readonly isFramebufferTexture?: boolean };
const prototype: unknown = TextureNode.prototype;
const stockUpdate: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'update') : undefined;
const stockReference: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'updateReference') : undefined;
interface TextureRun { readonly base: TextureNode; epoch: number; flip: boolean }
type Update = { readonly kind: 'ordinary'; readonly node: Node } | {
  readonly kind: 'sample'; readonly node: FlipTexture; readonly flip: { value: boolean };
  readonly reference: Node | null; readonly run: TextureRun;
};
interface Plan { readonly updates: readonly Update[]; epoch: number }
function isNode(value: object): value is Node { return Reflect.get(value, 'isNode') === true; }
function isFlipTexture(node: Node): node is Node & FlipTexture {
  if (!(node instanceof TextureNode) || Reflect.get(node, 'update') !== stockUpdate ||
    Reflect.get(node, 'updateReference') !== stockReference || Reflect.get(node, '_matrixUniform') !== null) return false;
  const flip: unknown = Reflect.get(node, '_flipYUniform');
  return typeof flip === 'object' && flip !== null && typeof Reflect.get(flip, 'value') === 'boolean';
}
function textureFlip(texture: SampleTexture): boolean {
  return (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap && texture.flipY) ||
    texture.isRenderTargetTexture || texture.isFramebufferTexture === true || texture.isDepthTexture === true;
}

/** Stock frame/render scheduling remains on every generic updater. Only stock,
 * matrix-free OBJECT samplers share a pure read until the next generic update.
 * No texture, clock, shader, buffer or program key is modified. */
export class TextureUpdates {
  private readonly plans = new WeakMap<object, Plan>();
  private readonly frame: NodeFrame;
  constructor(frame: NodeFrame) { this.frame = frame; }

  update(nodes: unknown): void {
    if (!Array.isArray(nodes)) throw new Error('Missing node update list');
    let plan = this.plans.get(nodes);
    if (plan === undefined) { plan = this.prepare(nodes); this.plans.set(nodes, plan); }
    const frame = this.frame;
    frame.renderId++;
    let epoch = ++plan.epoch;
    for (const entry of plan.updates) {
      if (entry.kind === 'sample') {
        const {node, run} = entry;
        if (node.updateType === NodeUpdateType.OBJECT && node.update === stockUpdate && node.updateReference === stockReference &&
          node._matrixUniform === null && node._flipYUniform === entry.flip && node.referenceNode === entry.reference && run.base.referenceNode === null) {
          if (run.epoch !== epoch) { run.flip = textureFlip(run.base.value); run.epoch = epoch; }
          entry.flip.value = run.flip;
          continue;
        }
      }
      frame.updateNode(entry.node);
      // A callback can retarget a sampler, edit its texture or recursively render.
      epoch = ++plan.epoch;
    }
  }

  private prepare(nodes: readonly unknown[]): Plan {
    const runs = new Map<TextureNode, TextureRun>(), updates: Update[] = [];
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null || !isNode(node)) throw new Error('Invalid update node');
      if (isFlipTexture(node) && node._flipYUniform !== null) {
        const ref = node.referenceNode, base = ref === null ? node : ref instanceof TextureNode ? ref : null;
        // Keep custom getters and reference chains on the stock dispatcher.
        if (base?.referenceNode === null && Object.getPrototypeOf(base) === prototype && !Object.hasOwn(base, 'value')) {
          let run = runs.get(base);
          if (run === undefined) { run = {base, epoch: -1, flip: false}; runs.set(base, run); }
          updates.push({kind: 'sample', node, flip: node._flipYUniform, reference: ref, run}); continue;
        }
      }
      updates.push({kind: 'ordinary', node});
    }
    return {updates, epoch: 0};
  }
}
