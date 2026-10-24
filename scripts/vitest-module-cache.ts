import type { Plugin } from 'vitest/config';
import type { VitestPluginContext } from 'vitest/node';

/** Glob transforms depend on directory membership as well as the importing source. */
export function vitestModuleCache(): Plugin {
  return {
    name: 'wildshard:vitest-module-cache',
    configureVitest({ defineCacheKeyGenerator }: VitestPluginContext) {
      // Vitest 5.0.1 only excludes the literal `import.meta.glob(` spelling.
      // Type arguments and whitespace bypass it; old expansions then keep deleted
      // files and miss new ones. Decline those entries before reading any cache.
      defineCacheKeyGenerator(({ sourceCode }) =>
        /import\s*\.\s*meta\s*\.\s*glob\b/u.test(sourceCode) ? false : undefined);
    },
  };
}
