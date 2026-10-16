import type { NamedBlobKind } from '../src/sdk/blobs';

/** Register a producer's exact bytes as cached author-project inputs. */
export function namedBlobOutput(project: URL, label: string): {
  readonly add: (name: string, kind: NamedBlobKind, bytes: Uint8Array, url?: string) => string;
  readonly finish: (metadata: URL) => void;
};
