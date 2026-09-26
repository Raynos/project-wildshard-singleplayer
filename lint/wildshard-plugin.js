// Wildshard's own oxlint rules (loaded by `jsPlugins` in .oxlintrc.json; oxlint's ESLint-compatible JS plugin API).
//
// wildshard/no-url-switch — Jake, 2026-09-25: "NO URL SWITCHES EVER, ALL VARIANTS IN THE DEBUG MENUS".
// He plays the game as an iOS home-screen PWA: there is no address bar, so a `?foo=` switch is a switch he can never
// flip. A variant, look, tuning or feature toggle goes in pause ▸ Settings ▸ Debug. The only query params the game may
// read are the fixed allowlist in lint/url-params.json (`harness`: what the test / capture / bench scripts pass;
// `legacy`: the old switches, all moved or deleted by E162 — never add to it).
//
// What it flags, in src/ (see .oxlintrc.json for the file scope):
//   · `.get(k)` / `.has(k)` / `.getAll(k)` on a URLSearchParams — `new URLSearchParams(…)`, `x.searchParams`, a name
//     bound to either in the file, a name typed `URLSearchParams`, and `params` — when `k` is not on the allowlist;
//   · a key the rule cannot read as a string: resolved through in-file string consts, `export const X = '…'` in a
//     relatively imported module, a parameter typed as a string-literal union, or every call of the helper whose
//     parameter it is (`num('scale', 1)`) — anything else is an error;
//   · raw parsing of `location.search` (`.includes`, `.match`, regex `.test`, …) that dodges the above.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ALLOWLIST_FILE = new URL('url-params.json', import.meta.url);
const allowlist = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
const ALLOWED = new Set([...allowlist.harness, ...allowlist.legacy]);
/** reader helpers whose argument is a param name (e.g. `readParam('name')`): name → argument index. Their calls are checked in every file. */
const READERS = new Map(Object.entries(allowlist.readers ?? {}));

const FIX =
  'A variant, look, tuning or feature toggle goes in pause ▸ Settings ▸ Debug (src/ui/Settings.ts OPTION_VALUES + one row in the registry src/ui/debugOptions.ts, under its group), ' +
  'never in the query string: Jake plays the iOS home-screen PWA and has no address bar. Harness params are a fixed allowlist in ' +
  'lint/url-params.json; adding one needs Jake\'s explicit OK. See AGENTS.md "No URL switches".';
const MSG_NAME = (name) => `No URL switches, ever (Jake, 2026-09-25): \`?${name}\` is not an allowed query param. ${FIX}`;
const MSG_DYNAMIC = `No URL switches, ever (Jake, 2026-09-25): this query-param key is not a string literal, so it cannot be checked against the allowlist. Read each param by its literal name. ${FIX}`;
const MSG_RAW = (what) => `No URL switches, ever (Jake, 2026-09-25): raw \`location.search\` parsing (${what}) dodges the allowlist. Use URLSearchParams with a literal, allowlisted name. ${FIX}`;

const READS = new Set(['get', 'has', 'getAll']);
const STRING_METHODS = new Set(['includes', 'indexOf', 'lastIndexOf', 'match', 'matchAll', 'search', 'split', 'startsWith', 'endsWith', 'slice', 'substring', 'substr', 'replace', 'replaceAll', 'at', 'charAt']);
const DEFAULT_BOUND = ['params', 'searchParams'];

const unwrap = (n) => {
  let x = n;
  while (x && (x.type === 'ChainExpression' || x.type === 'TSNonNullExpression' || x.type === 'TSAsExpression' || x.type === 'TSSatisfiesExpression' || x.type === 'ParenthesizedExpression')) x = x.expression;
  return x;
};
const propName = (m) => (m.type === 'MemberExpression' && !m.computed && m.property.type === 'Identifier' ? m.property.name : null);
const isLocation = (n) => {
  const x = unwrap(n);
  if (!x) return false;
  if (x.type === 'Identifier') return x.name === 'location';
  const p = propName(x);
  return p === 'location';
};
const isLocationSearch = (n) => {
  const x = unwrap(n);
  return Boolean(x) && x.type === 'MemberExpression' && propName(x) === 'search' && isLocation(x.object);
};
const stringOf = (n) => {
  const x = unwrap(n);
  if (!x) return null;
  if (x.type === 'Literal' && typeof x.value === 'string') return x.value;
  if (x.type === 'TemplateLiteral' && x.expressions.length === 0) return x.quasis[0]?.value.cooked ?? null;
  return null;
};
/** does this type annotation mention URLSearchParams (`URLSearchParams`, `URLSearchParams | undefined`, …)? */
const mentionsUSP = (t) => {
  if (!t || typeof t !== 'object') return false;
  if (t.type === 'TSTypeAnnotation') return mentionsUSP(t.typeAnnotation);
  if (t.type === 'TSTypeReference') return t.typeName.type === 'Identifier' && t.typeName.name === 'URLSearchParams';
  if (t.type === 'TSUnionType' || t.type === 'TSIntersectionType') return t.types.some(mentionsUSP);
  return false;
};
/** the names in a string-literal union annotation (`key: 'grade' | 'ground'`), or null */
const literalUnion = (t) => {
  let x = t;
  if (x?.type === 'TSTypeAnnotation') x = x.typeAnnotation;
  if (!x) return null;
  const parts = x.type === 'TSUnionType' ? x.types : [x];
  const out = [];
  for (const p of parts) {
    if (p.type === 'TSLiteralType' && p.literal.type === 'Literal' && typeof p.literal.value === 'string') out.push(p.literal.value);
    else return null;
  }
  return out;
};
const paramId = (p) => {
  let x = p;
  if (x.type === 'TSParameterProperty') x = x.parameter;
  if (x.type === 'AssignmentPattern') x = x.left;
  return x.type === 'Identifier' ? x : null;
};
const fnName = (fn) => {
  if (fn.id?.type === 'Identifier') return fn.id.name;
  const p = fn.parent;
  if (!p) return null;
  if (p.type === 'VariableDeclarator' && p.id.type === 'Identifier') return p.id.name;
  if ((p.type === 'MethodDefinition' || p.type === 'PropertyDefinition' || p.type === 'Property') && p.key.type === 'Identifier') return p.key.name;
  if (p.type === 'AssignmentExpression') return p.left.type === 'Identifier' ? p.left.name : propName(p.left);
  return null;
};
const calleeName = (c) => {
  const x = unwrap(c);
  if (!x) return null;
  return x.type === 'Identifier' ? x.name : propName(x);
};
/** `export const NAME = '…'` in a relatively imported module (resolved .ts / .js / index) */
const importedConst = (fromFile, source, name) => {
  if (!source.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), source);
  const tries = [base, `${base}.ts`, `${base}.js`, base.replace(/\.js$/u, '.ts'), `${base}/index.ts`];
  for (const f of tries) {
    if (!existsSync(f) || !/\.(ts|js|mjs)$/u.test(f)) continue;
    const m = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]+)['"\`]`, 'u').exec(readFileSync(f, 'utf8'));
    return m === null ? null : m[1];
  }
  return null;
};
/** the param names a regex / string pattern names: `[?&]sw=0` → sw */
const namesInPattern = (s) => [...s.matchAll(/\[\?&\]\(?([A-Za-z_][\w]*)/gu)].map((m) => m[1] ?? '').filter(Boolean);

const noUrlSwitch = {
  meta: {
    type: 'problem',
    docs: { description: 'No URL switches: a query param the game reads must be on the fixed allowlist in lint/url-params.json (Jake, 2026-09-25)' },
    schema: [],
  },
  create(context) {
    const filename = context.filename;
    const bound = new Set(DEFAULT_BOUND); // names (identifiers and property names) that hold a URLSearchParams
    const declarators = []; // [name, init] to settle in a fixpoint once the file is read
    const consts = new Map(); // in-file `const X = 'literal'`
    const imports = new Map(); // local name → [source, imported name]
    const reads = []; // { key node }
    const calls = []; // every call, for helper resolution: { name, args }
    const raws = []; // [node, what]
    const readerCalls = []; // calls of a READERS helper, checked like a read

    const isQuery = (n) => {
      const x = unwrap(n);
      if (!x) return false;
      if (x.type === 'NewExpression') return x.callee.type === 'Identifier' && x.callee.name === 'URLSearchParams';
      if (x.type === 'Identifier') return bound.has(x.name);
      if (x.type === 'MemberExpression') { const p = propName(x); return p !== null && bound.has(p); }
      if (x.type === 'ConditionalExpression') return [x.consequent, x.alternate].some(isQuery);
      if (x.type === 'LogicalExpression') return [x.left, x.right].some(isQuery);
      return false;
    };

    /** names for a key node: string[] on success, null when it cannot be read */
    const resolveKey = (key, depth) => {
      const s = stringOf(key);
      if (s !== null) return [s];
      const x = unwrap(key);
      if (!x || depth > 3) return null;
      if (x.type === 'ConditionalExpression') {
        const a = resolveKey(x.consequent, depth + 1);
        const b = resolveKey(x.alternate, depth + 1);
        return a && b ? [...a, ...b] : null;
      }
      if (x.type !== 'Identifier') return null;
      if (consts.has(x.name)) return [consts.get(x.name)];
      const imp = imports.get(x.name);
      if (imp) { const v = importedConst(filename, imp[0], imp[1]); return v === null ? null : [v]; }
      // a parameter of an enclosing function: its literal-union type, or every call of that helper in this file
      for (let fn = x.parent; fn; fn = fn.parent) {
        if (fn.type !== 'FunctionDeclaration' && fn.type !== 'FunctionExpression' && fn.type !== 'ArrowFunctionExpression') continue;
        const index = fn.params.findIndex((p) => paramId(p)?.name === x.name);
        if (index === -1) continue;
        const id = paramId(fn.params[index]);
        const lit = id ? literalUnion(id.typeAnnotation) : null;
        if (lit) return lit;
        const name = fnName(fn);
        if (!name) return null;
        if (READERS.get(name) === index) return []; // an allowlisted reader: its calls are checked where they are made
        const uses = calls.filter((c) => c.name === name && c.args.length > index);
        if (uses.length === 0) return null;
        const out = [];
        for (const u of uses) { const r = resolveKey(u.args[index], depth + 1); if (!r) return null; out.push(...r); }
        return out;
      }
      return null;
    };

    return {
      ImportDeclaration(node) {
        for (const s of node.specifiers) if (s.type === 'ImportSpecifier' && s.imported.type === 'Identifier') imports.set(s.local.name, [node.source.value, s.imported.name]);
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return;
        if (mentionsUSP(node.id.typeAnnotation)) bound.add(node.id.name);
        const s = node.init ? stringOf(node.init) : null;
        if (s !== null && node.parent?.kind === 'const') consts.set(node.id.name, s);
        if (node.init) declarators.push([node.id.name, node.init]);
      },
      AssignmentExpression(node) {
        const name = node.left.type === 'Identifier' ? node.left.name : propName(node.left);
        if (name) declarators.push([name, node.right]);
      },
      Identifier(node) {
        if (node.typeAnnotation && mentionsUSP(node.typeAnnotation)) bound.add(node.name);
      },
      TSPropertySignature(node) {
        if (node.key.type === 'Identifier' && mentionsUSP(node.typeAnnotation)) bound.add(node.key.name);
      },
      PropertyDefinition(node) {
        if (node.key.type !== 'Identifier') return;
        if (mentionsUSP(node.typeAnnotation)) bound.add(node.key.name);
        if (node.value) declarators.push([node.key.name, node.value]);
      },
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (name) calls.push({ name, args: node.arguments });
        if (name && READERS.has(name)) readerCalls.push({ key: node.arguments[READERS.get(name)] ?? null, node });
        const callee = unwrap(node.callee);
        if (callee?.type === 'MemberExpression') {
          const m = propName(callee);
          if (m && READS.has(m)) reads.push({ callee, key: node.arguments[0] ?? null, node });
          // `location.search.includes('x=')`, `.match(…)`, `.split('&')` …
          if (m && STRING_METHODS.has(m) && isLocationSearch(callee.object)) raws.push([node, `location.search.${m}()`]);
          // `/[?&]x=/.test(location.search)` / `.exec(location.search)`
          if ((m === 'test' || m === 'exec') && node.arguments.some(isLocationSearch)) {
            const re = unwrap(callee.object);
            const pat = re?.type === 'Literal' && re.regex ? re.regex.pattern : null;
            const names = pat ? namesInPattern(pat) : [];
            if (names.length === 0 || names.some((n) => !ALLOWED.has(n))) raws.push([node, `a regex ${m}() on location.search`]);
          }
        }
      },
      'Program:exit'() {
        // settle `const qs = new URLSearchParams(…)`, `const u = new URL(…); u.searchParams`, `const q2 = qs` …
        for (let changed = true; changed; ) {
          changed = false;
          for (const [name, init] of declarators) if (!bound.has(name) && isQuery(init)) { bound.add(name); changed = true; }
        }
        for (const r of [...reads.filter((x) => isQuery(x.callee.object)), ...readerCalls]) {
          if (!r.key) { context.report({ node: r.node, message: MSG_DYNAMIC }); continue; }
          const names = resolveKey(r.key, 0);
          if (!names) { context.report({ node: r.key, message: MSG_DYNAMIC }); continue; }
          const bad = names.filter((n) => !ALLOWED.has(n));
          if (bad.length > 0) context.report({ node: r.key, message: MSG_NAME(bad.join('`, `?')) });
        }
        for (const [node, what] of raws) context.report({ node, message: MSG_RAW(what) });
      },
    };
  },
};

const plugin = {
  meta: { name: 'wildshard' },
  rules: { 'no-url-switch': noUrlSwitch },
};
export default plugin; // oxlint loads a JS plugin from its default export
