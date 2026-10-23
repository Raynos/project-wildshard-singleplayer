// oxlint-disable-next-line import/no-nodejs-modules -- Build a tiny installed-package graph inside an owned fixture.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Package resolution uses only this synthetic directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { compilerPackageInputs } from '../src/sdk/projectCompilerIdentity';

test('compiler identities cover transitive runtime and standard-library bytes, not installation paths', () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp', 'compiler-identity-'));
  try {
    const main = resolve(root, 'node_modules/compiler-main'), child = resolve(root, 'node_modules/compiler-child');
    mkdirSync(main, { recursive: true }); mkdirSync(resolve(child, 'umd'), { recursive: true });
    writeFileSync(resolve(main, 'package.json'), JSON.stringify({ name: 'compiler-main', version: '1', main: 'index.js', dependencies: { 'compiler-child': '2' } }));
    writeFileSync(resolve(main, 'index.js'), 'export const compiler = 1;');
    writeFileSync(resolve(child, 'package.json'), JSON.stringify({ name: 'compiler-child', version: '2', main: 'umd/index.js' }));
    writeFileSync(resolve(child, 'umd/package.json'), JSON.stringify({ type: 'commonjs' }));
    writeFileSync(resolve(child, 'umd/index.js'), 'module.exports = 2;');
    writeFileSync(resolve(child, 'runtime.ts'), 'export function finite(x:f64):f64{return x;}');
    const rows = [{ name: 'compiler-main', from: resolve(root, 'entry.mjs') }], first = compilerPackageInputs(rows);
    expect(first.some(([path]) => path === 'compiler-child@2/runtime.ts')).toBe(true);
    expect(first.some(([path]) => path.startsWith(root))).toBe(false);
    writeFileSync(resolve(child, 'runtime.ts'), 'export function finite(x:f64):f64{return x+1;}');
    expect(compilerPackageInputs(rows)).not.toEqual(first);
    const second = compilerPackageInputs(rows); writeFileSync(resolve(child, 'README.md'), 'Not executed by the compiler');
    expect(compilerPackageInputs(rows)).toEqual(second);
    symlinkSync(resolve(child, 'runtime.ts'), resolve(child, 'alias.ts'));
    expect(() => compilerPackageInputs(rows)).toThrow('symbolic source');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
