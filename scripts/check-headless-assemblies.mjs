// Trusted static capabilities are resolved at build time, never from an authored
// URL at runtime. Inspect source exports without executing shard gameplay code.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { parseSync } from 'vite';
import { resolveSpecifier } from './check-graph.mjs';

/** Verify a shard's optional native assembly against its exact static imports.
 * @param {string} root @param {string} slug */
export function checkHeadlessAssembly(root, slug) {
  const prefix = `src/shards/${slug}`, declaration = resolve(root, prefix, 'data/headlessAssembly.json');
  if (!existsSync(declaration)) return;
  const data = JSON.parse(readFileSync(declaration, 'utf8'));
  if (data.version !== 1 || data.modules === null || typeof data.modules !== 'object' || Array.isArray(data.modules)) throw new Error('Invalid headless assembly catalogue');
  const catalogue = `${prefix}/boot/headlessModules.ts`, imports = new Map(), bindings = new Map();
  const fileExists = path => existsSync(resolve(root, path)) && statSync(resolve(root, path)).isFile();
  const parse = path => {
    const result = parseSync(path, readFileSync(resolve(root, path), 'utf8'));
    if (result.errors.length > 0) throw new Error(`Cannot parse trusted assembly module: ${path}`);
    return result.program;
  };
  const locate = (from, source) => {
    const direct = source.startsWith('src/') ? source : source.startsWith('.') ? relative(root, resolve(root, dirname(from), source)).replaceAll('\\', '/') : null;
    const path = direct === null ? resolveSpecifier(from, source, fileExists)
      : [direct, `${direct}.ts`, `${direct}.json`].find(fileExists);
    if (path === null || path === undefined || !path.startsWith('src/') || path.split('/').includes('..')) throw new Error(`Unresolved trusted assembly module: ${source}`);
    const normalized = relative(root, resolve(root, path)).replaceAll('\\', '/');
    if (normalized !== path) throw new Error(`Nonlocal trusted assembly module: ${source}`);
    return path;
  };
  for (const node of parse(catalogue).body) {
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
      for (const specifier of node.specifiers) {
        if (specifier.importKind === 'type') continue;
        if (specifier.type !== 'ImportSpecifier') throw new Error('Trusted catalogue requires static named imports');
        imports.set(specifier.local.name, { path: locate(catalogue, node.source.value), exported: specifier.imported.name });
      }
    }
    if (node.type !== 'ExportNamedDeclaration' || node.declaration?.type !== 'VariableDeclaration') continue;
    for (const row of node.declaration.declarations) {
      if (row.id.name !== 'headlessModules') continue;
      const value = row.init?.type === 'TSSatisfiesExpression' ? row.init.expression : row.init;
      if (value?.type !== 'ObjectExpression') throw new Error('Trusted catalogue must be a literal import map');
      for (const property of value.properties) {
        if (property.type !== 'Property' || property.computed || property.value.type !== 'ObjectExpression' || typeof property.key.value !== 'string' || bindings.has(property.key.value)) throw new Error('Invalid trusted catalogue binding');
        const exports = new Map();
        for (const field of property.value.properties) {
          if (field.type !== 'Property' || field.computed || field.value.type !== 'Identifier') throw new Error('Trusted exports must be static import bindings');
          const key = field.key.name ?? field.key.value;
          if (exports.has(key)) throw new Error('Duplicate trusted export');
          exports.set(key, imports.get(field.value.name));
        }
        bindings.set(property.key.value, exports);
      }
    }
  }
  if (bindings.size !== Object.keys(data.modules).length) throw new Error('Headless declaration and static catalogue differ');
  for (const [name, exports] of Object.entries(data.modules)) {
    if (!Array.isArray(exports) || !exports.every(value => typeof value === 'string') || new Set(exports).size !== exports.length) throw new Error('Invalid headless export list');
    const path = locate(catalogue, name);
    const supplied = bindings.get(name);
    if (supplied?.size !== exports.length || exports.some(exported => supplied.get(exported)?.path !== path || supplied.get(exported)?.exported !== exported)) throw new Error(`Headless static import differs: ${name}`);
    const available = new Set();
    if (path.endsWith('.json')) { JSON.parse(readFileSync(resolve(root, path), 'utf8')); available.add('default'); }
    else for (const node of parse(path).body) {
      if (node.type === 'ExportDefaultDeclaration') available.add('default');
      if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type') continue;
      const own = node.declaration;
      if (own?.type === 'VariableDeclaration') for (const row of own.declarations) if (row.id.type === 'Identifier') available.add(row.id.name);
      if (own?.type === 'FunctionDeclaration' || own?.type === 'ClassDeclaration') available.add(own.id?.name);
      for (const specifier of node.specifiers) if (specifier.exportKind !== 'type') available.add(specifier.exported.name ?? specifier.exported.value);
    }
    for (const exported of exports) if (!available.has(exported)) throw new Error(`Missing headless export ${name}#${exported}`);
  }
  // Source references cannot escape the declared export surface, even in a
  // callback that is first evaluated long after installation or on restore.
  const walk = value => {
    if (value === null || typeof value !== 'object') return;
    if (Array.isArray(value.$ref)) {
      const [owner, field] = value.$ref;
      if (typeof owner === 'string' && (owner.startsWith('src/') || owner.startsWith('@wildshard/')) && !data.modules[owner]?.includes(field)) throw new Error(`Undeclared headless capability: ${owner}#${field}`);
    }
    for (const item of Object.values(value)) if (Array.isArray(item)) for (const child of item) walk(child); else walk(item);
  };
  walk(data);
}
