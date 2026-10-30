/** Native controls own both runner cores: a story child already runs its real
 * resident and independent replay worker. A sibling Vitest file must not add a
 * second pair. Every file still runs once; local/nightly discovery is unchanged. */
export const CI_SERIAL_TESTS = [
  'test/tooling/parity/browser-escape.test.mjs',
  'test/pine-quest-verbs.test.ts',
  'test/driftwood-story-verbs.test.ts',
  'test/nalati-discovery-verbs.test.ts',
  'test/nalati-titan-verbs.test.ts',
] as const;
