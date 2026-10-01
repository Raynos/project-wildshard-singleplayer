import type { WildshardProbe, HarnessPins } from './probe';

declare global {
  interface Window { __wildshard?: WildshardProbe; __wildshardHarness?: HarnessPins }
}
