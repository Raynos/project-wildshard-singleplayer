import { expect, test } from 'vitest';
import * as v from 'valibot';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';

test('named schema conversion refuses unrecognised author predicates', () => {
  expect(() => namedJsonSchema(v.pipe(v.number(), v.check(n => n === 7)))).toThrow('cannot be converted');
});
