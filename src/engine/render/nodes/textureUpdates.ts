/** Schedule render inputs and coalesce stock pure reads between callbacks. */
import type { Texture } from 'three';
import { MaterialReferenceNode, Node as BaseNode, NodeUpdateType, ReferenceNode, TextureNode, type Node, type NodeFrame } from 'three/webgpu';

interface FlipTexture extends TextureNode {
  readonly _matrixUniform: object | null;
  readonly _flipYUniform: { value: boolean } | null;
}
type SampleTexture = Texture & { readonly isDepthTexture?: boolean; readonly isFramebufferTexture?: boolean };
const prototype: unknown = TextureNode.prototype;
const stockUpdate: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'update') : undefined;
const stockReference: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'updateReference') : undefined;
interface TextureRun { readonly base: TextureNode; epoch: number; flip: boolean }
/** A stock reference read as `NodeFrame.updateNode` dispatches it: the update type, the reference's target, the update
 * and its value read. Each is checked per draw, so a node edited after its plan was made keeps the stock dispatch. */
interface ReadNode extends Node {
  readonly object: unknown;
  readonly material?: unknown;
  readonly properties: readonly string[];
  readonly node: { value: unknown } | null;
  reference: unknown;
  readonly updateValue: unknown;
  readonly getValueFromReference: unknown;
}
const prototypeMethod = (target: unknown, key: string): unknown => (typeof target === 'object' && target !== null ? Reflect.get(target, key) : undefined);
const referencePrototype: unknown = ReferenceNode.prototype, materialReferencePrototype: unknown = MaterialReferenceNode.prototype;
const referenceUpdate = prototypeMethod(referencePrototype, 'update'), referenceValue = prototypeMethod(referencePrototype, 'updateValue');
const referenceGet = prototypeMethod(referencePrototype, 'getValueFromReference'), nodeUpdateType = prototypeMethod(BaseNode.prototype, 'getUpdateType');
const referenceTarget = prototypeMethod(referencePrototype, 'updateReference'), materialTarget = prototypeMethod(materialReferencePrototype, 'updateReference');
/** A stock `ReferenceNode` / `MaterialReferenceNode` (no subclass) with a built uniform: its update is a pure read. */
function isReadNode(node: Node): node is ReadNode {
  const proto: unknown = Object.getPrototypeOf(node);
  if (proto !== referencePrototype && proto !== materialReferencePrototype) return false;
  const uniform: unknown = Reflect.get(node, 'node'), properties: unknown = Reflect.get(node, 'properties');
  return typeof uniform === 'object' && uniform !== null && Array.isArray(properties);
}
type Update = { readonly kind: 'ordinary'; readonly node: Node } | {
  readonly kind: 'sample'; readonly node: FlipTexture; readonly flip: { value: boolean };
  readonly reference: Node | null; readonly run: TextureRun;
} | { readonly kind: 'read'; readonly node: ReadNode; readonly material: boolean; readonly target: unknown };
interface Plan { readonly updates: readonly Update[]; epoch: number; readonly reads: boolean }
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
 * No texture, clock, shader, buffer or program key is modified.
 *
 * `inlineReads` (the Debug row Performance ▸ Inline graph reads, default off, sp-o285): a stock reference (`reference()`
 * on a shared uniform holder, `materialReference()`, an object-relative reference) is read in place instead of through
 * `NodeFrame.updateNode` → `updateReference` → `update` → `updateValue` → `getValueFromReference`. It still reads its
 * holder on every draw, so an edit made between two draws of one pass (by game code or a custom object callback) is
 * seen exactly as before; only the dispatch goes. A pure read never retargets a sampler, so it does not end a sampler
 * run either. A node whose update, target or type was replaced after its plan was made, an array value, a property path
 * or an unbuilt uniform keeps the stock dispatch. */
export class TextureUpdates {
  /** read stock references in place (the Debug row; a plan made under the other setting is remade) */
  inlineReads = false;
  /** stock reference reads made in place since the counter was last reset (diagnostic) */
  inlinedReads = 0;
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
    if (plan?.reads !== this.inlineReads) { plan = this.prepare(nodes); this.plans.set(nodes, plan); }
    const frame = this.frame;
    const pass = this.passes.at(-1);
    if (pass === undefined) frame.renderId = ++this.serial;
    else {
      if (pass.camera !== frame.camera) { pass.id = ++this.serial; pass.camera = frame.camera; }
      frame.renderId = pass.id;
    }
    let epoch = ++plan.epoch;
    for (const entry of plan.updates) {
      if (entry.kind === 'read') {
        const node = entry.node;
        if (node.updateType === NodeUpdateType.OBJECT && node.getUpdateType === nodeUpdateType && node.update === referenceUpdate &&
          node.updateReference === entry.target && node.updateValue === referenceValue && node.getValueFromReference === referenceGet) {
          // updateReference: an explicit holder, else the drawn object (material) of the node frame
          const fixed = entry.material ? node.material : node.object;
          const holder: unknown = fixed ?? (entry.material ? frame.material : frame.object);
          const properties = node.properties, uniform = node.node, key = properties[0];
          if (properties.length === 1 && key !== undefined && uniform !== null && typeof holder === 'object' && holder !== null) {
            const value: unknown = Reflect.get(holder, key);
            if (!Array.isArray(value)) { node.reference = holder; uniform.value = value; this.inlinedReads++; continue; }
          }
        }
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
      if (this.inlineReads && isReadNode(node)) {
        const material = Object.getPrototypeOf(node) === materialReferencePrototype;
        updates.push({kind: 'read', node, material, target: material ? materialTarget : referenceTarget}); continue;
      }
      updates.push({kind: 'ordinary', node});
    }
    return {updates, epoch: 0, reads: this.inlineReads};
  }
}
