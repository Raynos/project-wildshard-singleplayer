/**
 * Keeps three's float uniform caches unboxed (D180, the idle page's heap churn). Each uniform remembers the last value it
 * uploaded in a plain `cache` array, all made by one array literal in three; V8 shares one elements kind across that
 * literal's arrays, so once any cache held a non-number (a boolean uniform, a texture unit) every new cache started
 * generic, and each changed matrix or vector element stored afterwards boxed a fresh number: three's setters were the
 * largest per-frame allocators on an idle Template (~0.2 MiB/s, Chromium, `f542b13d37`). A float uniform's cache is
 * swapped, on its program's first `getUniforms`, for an empty array of double elements made by a builtin copy (no
 * allocation-site feedback). Three's reads and writes of it are unchanged: the same values, compares and uploads.
 */
/** FLOAT, FLOAT_VEC2/3/4, FLOAT_MAT2/3/4: the setters that store doubles in their cache */
const FLOAT_TYPES = new Set([0x1406, 0x8b50, 0x8b51, 0x8b52, 0x8b5a, 0x8b5b, 0x8b5c]);
const SEED = [0.5];
/** an empty array of double elements; `slice` copies the seed's kind and records no allocation site */
function doubleArray(): number[] { const array = SEED.slice(); array.length = 0; return array; }

/** swap each float leaf's cache under a program's uniform tree (structured uniforms nest in `seq`) */
function rekind(node: unknown): void {
  if (typeof node !== 'object' || node === null) return;
  const seq: unknown = Reflect.get(node, 'seq');
  if (Array.isArray(seq)) { for (const child of seq as readonly unknown[]) rekind(child); return; }
  const cache: unknown = Reflect.get(node, 'cache'), type: unknown = Reflect.get(node, 'type');
  if (!Array.isArray(cache) || typeof type !== 'number' || !FLOAT_TYPES.has(type)) return;
  const fresh = doubleArray();
  for (const value of cache as readonly unknown[]) { if (typeof value !== 'number') return; fresh.push(value); }
  Reflect.set(node, 'cache', fresh);
}

/** wrap one new program's `getUniforms`: its first call (three's own first use) builds the tree, then swaps the caches and
 *  puts the original method back, so later draws call three's method directly */
function watch(program: unknown): void {
  if (typeof program !== 'object' || program === null) return;
  const own: unknown = Reflect.get(program, 'getUniforms');
  if (typeof own !== 'function') return;
  Reflect.set(program, 'getUniforms', function getUniforms(this: unknown): unknown {
    const uniforms: unknown = Reflect.apply(own, this, []);
    Reflect.set(program, 'getUniforms', own);
    rekind(uniforms);
    return uniforms;
  });
}

/** Watch every program the renderer acquires from now on (its program list's `push`, once per new program). */
export function installUniformCacheKinds(renderer: { readonly info: { readonly programs: readonly unknown[] | null } }): void {
  const programs: unknown = renderer.info.programs;
  if (!Array.isArray(programs)) return;
  const list: unknown[] = programs, push = list.push.bind(list);
  for (const program of list) watch(program);
  // an own, non-enumerable push: the list still reads and spreads as three's plain array
  Object.defineProperty(list, 'push', { configurable: true, writable: true, enumerable: false,
    value: (...items: unknown[]): number => { for (const item of items) watch(item); return push(...items); } });
}
