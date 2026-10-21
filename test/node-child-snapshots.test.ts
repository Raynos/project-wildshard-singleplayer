import { expect, test } from 'vitest';
import { Node } from 'three/webgpu';
import { withNodeChildSnapshots } from '../src/engine/render/nodes/nodeChildren';

function reader(): unknown {
  const prototype: unknown = Node.prototype;
  if (prototype === null || typeof prototype !== 'object') throw new Error('Missing prototype');
  return Reflect.get(prototype, 'getChildren');
}

function fixture() {
  const root = new Node(), a = new Node(), b = new Node(), c = new Node(), hidden = new Node(), nonEnumerable = new Node();
  Object.assign(root, { child: a, list: [b, false, a], nested: { visible: c, _hidden: hidden }, _hidden: hidden, self: root });
  Object.defineProperty(root, 'nonEnumerable', { value: nonEnumerable });
  return { root, a, b, c, hidden, nonEnumerable };
}

test('node child snapshot preserves order, duplicates, visibility and eager mutation semantics', () => {
  const f = fixture(), expected = [...f.root.getChildren()];
  expect(expected).toEqual([f.a, f.b, f.a, f.c, f.nonEnumerable]);
  withNodeChildSnapshots(() => {
    expect([...f.root.getChildren()]).toEqual(expected);
    const iterator = f.root.getChildren();
    expect(iterator.next().value).toBe(f.a);
    Reflect.set(f.root, 'list', [f.hidden]); Reflect.set(f.root, 'nested', {});
    expect([...iterator]).toEqual(expected.slice(1));
    expect([...f.root.getChildren()]).toEqual([f.a, f.hidden, f.nonEnumerable]);
  });
});

test('custom child collectors and nested builds retain the stock extension path', () => {
  const root = new Node(), child = new Node();
  Reflect.set(root, '_getChildren', () => [{ childNode: child }]);
  const previous = reader();
  withNodeChildSnapshots(() => {
    expect([...root.getChildren()]).toEqual([child]);
    const outer = reader();
    withNodeChildSnapshots(() => { expect([...root.getChildren()]).toEqual([child]); });
    expect(reader()).toBe(outer);
  });
  expect(reader()).toBe(previous);
});

test('node child traversal restores the method after a refused build', () => {
  const previous = reader();
  expect(() => { withNodeChildSnapshots(() => { throw new Error('build refused'); }); }).toThrow('build refused');
  expect(reader()).toBe(previous);
});
