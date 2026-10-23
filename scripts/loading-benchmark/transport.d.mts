export function decodedBodyCounter(encoding?: string): { write: (chunk: Uint8Array) => void; finish: () => Promise<number | null> };
export function observeTransport(upstream: string, fixture?: { readonly start?: string; readonly prelude?: string; readonly recorder?: () => void; readonly offline?: () => boolean }): Promise<{
  base: string; receipts: { url: string; status: number; endedAt: number; bodyBytes: number; decodedBodyBytes: number | null; headerBytes: number }[];
  htmlFixtures: { originalSHA256: string; injectedSHA256: string }[]; close: () => Promise<void>;
}>;
