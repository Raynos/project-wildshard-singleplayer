/** Load only the pinned external compiler; its ambient declarations never enter the host TypeScript program. */
export function loadAssemblyScriptCompiler() {
  return import('assemblyscript/dist/asc.js');
}
