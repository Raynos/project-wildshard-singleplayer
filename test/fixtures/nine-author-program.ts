// oxlint-disable-next-line import/no-nodejs-modules -- Resolve literal author file addresses independently of command location.
import { dirname, relative, resolve } from 'node:path';
import { authorToolProgram } from './author-tool-source';

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}

/** Preserve the complete command AST, normalizing only the actual addresses of literal resolve() calls. */
export function nineAuthorProgram(root: string, path: string, source: string): string {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    const row = object(value);
    if (row === undefined) return value;
    if (row['type'] === 'CallExpression' && object(row['callee'])?.['name'] === 'resolve') {
      const args = row['arguments'];
      if (Array.isArray(args)) {
        const first = object(args[0]), member = object(first?.['object']);
        const base = first?.['type'] === 'Identifier' && first['name'] === 'root' ? root
          : first?.['type'] === 'MemberExpression' && object(first['property'])?.['name'] === 'dirname'
            && member?.['type'] === 'MetaProperty' && object(member['meta'])?.['name'] === 'import'
            && object(member['property'])?.['name'] === 'meta' ? dirname(resolve(root, path)) : undefined;
        const words = args.slice(1).map(argument => object(argument)?.['value']);
        if (base !== undefined && words.every((word): word is string => typeof word === 'string'))
          return { type: 'Literal', value: { authorFile: relative(root, resolve(base, ...words)) } };
      }
    }
    return Object.fromEntries(Object.entries(row).map(([key, child]) => [key, clean(child)]));
  };
  const program: unknown = JSON.parse(authorToolProgram(root, path, source));
  return JSON.stringify(clean(program));
}
