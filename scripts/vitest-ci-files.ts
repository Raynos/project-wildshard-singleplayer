/** Native browser startup owns a runner, separate from parallel I/O-heavy
 * source/product suites. Local and nightly discovery remain unchanged. */
export const CI_SERIAL_TESTS = ['test/tooling/parity/browser-escape.test.mjs'] as const;
