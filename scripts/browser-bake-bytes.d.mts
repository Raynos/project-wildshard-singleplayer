export interface ByteRoute {
  readonly request: () => { readonly method: () => string; readonly url: () => string; readonly postDataBuffer: () => Uint8Array | null };
  readonly fulfill: (response: { status: number; headers: Record<string, string>; body?: string }) => Promise<void>;
}
export interface ByteSinkPage {
  readonly route: (pattern: string, handler: (route: ByteRoute) => Promise<void>) => Promise<void>;
  readonly unroute: (pattern: string, handler: (route: ByteRoute) => Promise<void>) => Promise<void>;
}
/** One bounded, owned byte handoff from a native authoring page. */
export function browserBakeBytes(page: ByteSinkPage, options?: { maxBytes?: number; maxFiles?: number }): Promise<{
  readonly url: string;
  readonly take: (id: string) => Uint8Array;
  readonly dispose: () => Promise<void>;
}>;
