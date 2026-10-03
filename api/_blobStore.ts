// The blob store the API functions read and write (E422): Vercel Blob in production, any store with the same four
// calls in a test, installed with useBlobStore, so no test mocks the SDK's module. The leading underscore keeps
// Vercel from deploying this file as a function.
import { del, get, list, put } from '@vercel/blob';

/** one stored blob, as a listing returns it */
export interface BlobEntry { readonly pathname: string; readonly uploadedAt: Date; readonly size: number }
/** a page of a listing */
export interface BlobPage { readonly blobs: BlobEntry[]; readonly hasMore: boolean; readonly cursor?: string | undefined }
/** what the functions use of a blob store: private JSON / JPEG files under a prefix */
export interface BlobStore {
  readonly put: (path: string, body: Parameters<typeof put>[1], opts: { access: 'private'; addRandomSuffix: boolean; contentType: string }) => Promise<unknown>;
  readonly get: (path: string, opts: { access: 'private'; useCache: boolean }) => Promise<{ readonly stream: ReadableStream<Uint8Array> | null } | null>;
  readonly list: (opts: { prefix: string; limit: number; cursor?: string }) => Promise<BlobPage>;
  readonly del: (paths: string[]) => Promise<void>;
}
const VERCEL: BlobStore = {
  put: (path, body, opts) => put(path, body, opts),
  get: (path, opts) => get(path, opts),
  list: (opts) => list(opts),
  del: (paths) => del(paths),
};
let store: BlobStore = VERCEL;
/** the store the functions use */
export function blobStore(): BlobStore { return store; }
/** install a store (a test's); returns the restore */
export function useBlobStore(next: BlobStore): () => void { const before = store; store = next; return () => { store = before; }; }
