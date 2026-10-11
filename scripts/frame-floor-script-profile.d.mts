/** The driving Inspector's protocol/event operations; no extra connection is opened. */
export interface ScriptProfilePort {
  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown>;
  on(method: string, receive: (profile: unknown) => void): () => void;
}
/** Sample only the caller-delimited window, then release the protocol listener on every completion/failure path. */
export function startScriptProfile(inspector: ScriptProfilePort, waitMs?: number): Promise<() => Promise<unknown>>;
