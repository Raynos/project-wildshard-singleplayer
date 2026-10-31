/** The app publishes its data products, never their temporary TypeScript sources. */
export function copyOutputProducts(root: string, outDir: string): void;

/** Only the standard, fresh, managed app output defers the public copy. */
export function deferredPublicCopy(root: string, outDir: string, args: string[]): boolean;
/** Publish public files except the obsolete top-level shardfiles tree. */
export function copyDeferredPublic(root: string, outDir: string): void;
