export const PLATFORM_LISTS: readonly string[];
export function comparePlatformList(list: string, baselineFile: string, candidateFile: string, trees?: { baselineRoot: string; candidateRoot: string },
  sections?: { before: unknown; after: unknown }): string[];
export function checkPlatformRatchets(baselineRoot: string, candidateRoot: string): string[];
