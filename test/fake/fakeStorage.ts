/** The browser Storage contract, including string coercion and insertion-order key enumeration. */
export class FakeStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: unknown): string | null { return this.data.get(String(key)) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index >>> 0] ?? null; }
  removeItem(key: unknown): void { this.data.delete(String(key)); }
  setItem(key: unknown, value: unknown): void { this.data.set(String(key), String(value)); }
}
