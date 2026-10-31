import type { ProbePose } from '../types/wildshard-probe.d.ts';

export function censusSelection(slug?: string, pinePose?: string, mode?: string): {
  slug: string; poseName: string; pose: ProbePose; modes: string[];
}[];
