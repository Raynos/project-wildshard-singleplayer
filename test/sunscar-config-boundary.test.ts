// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the real author entry without executing a product build.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

for (const [entry, nativeBakeImport] of [['shard.config.ts', false], ['generators/output.ts', true], ['generators/output.ts', false]] as const) {
  test(`Sunscar ${entry} ${nativeBakeImport ? 'refuses native bake imports' : 'keeps effect metadata data-only'}`, async () => {
    let rewrites = 0;
    const result = await build({ configFile: false, logLevel: 'silent',
      plugins: [{ name: 'original-effect-import', enforce: 'pre', transform(source, id) {
        if (!nativeBakeImport || !id.endsWith('/generators/lightEmitters.ts')) return null;
        rewrites++;
        return source.replace("import { placeEffects } from './placeEffects';", "import { placeBindings } from './restScene';")
          .replace('const bindings = placeEffects();', 'const bindings = placeBindings();');
      } }],
      build: { write: false, minify: false, lib: { entry: resolve('src/shards/sunscar-dunes', entry), formats: ['es'] },
        rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } },
    });
    expect(rewrites).toBe(nativeBakeImport ? 1 : 0);
    const built = Array.isArray(result) ? result[0] : result;
    if (built === undefined || !('output' in built)) throw new Error('Missing Sunscar config bundle');
    const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
    for (const chunk of chunks) {
      const boundary = () => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
      if (nativeBakeImport) expect(boundary).toThrow('file access (node:fs)');
      else {
        expect(boundary).not.toThrow();
        expect(Object.keys(chunk.modules).some(path => path.endsWith('/generators/restScene.ts'))).toBe(false);
      }
    }
  });
}
