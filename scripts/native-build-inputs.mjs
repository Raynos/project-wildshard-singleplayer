import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The ordinary web build covers shared game imports. Rebuild the additional
 * native bundle for its entry, native-only graph, HTML transform or toolchain.
 * @param {readonly string[]} paths */
export function nativeBuildNeeded(paths) {
  return paths.some(path => /^(?:index\.html|native\.html|native-unavailable\.html|vite\.config\.ts|capacitor\.config\.ts|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|tsconfig[^/]*\.json|\.github\/workflows\/deploy\.yml)$/u.test(path)
    || /^(?:vite\/|src\/native|src\/engine\/native\/|scripts\/native|scripts\/build-app\.mjs|scripts\/app-build\/)/u.test(path)
    || ['src/identity.ts', 'src/main.ts', 'src/pageServices.ts'].includes(path));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(nativeBuildNeeded(readFileSync(0, 'utf8').split('\0').filter(Boolean)));
}
