export function decodedBodyCounter(encoding?: string): { write: (chunk: Uint8Array) => void; finish: () => Promise<number | null> };
export function observeTransport(upstream: string | (() => string), fixture?: { readonly start?: string; readonly prelude?: string; readonly recorder?: () => void; readonly offline?: () => boolean; readonly bodyHashes?: boolean }): Promise<{
  base: string; receipts: { url: string; status: number; startedAt: number; endedAt: number; bodyBytes: number; decodedBodyBytes: number | null; headerBytes: number; bodySHA256?: string; bodyEncoding?: string }[];
  htmlFixtures: { originalSHA256: string; injectedSHA256: string }[]; close: () => Promise<void>;
}>;
