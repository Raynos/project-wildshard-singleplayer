/** Loader-owned provenance, never an authored field copied into model dimensions. */
const identities = new WeakMap<object, () => string>();
/** Called only by the packed loader after it emits this exact model instance. */
export function bindPackedPayloadIdentity(dimensions: object, identity: () => string): void {
  identities.set(dimensions, identity);
}
/** Exact compressed loader-input SHA-256, not canonical model JSON identity. */
export function packedPayloadIdentity(dimensions: object): string | undefined {
  return identities.get(dimensions)?.();
}
