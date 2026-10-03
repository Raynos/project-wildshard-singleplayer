// The entry's first decision after a page restart (src/bootRoute.ts): a pure function, tested without mocking the
// entry's imports (E422).
import { describe, expect, it } from 'vitest';
import { bootRoute } from '../src/bootRoute';

const q = (s: string): URLSearchParams => new URLSearchParams(s);
const abrupt = { line: 'Abrupt previous page: Nine Dragon firstFrame 95% (cause unknown)', level: 'nine-dragon-stack' };
const clean = { line: '', level: '' };

describe('entry after a Nine Dragon page restart', () => {
  it('rescues an abrupt retry of the same level to the title', () => {
    expect(bootRoute(q('?chunk=nine-dragon-stack&glreload=1&v=old'), abrupt)).toEqual({ rescue: true, titleOnly: true });
  });
  it('loads the level normally after an intentional choice (no abrupt record)', () => {
    expect(bootRoute(q('?chunk=nine-dragon-stack'), clean)).toEqual({ rescue: false, titleOnly: false });
  });
  it('loads another level normally even after an abrupt end', () => {
    expect(bootRoute(q('?chunk=pine-hollow'), abrupt)).toEqual({ rescue: false, titleOnly: false });
  });
  it('a bare URL, or only ?v=, is the title', () => {
    expect(bootRoute(q(''), clean).titleOnly).toBe(true);
    expect(bootRoute(q('?v=abc'), clean).titleOnly).toBe(true);
    expect(bootRoute(q('?v=abc&chunk=pine-hollow'), clean).titleOnly).toBe(false);
  });
});
