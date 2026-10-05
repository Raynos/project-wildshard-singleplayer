/** JS-only ABI-v0 AssemblyScript compiler and Binaryen metering transform. */
import binaryen from 'binaryen';

/** @typedef {{main:(args:string[],options:{readFile:(name:string)=>string|null,writeFile:(name:string,contents:string|Uint8Array)=>void})=>Promise<{error:Error|null}>}} Compiler */
/** @param {unknown} value @returns {value is Compiler} */
function isCompiler(value) { return typeof value === 'object' && value !== null && 'main' in value && typeof value.main === 'function'; }

const FEATURES = binaryen.Features.MutableGlobals | binaryen.Features.SignExt | binaryen.Features.NontrappingFPToInt | binaryen.Features.BulkMemory;
/** Tokenise Binaryen's own WAT output, keeping quoted data opaque. */
function tokens(text) { return text.match(/"(?:\\.|[^"\\])*"|[()]|[^\s()]+/g) ?? []; }
/** @param {string[]} words @param {{pos:number}} cursor @returns {(string|Array<unknown>)[]} */
function tree(words, cursor) {
  if (words[cursor.pos++] !== '(') throw new Error('Invalid Binaryen text');
  const result = [];
  while (words[cursor.pos] !== ')') {
    if (cursor.pos >= words.length) throw new Error('Truncated Binaryen text');
    if (words[cursor.pos] === '(') result.push(tree(words, cursor));
    else result.push(words[cursor.pos++]);
  }
  cursor.pos++; return result;
}
/** @param {unknown} value @returns {string} */
function wat(value) { return Array.isArray(value) ? `(${value.map(wat).join(' ')})` : String(value); }
/** @param {unknown} node @returns {unknown} */
function finite(node) {
  if (!Array.isArray(node)) return node;
  const rewritten = node.map(finite), op = rewritten[0];
  if (typeof op === 'string' && /^f(?:32|64)\./.test(op) && !/^f(?:32|64)\.(?:store|eq|ne|lt|gt|le|ge)$/.test(op)) return ['call', op.startsWith('f32.') ? '$__finite32' : '$__finite64', rewritten];
  return rewritten;
}
/** @param {unknown} node @param {number} cost */
function loops(node, cost) {
  if (!Array.isArray(node)) return;
  for (const child of node) loops(child, cost);
  if (node[0] === 'loop') {
    let at = typeof node[1] === 'string' ? 2 : 1;
    if (Array.isArray(node[at]) && node[at][0] === 'result') at++;
    node.splice(at, 0, ['call', '$__meter_fuel', ['i32.const', String(cost)]]);
  }
}
/** No optimization is run after instrumentation: admission verifies these exact structural guards. */
export function instrumentScript(bytes) {
  const module = binaryen.readBinary(bytes);
  try {
    module.setFeatures(FEATURES);
    if (!module.validate()) throw new Error('Unsupported Wasm features');
    const form = tree(tokens(module.emitText()), { pos: 0 });
    const originals = form.filter((n) => Array.isArray(n) && n[0] === 'func');
    const wrappers = [];
    for (let index = 0; index < originals.length; index++) {
      const fn = originals[index];
      if (!Array.isArray(fn) || typeof fn[1] !== 'string') throw new Error('Unnamed function');
      const name = fn[1], impl = `$__impl_${index}`;
      const cost = bytes.length * 4 + 128 * originals.length + 1024;
      for (let i = 2; i < fn.length; i++) fn[i] = finite(fn[i]);
      loops(fn, cost);
      const params = fn.filter((n) => Array.isArray(n) && n[0] === 'param');
      const results = fn.filter((n) => Array.isArray(n) && n[0] === 'result');
      let at = 2;
      while (Array.isArray(fn[at]) && ['param', 'result', 'local', 'type'].includes(fn[at][0])) at++;
      fn.splice(at, 0, ['call', '$__meter_fuel', ['i32.const', String(cost)]]);
      fn[1] = impl;
      const wrapper = ['func', name, ...params, ...results];
      const types = params.flatMap((p) => Array.isArray(p) ? p.slice(1).filter((n) => typeof n === 'string' && !n.startsWith('$')) : []);
      const args = types.map((_, i) => ['local.get', String(i)]);
      const call = ['call', impl, ...args];
      if (results.length > 0) {
        const result = results[0]; if (!Array.isArray(result)) throw new Error('Invalid result');
        wrapper.push(['local', result[1]]);
        wrapper.push(['call', '$__meter_enter'], ['local.set', String(types.length), call], ['call', '$__meter_leave'], ['local.get', String(types.length)]);
      } else wrapper.push(['call', '$__meter_enter'], call, ['call', '$__meter_leave']);
      wrappers.push(wrapper);
    }
    form.splice(1, 0,
      ['import', '"env"', '"enter"', ['func', '$__meter_enter']],
      ['import', '"env"', '"leave"', ['func', '$__meter_leave']],
      ['import', '"env"', '"fuel"', ['func', '$__meter_fuel', ['param', 'i32']]],
      ['import', '"env"', '"finite32"', ['func', '$__finite32', ['param', 'f32'], ['result', 'f32']]],
      ['import', '"env"', '"finite64"', ['func', '$__finite64', ['param', 'f64'], ['result', 'f64']]],
    );
    for (let i = 0; i < module.getNumGlobals(); i++) {
      const global = binaryen.getGlobalInfo(module.getGlobalByIndex(i));
      if (global.mutable) form.push(['export', `"__state_${i}"`, ['global', `$${global.name}`]]);
    }
    form.push(...wrappers);
    const metered = binaryen.parseText(wat(form));
    try { metered.setFeatures(FEATURES); if (!metered.validate()) throw new Error('Invalid instrumented module'); return metered.emitBinary(); }
    finally { metered.dispose(); }
  } finally { module.dispose(); }
}
/** Build source in-memory; no native compiler or Rust toolchain. ABI/compiler versions are pinned in package.json.
 * @param {string} source @param {{maximumPages?:number,sources?:Readonly<Record<string,string>>}} [options] */
export async function compileScript(source, options = {}) {
  const maximumPages = options.maximumPages ?? 64;
  if (!Number.isSafeInteger(maximumPages) || maximumPages < 1 || maximumPages > 64) throw new Error('Script maximumPages must be 1..64');
  const sources = new Map(Object.entries(options.sources ?? {}));
  if (sources.size > 64 || [...sources].some(([name, text]) => name === 'main.ts' || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u.test(name) || typeof text !== 'string')) throw new Error('Invalid virtual AssemblyScript sources');
  // asc's declaration bundle globally changes Array.at to return T, unsound in host JS.
  // Keep its portable ambient declarations inside the author compiler, not the host type program.
  const compilerSpecifier = ['assemblyscript', 'asc'].join('/');
  /** @type {unknown} */
  const compiler = await import(compilerSpecifier);
  if (!isCompiler(compiler)) throw new Error('Invalid pinned AssemblyScript compiler');
  let bytes = new Uint8Array();
  const result = await compiler.main(['main.ts', '--outFile', 'main.wasm', '--runtime', 'stub', '--importMemory', '--initialMemory', '1', '--maximumMemory', String(maximumPages), '--exportStart', '__start', '--disable', 'bulk-memory', '-O3'], {
    readFile: (name) => name === 'main.ts' ? source : sources.get(name) ?? null,
    writeFile: (name, contents) => { if (name === 'main.wasm' && contents instanceof Uint8Array) bytes = contents; },
  });
  if (result.error || bytes.length === 0) throw new Error(`AssemblyScript compile failed: ${result.error?.message ?? 'no output'}`);
  return instrumentScript(bytes);
}
