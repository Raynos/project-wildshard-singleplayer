/** Stable admission contract; the native guest bank owns the compiled bytes. */
export const RETURN_WASM_OPTIONS: { critical: boolean; script: { abi: 1; pages: number } } = {
  critical: true, script: { abi: 1, pages: 1 },
};
