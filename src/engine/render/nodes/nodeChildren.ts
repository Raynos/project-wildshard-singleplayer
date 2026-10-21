import { Node } from 'three/webgpu';

function node(value: unknown): value is Node {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && Reflect.get(value, 'isNode') === true;
}

/** Snapshot the same immediate children as Node._getChildren, without its
 * property/index descriptors. Snapshotting finishes before the first yield:
 * child setup may mutate its parent's properties while the iterator runs. */
function snapshot(parent: Node): Node[] {
  const children: Node[] = [];
  for (const property of Object.getOwnPropertyNames(parent)) {
    const value: unknown = Reflect.get(parent, property);
    if (property.startsWith('_') || value === parent) continue;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const child: unknown = value[index];
        if (node(child)) children.push(child);
      }
    } else if (node(value)) children.push(value);
    else if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      for (const key in value) {
        if (key.startsWith('_')) continue;
        const child: unknown = Reflect.get(value, key);
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
