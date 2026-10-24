import { Node } from 'three/webgpu';

// Plain property reads, not Reflect.get: JavaScriptCore runs Reflect.get as a native call per property, where a read is
// an inline cache (the snapshot was 160 self samples of a Nalati drive Simulator profile on edd48d2f4c: node builds)
/** an object read as its fields (a node's own properties, a plain sub-object's) */
function fields(value: object): value is Record<string, unknown> { return value !== null; }

function node(value: unknown): value is Node {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && fields(value) && value['isNode'] === true;
}

/** Snapshot the same immediate children as Node._getChildren, without its
 * property/index descriptors. Snapshotting finishes before the first yield:
 * child setup may mutate its parent's properties while the iterator runs. */
function snapshot(parent: Node): Node[] {
  const children: Node[] = [];
  if (!fields(parent)) return children;
  for (const property of Object.getOwnPropertyNames(parent)) {
    const value: unknown = parent[property];
    if (property.startsWith('_') || value === parent) continue;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const child: unknown = value[index];
        if (node(child)) children.push(child);
      }
    } else if (node(value)) children.push(value);
    else if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      if (!fields(value)) continue;
      for (const key in value) {
        if (key.startsWith('_')) continue;
        const child: unknown = value[key];
        if (node(child)) children.push(child);
      }
    }
  }
  return children;
}

/** Run one synchronous node build with equivalent eager child traversal.
 * Custom child collectors keep the stock method. Both success and failure
 * restore the original prototype; no graph or shader cache is retained. */
export function withNodeChildSnapshots(build: () => void): void {
  const prototype: unknown = Node.prototype;
  if (prototype === null || typeof prototype !== 'object') throw new Error('Node traversal prototype is missing');
  const previous: unknown = Reflect.get(prototype, 'getChildren'), collector: unknown = Reflect.get(prototype, '_getChildren');
  const reader = (value: unknown): value is (this: Node) => Generator<Node> => typeof value === 'function';
  if (!reader(previous)) throw new Error('Node child reader is missing');
  Reflect.set(prototype, 'getChildren', function* getChildren(this: Node): Generator<Node> {
    if (Reflect.get(this, '_getChildren') !== collector) { yield* previous.call(this); return; }
    yield* snapshot(this);
  });
  try { build(); }
  finally { Reflect.set(prototype, 'getChildren', previous); }
}
