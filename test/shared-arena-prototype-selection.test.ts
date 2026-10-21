import { describe, expect, test } from 'vitest';
import { validatePrototypeSelectionKeys } from '../practice/shared-arena/prototypeSelection';

describe('explicit prototype selection', () => {
  const ids = ['bellback:bellback'];
  test('leaves existing owners unchanged', () => {
    expect(() => validatePrototypeSelectionKeys(ids, undefined, false)).not.toThrow();
    expect(() => validatePrototypeSelectionKeys(ids, undefined, true)).not.toThrow();
  });
  test('accepts one exact prototype', () => {
    expect(() => validatePrototypeSelectionKeys(ids, { 'bellback:bellback': { death: 'despawn' } }, false)).not.toThrow();
  });
  test('refuses empty, unknown and mixed owners', () => {
    expect(() => validatePrototypeSelectionKeys(ids, {}, false)).toThrow('one exact');
    expect(() => validatePrototypeSelectionKeys(ids, { 'other:other': { death: 'despawn' } }, false)).toThrow('one exact');
    expect(() => validatePrototypeSelectionKeys(ids, { 'bellback:bellback': { death: 'despawn' } }, true)).toThrow('no native');
  });
});
