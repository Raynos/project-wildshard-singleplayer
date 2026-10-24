import { parseSync, type Plugin } from 'vite';

/** Await in an async function does not suspend the containing module. Computed
 * class/object keys and top-level control flow still run during evaluation. */
function suspendsModule(node: unknown): boolean {
  if (node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(suspendsModule);
  if ('type' in node) {
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return false;
    if (node.type === 'AwaitExpression' || node.type === 'ForOfStatement' && 'await' in node && node.await === true
      || node.type === 'VariableDeclaration' && 'kind' in node && node.kind === 'await using') return true;
  }
  return Object.values(node).some(suspendsModule);
}

/** Safari before 27 can evaluate dynamic-import dependants before a suspended
 * module's body. Reject actual emitted app code, not config/build-time await. */
export function assertNoTopLevelAwait(fileName: string, code: string): void {
  const parsed = parseSync(fileName, code, { lang: 'js', sourceType: 'module' });
  if (parsed.errors.length > 0) throw new Error(`Cannot check emitted app JavaScript ${fileName}: ${parsed.errors.map(error => error.message).join('; ')}`);
  if (suspendsModule(parsed.program)) throw new Error(`Top-level await in emitted app chunk ${fileName}: move readiness into an async function before importing its consumers`);
}

/** Inspect final web/native chunks, including lazy chunks and worker JS assets. */
export function noTopLevelAwait(): Plugin {
  return { name: 'wildshard-no-top-level-await', enforce: 'post', generateBundle: { order: 'post', handler(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') assertNoTopLevelAwait(file.fileName, file.code);
      else if (/\.[cm]?js$/u.test(file.fileName)) assertNoTopLevelAwait(file.fileName,
        typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source));
    }
  } } };
}
