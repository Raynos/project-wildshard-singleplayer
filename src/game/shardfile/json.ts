/** Refuse values JSON would silently discard or change, without invoking authored accessors. */
export function isJsonData(value: unknown): boolean {
  const active = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 100000 || depth > 64) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return true;
    if (typeof item === 'number') return Number.isFinite(item) && !Object.is(item, -0);
    if (typeof item !== 'object' || active.has(item) || Object.getOwnPropertySymbols(item).length > 0) return false;
    const array = Array.isArray(item);
    if (array && item.length > 100000) return false;
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (array && Array.from({ length: item.length }, (_v, i) => descriptors[String(i)]).some((entry) => entry === undefined)) return false;
    active.add(item);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === 'length') continue;
      if (array && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= item.length)) { active.delete(item); return false; }
      if (!descriptor.enumerable || descriptor.get !== undefined || descriptor.set !== undefined || !visit(descriptor.value, depth + 1)) { active.delete(item); return false; }
    }
    active.delete(item); return true;
  };
  return visit(value, 0);
}
