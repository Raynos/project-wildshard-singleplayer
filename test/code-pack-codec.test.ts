import { expect, test } from 'vitest';
import { writeCodePacks } from '../scripts/app-build/codePacks';
import { codePackEntries, readCodePackTransport } from '../src/engine/pwa/codePack.js';
import { readCodePack } from '../src/engine/boot/codePack';
// oxlint-disable-next-line import/no-nodejs-modules -- Read and mutate the actual emitted transport in an owned fixture.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine that fixture's output to its own tmp directory.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Re-authenticate a deliberately damaged inner member to test its independent hash.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Damage the actual encoded packet, rather than copy its codec.
import { gzipSync, gunzipSync } from 'node:zlib';

const member = '/assets/member-aaaaaaaa.js', source = 'export const value = 7;';
async function packet(visit: (wire: ArrayBuffer, expected: readonly [number, number, string]) => Promise<void>): Promise<void> {
  mkdirSync('tmp/code-pack-codec', { recursive: true });
  const root = mkdtempSync(resolve('tmp/code-pack-codec/case-'));
  try {
    mkdirSync(resolve(root, 'assets')); writeFileSync(resolve(root, member.slice(1)), source);
    const packs = writeCodePacks(root, { entry: [[member, Buffer.byteLength(source)]] }), row = packs.entries['entry'];
    if (row === undefined) throw new Error('Missing emitted packet');
    const [url, encoded, decoded] = readCodePack(row), hash = /([a-f0-9]{64})\.pack$/u.exec(url)?.[1];
    if (hash === undefined) throw new Error('Missing packet hash');
    await visit(new Uint8Array(readFileSync(resolve(root, url.slice(1)))).buffer, [encoded, decoded, hash]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('the actual compiler transport returns unchanged complete module bytes', async () => {
  await packet(async (wire, expected) => {
    const entries = await codePackEntries(wire, expected, new Set([member]));
    expect(entries.map(([url, bytes]) => [url, new TextDecoder().decode(bytes)])).toEqual([[member, source]]);
    expect(await readCodePackTransport(new Response(wire), expected[0])).toEqual(wire);
  });
});

test('an authenticated envelope cannot publish a damaged inner module', async () => {
  await packet(async (wire, expected) => {
    const body = gunzipSync(new Uint8Array(wire)); body[body.length - 1] = (body.at(-1) ?? 0) ^ 1;
    const changed = new Uint8Array(gzipSync(body)), hash = createHash('sha256').update(changed).digest('hex');
    await expect(codePackEntries(changed.buffer, [changed.length, expected[1], hash], new Set([member]))).rejects.toThrow('member differs');
  });
});

test('truncation, expansion and nonmember URLs refuse before code publication', async () => {
  await packet(async (wire, expected) => {
    await expect(readCodePackTransport(new Response(wire.slice(0, -1)), expected[0])).rejects.toThrow('Truncated');
    await expect(readCodePackTransport(new Response(wire), expected[0] - 1)).rejects.toThrow('Oversized');
    await expect(codePackEntries(wire, [expected[0], expected[1] - 1, expected[2]], new Set([member]))).rejects.toThrow('Oversized');
    await expect(codePackEntries(wire, expected, new Set())).rejects.toThrow('Invalid code pack member');
  });
});
