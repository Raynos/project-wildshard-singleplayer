/** Exact graph signatures can span hundreds of KB. Intern only their program-key
 * spelling; shader reuse still validates the complete signature separately. */
interface Shape { readonly signature: string }
interface HeldKey { readonly signature: string; readonly key: string }
let namespace = 0;

/** Bounded, collision-free names within one node-handler lifetime. Once full,
 * new signatures retain exact text keys; existing names and sharing stay stable. */
export class GraphCodeKeys {
  private readonly scope = ++namespace;
  private readonly names = new Map<string, string>();
  private readonly held = new WeakMap<Shape, HeldKey>();
  private chars = 0;
  private serial = 0;
  private readonly maxChars: number;
  private readonly maxEntries: number;
  constructor(maxChars: number = 8 * 1024 * 1024, maxEntries = 256) {
    this.maxChars = maxChars; this.maxEntries = maxEntries;
    if (!Number.isSafeInteger(this.scope) || !Number.isSafeInteger(maxChars) || maxChars < 1
      || !Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new RangeError('Invalid graph-key capacity');
  }
  key(shape: Shape): string {
    const signature = shape.signature, held = this.held.get(shape);
    if (held?.signature === signature) return held.key;
    let key = this.names.get(signature);
    if (key === undefined) {
      // Saturation keeps exact text keys for new signatures without evicting
      // earlier names or retaining a graph outside its weak identity entry.
      if (this.names.size >= this.maxEntries || this.chars + signature.length > this.maxChars
        || this.serial === Number.MAX_SAFE_INTEGER)
        key = `${this.scope}:text:${signature}`;
      else {
        key = `${this.scope}:shape:${++this.serial};`;
        this.names.set(signature, key); this.chars += signature.length;
      }
    }
    this.held.set(shape, {signature, key});
    return key;
  }
}
