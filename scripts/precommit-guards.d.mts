/** Extract exactly the selected immutable Git tree paths through an owned temporary archive file. */
export function extractGuardArchive(root: string, tree: string, paths: readonly string[], destination: string): void;
/** Validate Git's indexed source snapshot; the shared working tree never participates. */
export function precommitGuards(root?: string): void;
