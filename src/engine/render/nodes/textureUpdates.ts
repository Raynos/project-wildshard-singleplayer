/** Schedule render inputs and coalesce stock pure reads between callbacks. */
import { Material, Object3D, type Texture } from 'three';
import { NodeUpdateType, ReferenceNode, TextureNode, type Node, type NodeFrame } from 'three/webgpu';

interface FlipTexture extends TextureNode {
  readonly _matrixUniform: object | null;
  readonly _flipYUniform: { value: boolean } | null;
}
type SampleTexture = Texture & { readonly isDepthTexture?: boolean; readonly isFramebufferTexture?: boolean };
const prototype: unknown = TextureNode.prototype;
const stockUpdate: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'update') : undefined;
const stockReference: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'updateReference') : undefined;
interface TextureRun { readonly base: TextureNode; epoch: number; flip: boolean }
/** A stock reference to a fixed holder (a shared uniform, a day key): its value cannot change between the draws of one
 * camera pass, so it is read once per pass instead of once per draw (sp-o276: a third of the per-draw node work on
 * Safari). Object- and material-relative references, subclasses and custom callbacks keep the per-draw dispatch. */
interface PassReference { readonly kind: 'pass'; readonly node: Node; last: number }
const referencePrototype: unknown = ReferenceNode.prototype;
const referenceUpdate: unknown = Reflect.get(ReferenceNode.prototype, 'update');
const referenceReference: unknown = Reflect.get(ReferenceNode.prototype, 'updateReference');
function isPassReference(node: Node): boolean {
  if (Object.getPrototypeOf(node) !== referencePrototype || node.updateType !== NodeUpdateType.OBJECT) return false;
  if (Reflect.get(node, 'update') !== referenceUpdate || Reflect.get(node, 'updateReference') !== referenceReference) return false;
  const holder: unknown = Reflect.get(node, 'object');
  return typeof holder === 'object' && holder !== null && !(holder instanceof Object3D) && !(holder instanceof Material);
}
type Update = { readonly kind: 'ordinary'; readonly node: Node } | PassReference | {
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
  // Targets/depth always flip. Avoid WebKit's DOM-class check for every shadow
  // sample; ordinary images still use the live image and flipY policy.
  return texture.isRenderTargetTexture || texture.isFramebufferTexture === true || texture.isDepthTexture === true ||
    (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap && texture.flipY);
}

/** RENDER nodes share a camera-pass epoch. Object inputs and custom callbacks
 * keep NodeFrame dispatch. Matrix-free
 * samplers share a pure read only until the next object-dependent updater.
 * No texture, clock, shader, buffer or program key is modified. */
export class TextureUpdates {
  private readonly plans = new WeakMap<object, Plan>();
  private readonly frame: NodeFrame;
  private serial = 0;
  private readonly passes: { id: number; camera: NodeFrame['camera'] }[] = [];
  constructor(frame: NodeFrame) { this.frame = frame; }
  /** A render and each nested/shadow camera pass have their own RENDER epoch. */
  beginRender(): void { this.passes.push({ id: ++this.serial, camera: this.frame.camera }); }
  endRender(): void {
    this.passes.pop(); const outer = this.passes.at(-1);
    if (outer !== undefined) { outer.id = ++this.serial; outer.camera = this.frame.camera; }
  }

  update(nodes: unknown): void {
    if (!Array.isArray(nodes)) throw new Error('Missing node update list');
    let plan = this.plans.get(nodes);
    if (plan === undefined) { plan = this.prepare(nodes); this.plans.set(nodes, plan); }
    const frame = this.frame;
    const pass = this.passes.at(-1);
    if (pass === undefined) frame.renderId = ++this.serial;
    else {
      if (pass.camera !== frame.camera) { pass.id = ++this.serial; pass.camera = frame.camera; }
      frame.renderId = pass.id;
    }
    let epoch = ++plan.epoch;
    for (const entry of plan.updates) {
      if (entry.kind === 'pass') {
        if (entry.last === frame.renderId && entry.node.updateType === NodeUpdateType.OBJECT) continue;
        entry.last = frame.renderId;
      } else if (entry.kind === 'sample') {
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
      updates.push(isPassReference(node) ? {kind: 'pass', node, last: -1} : {kind: 'ordinary', node});
    }
    return {updates, epoch: 0};
  }
}
