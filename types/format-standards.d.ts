/** Portable standard globals used by pure format admission in both Node and browsers.
 * Keep the format project free of DOM, Node packages and renderer declarations. */
/** UTF-8 encoding result used by bounded format-size checks. */
export interface FormatTextEncoder {
  encode: (input?: string) => Uint8Array<ArrayBuffer>;
}
declare global {
  function structuredClone<T>(value: T): T;
  class TextEncoder implements FormatTextEncoder {
    encode(input?: string): Uint8Array<ArrayBuffer>;
  }
}
