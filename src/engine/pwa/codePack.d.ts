export function codePackEntries(wire: ArrayBuffer, expected: readonly [number, number, string], allowed: ReadonlySet<string>): Promise<readonly (readonly [string, Uint8Array<ArrayBuffer>])[]>;
export function readCodePackTransport(response: Response, expected: number): Promise<ArrayBuffer>;
