// oxlint-disable-next-line import/no-nodejs-modules -- Tests own isolated product/relay directories, never a shared browser.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place only disposable proof fixtures under the system tmp root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve exact fixture files and detect source-path escapes.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { browserOperation, browserPacket, productFile, proofReaders } from '../scripts/oneshot/browser-policy.mjs';
import { browserPipe, browserReply, browserRequest } from '../scripts/oneshot/browser-channel.mjs';
import { proveSceneClient, proveEquippedItemClient } from '@wildshard/sdk/headless';

it('serves only real product files and refuses traversal and source symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'seat-product-')), product = join(root, 'product'); mkdirSync(product);
  try {
    writeFileSync(join(product, 'index.html'), 'product'); writeFileSync(join(root, 'private.ts'), 'denied');
    symlinkSync(join(root, 'private.ts'), join(product, 'escaped.ts'));
    expect(readFileSync(productFile(product, '/'), 'utf8')).toBe('product');
    for (const path of ['/../private.ts', '/escaped.ts', '/missing']) expect(() => productFile(product, path)).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('bounds real input and admits neither host commands nor arbitrary navigation', () => {
  expect(browserOperation({ op: 'key', key: 'w', duration: 1000 })).toEqual({ op: 'key', key: 'w', duration: 1000 });
  for (const input of [{ op: 'goto', url: 'file:///private' }, { op: 'key', key: 'w', duration: 10_001 }, { op: 'key', key: 'w', duration: Number.NaN }, { op: 'key', key: 'F12' }, { op: 'scene', suppliedEvidence: true }])
    expect(() => browserOperation(input)).toThrow();
  expect(() => browserPacket({ id: '../source', message: { op: 'scene' } })).toThrow();
  expect(() => browserPacket({ id: 'a'.repeat(36), message: { op: 'scene' }, reply: '/private/source' })).toThrow();
});

it('whitelists only exact installed SDK read callbacks, never a caller-supplied observation', async () => {
  const readers = await proofReaders({ proveSceneClient, proveEquippedItemClient });
  expect(readers.size).toBe(2);
  expect([...readers.keys()].some(source => source.includes('sceneEvidence'))).toBe(true);
  expect([...readers.keys()].some(source => source.includes('equipmentEvidence'))).toBe(true);
  expect(readers.has('() => ({creatures: [], tick: 1})')).toBe(false);
  expect(readers.has('() => fetch("https://github.com")')).toBe(false);
});

it('relays an atomic reply without giving the seat a socket and propagates refusals', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'seat-channel-'))); mkdirSync(join(root, 'replies'));
  const receiver = browserPipe(join(root, 'requests.fifo'), true);
  receiver.setEncoding('utf8');
  receiver.on('data', chunk => {
    const packet = browserPacket(JSON.parse(String(chunk)));
    const output = browserOperation(packet.message).op === 'scene' ? { ok: true, value: { fromBrowser: true } } : { ok: false, error: 'Only trusted reader' };
    void browserReply(join(root, 'replies', `${packet.id}.fifo`), output);
  });
  try {
    expect(await browserRequest(root, { op: 'scene' })).toEqual({ fromBrowser: true });
    await expect(browserRequest(root, { op: 'evaluate', code: 'invented' })).rejects.toThrow('Only trusted reader');
    await expect(browserRequest(root, { op: 'evaluate', code: 'a'.repeat(4096) })).rejects.toThrow('atomic pipe bound');
    const protectedFile = join(root, 'source.ts'); writeFileSync(protectedFile, 'unchanged');
    await expect(browserReply(protectedFile, { ok: true })).rejects.toThrow('reply FIFO');
    expect(readFileSync(protectedFile, 'utf8')).toBe('unchanged');
    expect(existsSync(join(root, 'endpoint.json'))).toBe(false);
  } finally { receiver.destroy(); rmSync(root, { recursive: true, force: true }); }
});
