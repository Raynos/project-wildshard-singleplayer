/** Native integration keeps its original deadlines without sibling Vitest workers.
 * Groups run files sequentially; parallel discovery excludes their exact union. */
export const CI_NATIVE_GROUPS = {
  'escape-titan': [
    'test/tooling/parity/browser-escape.test.mjs',
    'test/nalati-titan-verbs.test.ts',
    'test/driftwood-optional-verbs.test.ts',
  ],
  'stories-qara': [
    'test/pine-quest-verbs.test.ts',
    'test/pine-door-continuation.test.ts',
    'test/native-runtime-observation.test.ts',
    'test/driftwood-story-verbs.test.ts',
    'test/nalati-discovery-verbs.test.ts',
    'test/nalati-qara-verbs.test.ts',
  ],
} as const;
export const CI_SERIAL_TESTS = Object.values(CI_NATIVE_GROUPS).flat();
