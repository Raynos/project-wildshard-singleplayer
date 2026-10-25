import { expect, test } from 'vitest';
import { readGridSeamData } from './seamData';

async function fixture(source: string) {
  const wire = new TextEncoder().encode(source), hash = new Uint8Array(await crypto.subtle.digest('SHA-256', wire));
  const sha256 = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
  return { source, address: { url: `/assets/grid-seams-${sha256.slice(0, 8)}.json`, bytes: wire.length, sha256 } };
}

test('entry reads exact bytes once and returns detached per-read data without a module-held bank', async () => {
  const asset = await fixture('{"plans":[["native",[[0,0.125,1]]]],"edges":[]}');
  const urls: string[] = [];
  const read = (url: string): Promise<Response> => { urls.push(url); return Promise.resolve(new Response(asset.source)); };
  const first = await readGridSeamData(asset.address, read), second = await readGridSeamData(asset.address, read);
  expect(first).toEqual({ plans: [['native', [[0, 0.125, 1]]]], edges: [] });
  expect(second).toEqual(first); expect(second).not.toBe(first);
  expect(urls).toEqual([asset.address.url, asset.address.url]);
});

test('missing, changed, truncated or malformed seam data refuses before construction', async () => {
  const asset = await fixture('{"plans":[],"edges":[]}');
  await expect(readGridSeamData(asset.address, () => Promise.resolve(new Response(null, { status: 404 })))).rejects.toThrow('404');
  await expect(readGridSeamData(asset.address, () => Promise.resolve(new Response('x')))).rejects.toThrow('size');
  await expect(readGridSeamData(asset.address, () => Promise.resolve(new Response(asset.source.replace('plans', 'wrong'))))).rejects.toThrow('differs');
  const invalid = await fixture('{"plans":[["native",[["wrong"]]]],"edges":[]}');
  await expect(readGridSeamData(invalid.address, () => Promise.resolve(new Response(invalid.source)))).rejects.toThrow('Invalid grid seam data');
});

test('native edge samples and physical observations survive transport exactly', async () => {
  const row = { heights: Array.from({ length: 257 }, (_, i) => i / 256),
    colours: Array.from({ length: 257 }, () => [0.125, 0.25, 0.5]), roadHeight: 0 };
  const observation = { entryWidth: 12, waterSurface: 0, geometry: 'ground', sourceSurface: 'terrain', outflows: [{ from: -5, to: 5 }] };
  const value = { plans: [], edges: [['native', { kind: 'declared', profiles: { north: row, east: row, south: row, west: row },
    observations: { north: observation, east: observation, south: observation, west: observation } }]] };
  const asset = await fixture(JSON.stringify(value));
  expect(await readGridSeamData(asset.address, () => Promise.resolve(new Response(asset.source)))).toEqual(value);
});
