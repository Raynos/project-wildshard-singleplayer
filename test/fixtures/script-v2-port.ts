import type { compileDualScriptV2 } from '../../src/sdk/bake/compileDualScriptV2';

/** Each port's shadow adapters exercise the admitted artifacts as well as
 * compile them. CI discovers fixtures without a manually maintained list. */
export interface DualPortFixture {
  readonly input: Parameters<typeof compileDualScriptV2>[0];
  readonly verify: (pair: Awaited<ReturnType<typeof compileDualScriptV2>>) => Promise<void>;
}
