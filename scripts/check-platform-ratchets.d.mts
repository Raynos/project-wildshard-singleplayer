export const PLATFORM_LISTS: readonly string[];
export function comparePlatformList(list: string, baselineFile: string, candidateFile: string): string[];
export function checkPlatformRatchets(baselineRoot: string, candidateRoot: string): string[];
