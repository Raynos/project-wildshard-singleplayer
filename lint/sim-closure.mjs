// SF3a: runtime dependency graph shared by oxlint and the measured, shrink-only baseline.
import { existsSync, readFileSync, globSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { parseSync } from 'vite';

const VIEW = /^src\/engine\/(?:app\/view\/|ai\/view\/|combat\/view\/|quest\/view(?:\/|\.ts$)|saves\/view\/|entities\/AnimalView\.ts$)/u;
const FORBIDDEN = /^src\/engine\/(?:app\/runtime(?:\.ts)?$|core\/(?:tier|frameCost)(?:\.ts)?$|render\/|ui\/|fx\/|anim\/)/u;
// Approved SF16 transition: lint/sim-schema-leaves.json records the owner/removal obligation.
// This exact data leaf is traversed; Three and DOM remain forbidden throughout its closure.
const SCHEMA_LEAF = 'src/engine/render/families/params.ts';
const MATH = new Set(['Vector2', 'Vector3', 'Vector4', 'Euler', 'Quaternion', 'Matrix3', 'Matrix4', 'Box2', 'Box3', 'Ray', 'Sphere', 'Plane', 'Frustum', 'MathUtils', 'Color']);
const DOM = new Set(['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'ResizeObserver', 'Image', 'Audio']);
export const simRoot = (path) => /^src\/(?:engine\/(?:ai|combat|events|quest|saves)\/|shards\/[^/]+\/(?:data|behaviour)\/|engine\/entities\/AnimalSim\.ts$|engine\/sim(?:\.ts$|\/))/u.test(path) && !VIEW.test(path);
const astCache = new Map();
function parsed(file) {
  const text = readFileSync(file, 'utf8');
  const cached = astCache.get(file);
  if (cached?.text === text) return cached.program;
  const result = parseSync(file, text);
  if (result.errors.length > 0) throw new Error(`Cannot parse sim dependency: ${file}`);
  astCache.set(file, { text, program: result.program });
  return result.program;
}
function target(root, file, source) {
  const pkg = /^@wildshard\/(engine|game|sdk|commons)\/(.+)$/u.exec(source);
  const base = pkg ? resolve(root, 'src', pkg[1], pkg[2]) : source.startsWith('.') ? resolve(dirname(file), source) : null;
  if (base === null) return null;
  return [base, `${base}.ts`, `${base}.js`, base.replace(/\.js$/u, '.ts'), `${base}/index.ts`].find((p) => existsSync(p) && statSync(p).isFile()) ?? null;
}
const value = (node) => node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parent);
  for (const [key, child] of Object.entries(node)) {
    if (key === 'parent' || key === 'comments') continue;
    if (Array.isArray(child)) for (const item of child) walk(item, visit, node);
    else if (child && typeof child === 'object') walk(child, visit, node);
  }
}
function reference(node, parent) {
  if (!parent || parent.type.startsWith('TS')) return false;
  if (['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ExportSpecifier'].includes(parent.type)) return false;
  if (['MemberExpression', 'Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.property === node && !parent.computed) return false;
  if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.key === node && !parent.computed) return false;
  if (['VariableDeclarator', 'FunctionDeclaration', 'ClassDeclaration'].includes(parent.type) && parent.id === node) return false;
  return true;
}
export function simClosure(root, entries = globSync('src/**/*.ts', { cwd: root }).filter(simRoot)) {
  const seen = new Set(), violations = new Map();
  const visit = (path, trace) => {
    if (seen.has(path)) return;
    seen.add(path);
    const file = resolve(root, path), next = [];
    const add = (kind, token) => {
      const id = `${path}:${kind}:${token}`;
      const item = violations.get(id) ?? { id, count: 0, trace };
      item.count++; violations.set(id, item);
    };
    walk(parsed(file), (node, parent) => {
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
        if (simRoot(path) && value(node.source) === 'three' && node.importKind === 'type' && node.specifiers?.some((s) => s.type !== 'ImportSpecifier' || !MATH.has(s.imported.name))) add('import', 'three');
        if (node.importKind === 'type' || node.exportKind === 'type' || (node.specifiers?.length && node.specifiers.every((s) => s.importKind === 'type'))) return;
        const source = value(node.source);
        if (source === null) { if (node.source) add('import', 'dynamic'); return; }
        if (source === 'three' || source.startsWith('three/')) {
          if (trace.includes(SCHEMA_LEAF)) { add('import', source); return; }
          if (source !== 'three' || !node.specifiers?.length || node.specifiers.some((s) => s.importKind !== 'type' && (s.type !== 'ImportSpecifier' || !MATH.has(s.imported.name)))) add('import', source);
          return;
        }
        const dest = target(root, file, source);
        if (dest === null) {
          if (source.startsWith('.') || source.startsWith('@wildshard/')) add('unresolved', source);
          return;
        }
        const destPath = relative(root, dest).replaceAll('\\', '/');
        if ((FORBIDDEN.test(destPath) && destPath !== SCHEMA_LEAF) || VIEW.test(destPath)) add('import', destPath);
        else if (/\.[cm]?[jt]s$/u.test(destPath)) next.push(destPath);
      }
      if (simRoot(path) && node.type === 'Identifier' && ['HTMLElement', 'HTMLCanvasElement'].includes(node.name) && parent?.type === 'TSTypeReference') add('global', node.name);
      if (node.type === 'MemberExpression' && ['window', 'globalThis'].includes(node.object?.name) && DOM.has(node.property?.name) && node.property?.name !== 'window') add('global', node.property.name);
      if (node.type === 'Identifier' && reference(node, parent) && DOM.has(node.name)) add('global', node.name);
    });
    for (const dest of next) visit(dest, [...trace, dest]);
  };
  for (const entry of entries) visit(entry, [entry]);
  return [...violations.values()].sort((a, b) => a.id.localeCompare(b.id));
}
