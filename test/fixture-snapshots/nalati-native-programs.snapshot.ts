import { expect, test } from 'vitest';
import { nalatiNativeProgram } from '../fixtures/nalati-native-program';

// Execute the original source/host-fenced compilers once. Only their complete
// primitive text crosses realms; each original consumer still parses it and
// runs every numeric, admission, ownership and refusal oracle itself.
const names = ['kokpar', 'titan', 'riding', 'charge', 'geography', 'view'] as const;
const envelopes = new Map<string, string>();
for (const name of names) envelopes.set(name, await nalatiNativeProgram(name));

test('nalati-native-programs snapshot', () => {
  expect([...envelopes.keys()]).toEqual([...names]);
  for (const text of envelopes.values()) expect(JSON.parse(text)).toBeTypeOf('object');
});
