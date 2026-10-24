/** The driving Inspector's protocol/event operations; no extra connection is opened. */
export interface ScriptProfilePort {
  readonly send: (method: string, params?: Readonly<Record<string, unknown>>) => Promise<unknown>;
  readonly on: (method: string, receive: (profile: unknown) => void) => () => void;
}
/** Sample only the caller-delimited window, then release the protocol listener on every completion/failure path. */
export function startScriptProfile(inspector: ScriptProfilePort, waitMs?: number): Promise<() => Promise<unknown>>;
/** Opening 20-second window; explicit early cleanup stops once and reports its actual shorter page range. */
export function startPrefixScriptProfile(inspector: ScriptProfilePort, evaluate: (expression: string) => Promise<unknown>, persist?: (capture: { readonly profile: unknown; readonly pageRange: { readonly startMs: number; readonly endMs: number } }) => void): Promise<() => Promise<{ readonly profile: unknown; readonly pageRange: { readonly startMs: number; readonly endMs: number } }>>;
/** Clock-bounded 20-second steady window, refusing replaced or paused controls. */
export const STEADY_SCRIPT_WINDOW: string;
