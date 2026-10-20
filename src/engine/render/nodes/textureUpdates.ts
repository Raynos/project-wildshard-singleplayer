/** Schedule render inputs and coalesce stock pure reads between callbacks. */
import type { Object3D, Texture } from 'three';
import { MaterialReferenceNode, ModelNode, NodeUpdateType, ReferenceNode, TextureNode, UniformGroupNode, UniformNode, type Node, type NodeFrame } from 'three/webgpu';

interface FlipTexture extends TextureNode {
  readonly _matrixUniform: object | null;
  readonly _flipYUniform: { value: boolean } | null;
}
type SampleTexture = Texture & { readonly isDepthTexture?: boolean; readonly isFramebufferTexture?: boolean };
const prototype: unknown = TextureNode.prototype;
const stockUpdate: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'update') : undefined;
const stockReference: unknown = typeof prototype === 'object' && prototype !== null ? Reflect.get(prototype, 'updateReference') : undefined;
interface TextureRun { readonly base: TextureNode; epoch: number; flip: boolean }
/** a stock reference node's parts its update touches: the reference it keeps and its (non-texture) uniform */
interface ReferenceParts { reference: unknown }
interface ValueParts { value: unknown }
type Update = { readonly kind: 'ordinary'; readonly node: Node } | {
  /** a stock ReferenceNode reading `value` of a fixed `{ value }` holder (the engine's uniform holders) */
  readonly kind: 'held'; readonly node: Node; readonly parts: ReferenceParts; readonly holder: ValueHolder; readonly uniform: ValueParts;
} | {
  readonly kind: 'sample'; readonly node: FlipTexture; readonly flip: { value: boolean };
  readonly reference: Node | null; readonly run: TextureRun;
} | {
  /** a stock ReferenceNode / MaterialReferenceNode: `holder` is its fixed object (null: the drawn material) */
  readonly kind: 'reference'; readonly node: Node; readonly parts: ReferenceParts; readonly holder: object | null; readonly source: unknown;
  readonly first: string; readonly rest: readonly string[]; readonly uniform: ValueParts;
} | {
  /** the stock model world matrix: the drawn object and its matrixWorld */
  readonly kind: 'model'; readonly node: Node; readonly parts: { object3d: Object3D | null }; readonly uniform: ValueParts;
} | {
  /** a stock object uniform group: marked for update on every draw */
  readonly kind: 'group'; readonly node: Node; readonly group: { needsUpdate: boolean };
};
interface Plan { readonly updates: readonly Update[]; epoch: number }
function isNode(value: object): value is Node { return Reflect.get(value, 'isNode') === true; }
function isFlipTexture(node: Node): node is Node & FlipTexture {
  if (!(node instanceof TextureNode) || Reflect.get(node, 'update') !== stockUpdate ||
    Reflect.get(node, 'updateReference') !== stockReference || Reflect.get(node, '_matrixUniform') !== null) return false;
  const flip: unknown = Reflect.get(node, '_flipYUniform');
  return typeof flip === 'object' && flip !== null && typeof Reflect.get(flip, 'value') === 'boolean';
}
/** Methods a node may not override for a direct update: the stock dispatcher would run its own. */
const DISPATCH = ['update', 'updateReference', 'getUpdateType', 'updateValue', 'getValueFromReference'] as const;
const prototypeOf = (stock: unknown): unknown => typeof stock === 'function' ? Reflect.get(stock, 'prototype') : undefined;
const referenceStock = prototypeOf(ReferenceNode), materialStock = prototypeOf(MaterialReferenceNode);
const modelStock = prototypeOf(ModelNode), groupStock = prototypeOf(UniformGroupNode);
const methodOf = (stock: unknown, name: string): unknown => typeof stock === 'object' && stock !== null ? Reflect.get(stock, name) : undefined;
/** the stock methods a direct entry stands for: a node that replaces one later (an instance override) is dispatched again */
const referenceUpdate = methodOf(referenceStock, 'update'), referenceSource = methodOf(referenceStock, 'updateReference');
const materialSource = methodOf(materialStock, 'updateReference');
const modelUpdate = methodOf(modelStock, 'update'), groupUpdate = methodOf(groupStock, 'update');
function stockDispatch(node: Node, stock: unknown): boolean {
  return Object.getPrototypeOf(node) === stock && node.updateType === NodeUpdateType.OBJECT && DISPATCH.every(name => !Object.hasOwn(node, name));
}
function isReferenceParts(node: Node): node is Node & ReferenceParts { return 'reference' in node; }
function isValueParts(value: unknown): value is ValueParts { return value instanceof UniformNode && !(value instanceof TextureNode); }
function isModelParts(node: Node): node is Node & { object3d: Object3D | null } { return 'object3d' in node; }
function isGroupParts(node: Node): node is Node & { needsUpdate: boolean } { return 'needsUpdate' in node; }
function stringList(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.every(p => typeof p === 'string'); }

/** a fixed `{ value }` uniform holder (its own data property): read as `holder.value`, one shape-cached load per draw */
interface ValueHolder { readonly value: unknown }
function isValueHolder(holder: unknown): holder is ValueHolder {
  if (typeof holder !== 'object' || holder === null) return false;
  const own = Object.getOwnPropertyDescriptor(holder, 'value');
  return own !== undefined && 'value' in own;
}

/** a direct update entry for a stock reference, model-matrix or object-group node, or null (it keeps NodeFrame dispatch) */
function directUpdate(node: Node): Update | null {
  if (stockDispatch(node, referenceStock) || stockDispatch(node, materialStock)) {
    const material = Object.getPrototypeOf(node) === materialStock;
    const holder: unknown = Reflect.get(node, material ? 'material' : 'object'), properties: unknown = Reflect.get(node, 'properties');
    const uniform: unknown = Reflect.get(node, 'node');
    if (!isReferenceParts(node) || !isValueParts(uniform) || !stringList(properties)) return null;
    // A reference without a fixed object reads the drawn object (stock ReferenceNode), never handled here.
    if (!material && (typeof holder !== 'object' || holder === null)) return null;
    const [first, ...rest] = properties;
    if (first === undefined) return null;
    if (!material && first === 'value' && rest.length === 0 && isValueHolder(holder)) return { kind: 'held', node, parts: node, holder, uniform };
    return { kind: 'reference', node, parts: node, holder: typeof holder === 'object' ? holder : null, source: material ? materialSource : referenceSource, first, rest, uniform };
  }
  if (stockDispatch(node, modelStock) && Reflect.get(node, 'scope') === ModelNode.WORLD_MATRIX) {
    const uniform: unknown = Reflect.get(node, 'uniformNode');
    return isModelParts(node) && isValueParts(uniform) ? { kind: 'model', node, parts: node, uniform } : null;
  }
  if (stockDispatch(node, groupStock)) return isGroupParts(node) ? { kind: 'group', node, group: node } : null;
  return null;
}

function textureFlip(texture: SampleTexture): boolean {
  // Targets/depth always flip. Images with flipY off (including compressed
  // textures) never need WebKit's expensive ImageBitmap identity check.
  return texture.isRenderTargetTexture || texture.isFramebufferTexture === true || texture.isDepthTexture === true ||
    (texture.flipY && typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap);
}

/** RENDER nodes share a camera-pass epoch. Stock reference, model-matrix and
 * object-group updates are written directly (every draw, the same values);
 * other object inputs and custom callbacks keep NodeFrame dispatch. Matrix-free
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
      if (entry.kind === 'sample') {
        const {node, run} = entry;
        if (node.updateType === NodeUpdateType.OBJECT && node.update === stockUpdate && node.updateReference === stockReference &&
          node._matrixUniform === null && node._flipYUniform === entry.flip && node.referenceNode === entry.reference && run.base.referenceNode === null) {
          if (run.epoch !== epoch) { run.flip = textureFlip(run.base.value); run.epoch = epoch; }
          entry.flip.value = run.flip;
          continue;
        }
      }
      // Stock reference / model / group updates, written directly: the same values the stock update writes, without
      // NodeFrame's dispatch. None of them runs a callback or moves a sampler, so the sampler epoch holds.
      if (entry.kind === 'held') {
        const node = entry.node;
        if (node.update === referenceUpdate && node.updateReference === referenceSource) {
          const value = entry.holder.value;
          if (!Array.isArray(value) && value !== undefined) { entry.parts.reference = entry.holder; entry.uniform.value = value; continue; }
        }
      } else if (entry.kind === 'reference') {
        const holder = entry.holder ?? frame.material, node = entry.node;
        if (holder !== null && node.update === referenceUpdate && node.updateReference === entry.source) {
          // a keyed read as the stock node's `object[property]` (Reflect.get is a slow native call in JSC)
          let value: unknown = (holder as Readonly<Record<string, unknown>>)[entry.first];
          for (const name of entry.rest) value = typeof value === 'object' && value !== null ? (value as Readonly<Record<string, unknown>>)[name] : undefined;
          if (!Array.isArray(value) && value !== undefined) { entry.parts.reference = holder; entry.uniform.value = value; continue; }
        }
      } else if (entry.kind === 'model') {
        const object = frame.object;
        if (object !== null && entry.node.update === modelUpdate) { entry.parts.object3d = object; entry.uniform.value = object.matrixWorld; continue; }
      } else if (entry.kind === 'group' && entry.node.update === groupUpdate) { entry.group.needsUpdate = true; continue; }
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
      updates.push(directUpdate(node) ?? {kind: 'ordinary', node});
    }
    return {updates, epoch: 0};
  }
}
