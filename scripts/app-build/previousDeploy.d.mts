/** Carry one previous immutable output graph; publish only this build's graph. */
export function carryPreviousDeploy(directory: string, options?: {
  readonly previousDirectory?: string;
  readonly previousOrigin?: string;
}): Promise<{current: number; carried: number; bytes: number}>;
