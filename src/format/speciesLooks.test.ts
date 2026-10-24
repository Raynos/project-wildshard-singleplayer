import { expect, test } from 'vitest';
import { parsePackedCreatureLooks } from './speciesLooks';

const inputBook = () => ({ poses: {}, rows: [{ id: 'look', species: 'species', kind: 'kind', skeleton: 'rig', sockets: ['body'], clips: [],
  variants: { plain: { body: 'plain', tint: { coat: [0.1, 0.2, 0.3] } } } }] });

test('only an owned immutable parsed look book carries reusable admission', () => {
  const input = inputBook(), parsed = parsePackedCreatureLooks(input);
  expect(parsed).toEqual({ ...input, frames: {} });
  expect(parsed).not.toBe(input);
  expect(parsePackedCreatureLooks(parsed)).toBe(parsed);
  const row = parsed.rows[0];
  if (row === undefined) throw new Error('Missing parsed look');
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(() => parsed.rows.push(row)).toThrow(TypeError);
  expect(() => row.sockets.push('edited')).toThrow(TypeError);
  expect(Object.isFrozen(row.variants?.['plain'])).toBe(true);
  const original = input.rows[0];
  if (original === undefined) throw new Error('Missing authored look');
  original.sockets.push('later');
  expect(parsePackedCreatureLooks(input).rows[0]?.sockets).toEqual(['body', 'later']);
  original.id = '';
  expect(() => parsePackedCreatureLooks(input)).toThrow();
  expect(parsePackedCreatureLooks(parsed)).toBe(parsed);
});

test('freezing or copying author input cannot forge a parsed look proof', () => {
  expect(() => parsePackedCreatureLooks(Object.freeze({ ...inputBook(), extra: true }))).toThrow();
  const parsed = parsePackedCreatureLooks(inputBook()), copied = structuredClone(parsed);
  expect(parsePackedCreatureLooks(copied)).not.toBe(parsed);
  const row = copied.rows[0];
  if (row === undefined) throw new Error('Missing copied look');
  row.id = '';
  expect(() => parsePackedCreatureLooks(copied)).toThrow();
  expect(() => parsePackedCreatureLooks({ ...inputBook(), poses: { invalid: { group: 'pose', programs: 'invalid' } } })).toThrow();
});
