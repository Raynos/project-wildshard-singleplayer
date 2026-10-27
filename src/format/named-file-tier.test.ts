import { expect, test } from 'vitest';
import { tierLibrarySteps } from '@wildshard/format/tierSelection';

const hash = (n: number): string => String(n).repeat(64).slice(0, 64);
const file = (n: number, dependencies: string[] = []) => ({ hash: hash(n), kind: 'binary', decoded: 1, dependencies });
function select(tier: 'phone' | 'desktop', critical: string[] = [], dependencies: string[] = []): ReadonlySet<string> {
  const source = { identity: { slug: 'tiered' }, files: [file(1), file(2), file(3), file(4, dependencies)], library: [hash(1), hash(2), hash(3), hash(4)], critical };
  // an active section names every payload, as a material alias table names both tiers' files
  const sections = new Map<string, unknown>([['custom/materials', { aliases: { a: 'shared.bin', b: 'phone.bin', c: 'desktop.bin' } }]]);
  const descriptor = { index: { files: [
    { hash: hash(1), path: `blobs/bin/${hash(1)}.bin`, name: 'shared.bin' },
    { hash: hash(2), path: `blobs/bin/${hash(2)}.bin`, name: 'phone.bin', tier: 'phone' as const },
    { hash: hash(3), path: `blobs/bin/${hash(3)}.bin`, name: 'desktop.bin', tier: 'desktop' as const },
  ] }, sections };
  const steps = tierLibrarySteps(source, tier, descriptor);
  let step = steps.next();
  while (step.done !== true) step = steps.next();
  return step.value;
}

test('a named file marked for the other tier leaves this tier\'s selection, even where an active row names it', () => {
  expect([...select('phone')]).toEqual([hash(3)]);
  expect([...select('desktop')]).toEqual([hash(2)]);
});

test('a critical pin or a file dependency keeps a tiered file', () => {
  expect([...select('phone', [hash(3)])]).toEqual([]);
  expect([...select('phone', [], [hash(3)])]).toEqual([]);
});

test('a tier keeps only the largest variant of a payload it can fetch', () => {
  const source = { identity: { slug: 'variants' }, files: [file(5), file(6), file(7), file(8)], library: [hash(5), hash(6), hash(7), hash(8)], critical: [] };
  const row = (n: number, name: string, compressed: number, tier?: 'phone' | 'desktop') => ({ hash: hash(n), path: `blobs/bin/${hash(n)}.bin`, name, compressed, variantOf: 'model.glb', ...(tier === undefined ? {} : { tier }) });
  const descriptor = { index: { files: [row(5, 'image.bin', 10), row(6, 'ktx2.bin', 30, 'phone'), row(7, 'astc.bin', 20, 'phone'), row(8, 'desktop.bin', 50, 'desktop')] }, sections: new Map<string, unknown>() };
  const run = (tier: 'phone' | 'desktop') => { const steps = tierLibrarySteps(source, tier, descriptor); let step = steps.next(); while (step.done !== true) step = steps.next(); return [...step.value].sort(); };
  expect(run('phone')).toEqual([hash(5), hash(7), hash(8)].sort());
  expect(run('desktop')).toEqual([hash(5), hash(6), hash(7)].sort());
});
