import type { NamedBlobKind } from '../src/sdk/blobs';

/** Register exact bytes as cached author-project inputs; directory is assets or a bounded subdirectory. */
export function namedBlobOutput(project: URL, label: string, directory?: string): {
  readonly add: (name: string, kind: NamedBlobKind, bytes: Uint8Array, url?: string) => string;
  readonly finish: (metadata: URL) => void;
};
