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
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const IMPORTS = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).imports;
/** Node's package imports: exact keys first, then the longest matching single-star pattern. */
const aliasTarget = (source) => {
  if (typeof IMPORTS[source] === 'string') return IMPORTS[source];
  const patterns = Object.keys(IMPORTS).filter((key) => key.includes('*')).sort((a, b) => {
    const prefix = b.indexOf('*') - a.indexOf('*');
    return prefix || b.length - a.length;
  });
  for (const key of patterns) {
    const [prefix, suffix] = key.split('*');
    if (!source.startsWith(prefix) || !source.endsWith(suffix) || source.length < prefix.length + suffix.length) continue;
    const target = IMPORTS[key];
    if (typeof target === 'string') return target.replace('*', source.slice(prefix.length, source.length - suffix.length));
  }
  return null;
};

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
/** `export const NAME = '…'` in a relative or package-aliased module (resolved .ts / .js / index). */
export const importedConst = (fromFile, source, name) => {
  const target = source.startsWith('#') ? aliasTarget(source) : null;
  if (target === null && !source.startsWith('.')) return null;
  const base = target === null ? resolve(dirname(fromFile), source) : resolve(REPO, target);
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

// E357 F4: syntactic ratchets; their scope and patterns are 01 §24 / 02 F4's contract.
const pathOf = (context) => {
  const path = relative(REPO, context.filename).replaceAll('\\', '/');
  // Fixture repositories deliberately retain the same src/ layout.
  const index = path.lastIndexOf('/src/');
  return index === -1 ? path : path.slice(index + 1);
};
const modulePath = (filename, source) => {
  const target = source.startsWith('#') ? aliasTarget(source) : null;
  if (target !== null) return target.replace(/^\.\//u, '');
  if (!source.startsWith('.')) return source;
  return relative(REPO, resolve(dirname(filename), source)).replaceAll('\\', '/').replace(/^.*\/src\//u, 'src/');
};
const layerOf = (path) => {
  const match = /^src\/(engine|game|kit|shards)\/([^/]+)?/u.exec(path);
  if (!match) return null;
  return { name: match[1], rank: ['engine', 'game', 'kit', 'shards'].indexOf(match[1]), slug: match[1] === 'shards' ? match[2] : null };
};
const engineWords = JSON.parse(readFileSync(new URL('engine-words.json', import.meta.url), 'utf8'));
const WORDS = new RegExp(`\\b(?:${engineWords.join('|')})\\b`, 'giu');
const rule = (description, create) => ({ meta: { type: 'problem', docs: { description }, schema: [] }, create });
const report = (context, node, message) => { context.report({ node, message }); };
const importsVisitor = (fn) => ({
  ImportDeclaration: fn,
  ExportNamedDeclaration(node) { if (node.source) fn(node); },
  ExportAllDeclaration: fn,
  ImportExpression: fn,
});

const layer = rule('Layer direction, public APIs and engine vocabulary (E357)', (context) => {
  const own = layerOf(pathOf(context));
  if (!own) return {};
  const words = (node, text) => {
    for (const match of text.matchAll(WORDS)) {
      const path = pathOf(context);
      // F10's save protocol names a shard scope; its one-time reset table necessarily names historical keys.
      if (match[0].toLowerCase() === 'shard' && (path.startsWith('src/engine/saves/') || (node.type === 'Literal' && node.value === 'shard' && node.parent?.type === 'Property' && (node.parent.key?.name === 'scope' || node.parent.key?.value === 'scope')))) continue;
      if (path === 'src/engine/core/errorReport.ts' && node.type === 'Identifier' && node.name === 'shard' && node.parent?.type === 'Property' && node.parent.key === node) continue; // Required external telemetry tag; save failures use their namespace.
      if (path === 'src/engine/saves/legacy.ts' && node.type === 'Literal' && typeof node.value === 'string' && node.value.startsWith('ws.')) continue;
      report(context, node, `Engine contains Wildshard word: ${match[0]}`);
    }
  };
  return {
    ...importsVisitor((node) => {
      const source = stringOf(node.source);
      if (source === null) return;
      const target = layerOf(modulePath(context.filename, source));
      if (!target) return;
      if (target.rank > own.rank || (own.name === 'shards' && target.name === 'shards' && own.slug !== target.slug)) {
        report(context, node, `Layer import ${own.name} → ${target.name}: ${source}`);
      } else if (own.name !== target.name && /^#(?:engine|game|kit)\//u.test(source)) {
        report(context, node, `Cross-layer imports use the public index: ${source}`);
      }
    }),
    Identifier(node) { if (own.name === 'engine') words(node, node.name); },
    Literal(node) { if (own.name === 'engine' && typeof node.value === 'string') words(node, node.value); },
    TemplateElement(node) { if (own.name === 'engine') words(node, node.value.cooked ?? node.value.raw); },
    Program(node) {
      if (own.name !== 'engine') return;
      for (const comment of context.sourceCode.getAllComments()) {
        for (const match of comment.value.matchAll(WORDS)) {
          context.report({ node, loc: comment.loc, message: `Engine comment contains Wildshard word: ${match[0]}` });
        }
      }
    },
  };
});

export const SHARD_BRANCH = {
  identifiers: new Set(['isOcean', 'isNalati', 'isPine', 'isNine', 'LOOK_V2']),
  calls: new Set(['nalatiNow', 'isStylized', 'isPaintedAir', 'isPainterlyGrass']),
  comparisons: new Set(['slug', 'style']),
  members: new Set(['structures', 'weapon', 'style', 'ocean']),
  objects: new Set(['chunk', 'def', 'manifest']),
  slugs: new Set(['driftwood-isle', 'nalati-grasslands', 'pine-hollow', 'nine-dragon-stack']),
};
const nameOf = (node) => {
  const x = unwrap(node);
  return x?.type === 'Identifier' ? x.name : x?.type === 'MemberExpression' ? propName(x) : null;
};
const isReference = (node) => {
  const parent = node.parent;
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
  if (['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ExportSpecifier'].includes(parent.type)) return false;
  if ((parent.type === 'VariableDeclarator' || parent.type === 'FunctionDeclaration' || parent.type === 'ClassDeclaration') && parent.id === node) return false;
  if (['Property', 'PropertyDefinition', 'MethodDefinition', 'TSPropertySignature'].includes(parent.type) && parent.key === node && !parent.computed && !parent.shorthand) return false;
  return true;
};
const noShardBranch = rule('Shard decisions belong in plugins (E357)', (context) => {
  const path = pathOf(context);
  if (/^src\/(?:shards\/|chunks\/(?:driftwood-isle|nalati-grasslands|pine-hollow|nine-dragon-stack)(?:\/|\.ts$)|nalati\/|pinehollow\/)/u.test(path)) return {};
  const hits = new Set();
  return {
    Identifier(node) { if (SHARD_BRANCH.identifiers.has(node.name) && isReference(node)) hits.add(node); },
    CallExpression(node) { if (SHARD_BRANCH.calls.has(calleeName(node.callee))) hits.add(node); },
    ConditionalExpression(node) { if (['sea', 'painterly'].includes(nameOf(node.test))) hits.add(node); },
    LogicalExpression(node) { if (node.operator === '&&' && nameOf(node.left) === 'painterly') hits.add(node); },
    BinaryExpression(node) {
      if (!['===', '!==', '==', '!='].includes(node.operator)) return;
      if ([node.left, node.right].some((side) => SHARD_BRANCH.slugs.has(stringOf(side))) ||
          (['===', '!=='].includes(node.operator) && [node.left, node.right].some((side) => SHARD_BRANCH.comparisons.has(nameOf(side))))) hits.add(node);
    },
    SwitchCase(node) { if (node.test && SHARD_BRANCH.slugs.has(stringOf(node.test))) hits.add(node); },
    MemberExpression(node) {
      if (!SHARD_BRANCH.members.has(propName(node))) return;
      if (node.parent?.type === 'AssignmentExpression' && node.parent.left === node && node.parent.operator === '=') return;
      const object = unwrap(node.object);
      if (SHARD_BRANCH.objects.has(nameOf(object)) || (object?.type === 'CallExpression' && calleeName(object.callee) === 'getActiveChunk')) hits.add(node);
    },
    'Program:exit'() {
      for (const node of hits) {
        let ancestor = node.parent;
        while (ancestor && ['ChainExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression'].includes(ancestor.type)) ancestor = ancestor.parent;
        // Only a comparison's overlapping clauses collapse; nested decisions remain separate expressions.
        if (ancestor?.type !== 'BinaryExpression' || !hits.has(ancestor)) report(context, node, 'Shard-specific expression belongs in the shard plugin');
      }
    },
  };
});

const noRawSave = rule('Storage access belongs in saves (E357)', (context) => {
  if (/^src\/(?:engine\/(?:saves|native)|native)\//u.test(pathOf(context))) return {};
  return { Identifier(node) { if (['localStorage', 'sessionStorage'].includes(node.name)) report(context, node, 'Use the save service instead of raw storage'); } };
});
export const TIME_ALLOW = Object.fromEntries([
  'src/core/frameCost.ts', 'src/ui/perfHud.ts', 'src/ui/perfProbe.ts', 'src/ui/perfLap.ts', 'src/ui/Perf.ts',
  'src/boot/plan.ts', 'src/boot/timing.ts', 'src/boot/precompile.ts', 'src/core/lifeTrace.ts',
  'src/core/errorReport.ts', 'src/boot/nineBootTrace.ts', 'src/boot/nineGpuTrace.ts',
].map((path) => [path, 'performance.now measures elapsed cost or diagnostic timing; never gameplay state.']));
const ratchetFile = process.env.WILDSHARD_RATCHET_FILE ?? new URL('ratchet.json', import.meta.url);
const measurementAllow = existsSync(ratchetFile) ? JSON.parse(readFileSync(ratchetFile, 'utf8')).allow?.['wildshard/no-raw-random-time'] ?? TIME_ALLOW : TIME_ALLOW;
const noRawRandomTime = rule('Randomness and time use engine services (E357)', (context) => {
  const path = pathOf(context);
  if (/^src\/(?:core\/(?:rng|time)\.ts|engine\/core\/(?:rng|clock)\.ts)$/u.test(path)) return {};
  return { MemberExpression(node) {
    const object = unwrap(node.object), property = propName(node) ?? stringOf(node.property);
    if (object?.type !== 'Identifier') return;
    if (object.name === 'Math' && property === 'random') report(context, node, 'Use app.rng instead of Math.random');
    if (object.name === 'performance' && property === 'now' && !Object.hasOwn(measurementAllow, path)) report(context, node, 'Use app.clock instead of performance.now');
  } };
});
const INPUT_EVENTS = new Set('keydown keyup keypress pointerdown pointerup pointermove pointercancel mousedown mouseup mousemove wheel contextmenu touchstart touchmove touchend touchcancel'.split(' '));
const noRawInput = rule('Input listeners belong in the input service (E357)', (context) => {
  if (/^src\/(?:core|engine)\/input\//u.test(pathOf(context))) return {};
  return { CallExpression(node) { if (calleeName(node.callee) === 'addEventListener' && INPUT_EVENTS.has(stringOf(node.arguments[0]))) report(context, node, 'Use the input service instead of a raw input listener'); } };
});
const noRendererType = rule('Renderer types stay inside rendering (E357)', (context) => {
  if (/^src\/(?:engine\/render\/|(?:engine\/)?core\/(?:Game|bootstrap)\.ts$)/u.test(pathOf(context))) return {};
  return { Identifier(node) { if (node.name === 'WebGLRenderer') report(context, node, 'Renderer types belong in engine/render'); } };
});
const SIM = /^src\/engine\/(?:combat|ai|saves|quests|effects)\//u;
const VIEW = /^src\/engine\/(?:combat|ai)\/view\//u;
const VISUAL = /^src\/engine\/(?:render|ui|fx|anim)\//u;
const MATH_TYPES = new Set(['Vector3', 'Quaternion', 'Matrix4', 'Box3', 'Ray']);
const DOM_GLOBALS = new Set(['document', 'HTMLElement', 'HTMLCanvasElement', 'requestAnimationFrame']);
const simNoRender = rule('Simulation stays independent of visuals (E357)', (context) => {
  const path = pathOf(context);
  if (!SIM.test(path) || VIEW.test(path)) return {};
  return {
    ...importsVisitor((node) => {
      const source = stringOf(node.source);
      if (source === null) return;
      if (source === 'three' && (!node.specifiers?.length || node.specifiers.some((specifier) => specifier.type !== 'ImportSpecifier' || !MATH_TYPES.has(nameOf(specifier.imported))))) {
        report(context, node, 'Simulation imports only Vector3, Quaternion, Matrix4, Box3 or Ray from three');
      } else if (VISUAL.test(modulePath(context.filename, source)) || VIEW.test(modulePath(context.filename, source))) {
        report(context, node, 'Simulation cannot import a visual module');
      }
    }),
    Identifier(node) { if (isReference(node) && DOM_GLOBALS.has(node.name)) report(context, node, 'Simulation cannot read a DOM global'); },
    MemberExpression(node) {
      const object = unwrap(node.object);
      if (object?.type === 'Identifier' && ['window', 'globalThis'].includes(object.name) && DOM_GLOBALS.has(propName(node) ?? stringOf(node.property))) report(context, node, 'Simulation cannot read a DOM global');
    },
  };
});

const noHookChain = rule('Hook chains migrate to typed events (E357)', (context) => ({
  VariableDeclarator(node) {
    const value = unwrap(node.init);
    if (value?.type === 'MemberExpression' && /^on[A-Z]/u.test(propName(value) ?? stringOf(value.property) ?? '')) report(context, node, 'Use typed events instead of saving a prior onFoo hook');
  },
}));
const ACTIVE_SERVICES = new Set(['activeRegistry', 'activePhysics', 'activeBodies', 'activeClock', 'activeNavmesh', 'activeGrade', 'getAimTargets']);
const noActiveSingleton = rule('Active service reads migrate to the app (E357)', (context) => ({
  CallExpression(node) { if (ACTIVE_SERVICES.has(calleeName(node.callee))) report(context, node, 'Read the typed app service instead of an active singleton'); },
}));
const noActiveChunk = rule('Current content data belongs in the game layer (E357)', (context) => {
  if (pathOf(context).startsWith('src/game/shard/')) return {};
  return { CallExpression(node) { if (calleeName(node.callee) === 'getActiveChunk') report(context, node, 'Read explicit level data or the game content service'); } };
});

// Page overlays remain outside legacy level capture (legacyCapture's SHELL selector).
const CAPTURE_SHELL_FILES = new Set(['Loading', 'Resume', 'RotateGate', 'Update', 'ReloadPrompt', 'ErrorModal', 'BootSettings', 'errorScreen'].map((name) => `src/engine/ui/${name}.ts`));
const CAPTURE_CALLS = new Set(['addEventListener', 'setTimeout', 'setInterval', 'requestAnimationFrame']);
const noGlobalListenerPatch = rule('Legacy global registrations migrate to explicit Scopes (E357 F11)', (context) => {
  const path = pathOf(context);
  if (path.startsWith('src/engine/app/') || CAPTURE_SHELL_FILES.has(path)) return {};
  return { CallExpression(node) {
    const callee = unwrap(node.callee);
    if (CAPTURE_CALLS.has(calleeName(callee))) {
      report(context, node, 'Register listeners and timers through the owning Scope'); return;
    }
    if (callee?.type !== 'MemberExpression' || !['append', 'appendChild'].includes(propName(callee) ?? stringOf(callee.property))) return;
    const target = unwrap(callee.object);
    if (target?.type === 'MemberExpression' && (propName(target) ?? stringOf(target.property)) === 'body' && nameOf(target.object) === 'document') {
      report(context, node, 'Register body nodes through the owning Scope');
    }
  } };
});

const plugin = {
  meta: { name: 'wildshard' },
  rules: {
    'no-url-switch': noUrlSwitch, layer, 'no-shard-branch': noShardBranch, 'no-raw-save': noRawSave,
    'no-raw-random-time': noRawRandomTime, 'no-raw-input': noRawInput,
    'no-renderer-type': noRendererType, 'sim-no-render': simNoRender,
    'no-hook-chain': noHookChain,
    'no-active-singleton': noActiveSingleton, 'no-active-chunk': noActiveChunk,
    'no-global-listener-patch': noGlobalListenerPatch,
  },
};
export default plugin; // oxlint loads a JS plugin from its default export
