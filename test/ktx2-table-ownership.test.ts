import { expect, test } from 'vitest';
import { engineKtx2TableSource, splitKtx2 } from '../scripts/ktx2-tables.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Freeze the complete predecessor mapping, not a sample of URLs.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only the committed activated mapping through its plain producer.
import { resolve } from 'node:path';

test('the plain engine producer preserves all 150 original tier mappings byte for byte', () => {
  const source = engineKtx2TableSource(resolve('.')), body = source.slice(source.indexOf(' = ') + 3, -2);
  expect(new TextEncoder().encode(body).byteLength).toBe(17_882);
  expect(createHash('sha256').update(body).digest('hex')).toBe('121825d4472ef0beccb9f6bf103c8dd932dfd6a7b87cb4541d901acd51ff424e');
});

test('KTX2 ownership keeps default asset roots, custom globs and the engine remainder', () => {
  const map = { phone: {
    '/assets/fixture/a.png': 'a.ktx2', '/assets/horizon/fixture-day.webp': 'sky.ktx2',
    '/assets/lut/fixture.bin': 'lut.ktx2', '/custom/b.png': 'b.ktx2', '/shared.png': 'engine.ktx2',
  }, desktop: { '/assets/gpu/other/a.png': 'other.ktx2' } };
  const tables = splitKtx2(map, [{ slug: 'fixture', assetGlobs: ['public/custom/*.{png,jpg}'] }, { slug: 'other' }]);
  expect(tables.get('fixture')?.phone).toEqual({ '/assets/fixture/a.png': 'a.ktx2',
    '/assets/horizon/fixture-day.webp': 'sky.ktx2', '/assets/lut/fixture.bin': 'lut.ktx2', '/custom/b.png': 'b.ktx2' });
  expect(tables.get('other')?.desktop).toEqual({ '/assets/gpu/other/a.png': 'other.ktx2' });
  expect(tables.get('engine')?.phone).toEqual({ '/shared.png': 'engine.ktx2' });
});

test('ambiguous KTX2 ownership still refuses before publishing a table', () => {
  expect(() => splitKtx2({ phone: { '/assets/fixture/a.png': 'a.ktx2' }, desktop: {} },
    [{ slug: 'fixture' }, { slug: 'other', assetGlobs: ['public/assets/fixture/**'] }])).toThrow('ambiguous ownership');
});
