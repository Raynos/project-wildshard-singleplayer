/** Diagnose executable file/compiler dependencies before a bundled declaration is evaluated as a data URL. */
export function assertConfigBoundary(imports: readonly string[]): void {
  const generatorImports = imports.filter(name =>
    /^(?:node:)?fs(?:\/promises)?$/u.test(name) || name === 'node:module' || name === 'binaryen' || name.startsWith('assemblyscript'));
  if (generatorImports.length > 0) throw new Error(`shard.config.ts is a bundled declaration: file access and script compilation belong in generate.ts before config loads (${generatorImports.join(', ')}). Import the generated JSON metadata instead.`);
}
