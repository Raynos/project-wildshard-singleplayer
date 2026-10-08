export function installSafariFixture(dist: string): { originalSHA256: string; injectedSHA256: string; start: (developer: boolean) => void; close: () => void };
