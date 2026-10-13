/** Copy only staged-hash-pinned JSON build outputs into an immutable guard tree. */
export function materializeGuardData(root: string, snapshot: string, blobDirectory?: string): void;

/** Publish only completely verified inert staged JSON before dependent producers. */
export function publishGuardData(snapshot: string, blobDirectory: string): void;
