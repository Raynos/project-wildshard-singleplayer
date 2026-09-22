// src/native/updates.ts — the signed, per-file OTA controller (docs/plans/NATIVE-APPS.md N-D), against a fake plugin,
// plus scripts/ota-release.mjs end to end: what the release script signs, the app verifies.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { parseOtaConfig, planRelease, signManifest, validName } from '../scripts/ota-release.mjs';
import {
  OTA_STORAGE_PREFIX, compareVersions, createNativeUpdater, nativeManifest, readUpdateConfig, verifyUpdate,
  type SignedUpdate, type UpdateAdapter, type UpdateBundle, type UpdateConfig, type UpdateHost, type UpdateManifest,
  type UpdateOptions, type UpdateStorage,
} from '../src/native/updates';

const subtle = crypto.subtle;
const ORIGIN = 'https://updates.example';
const host: UpdateHost = { platform: 'ios', nativeVersion: '1.0.0', runtime: 'native-v1', saveSchema: 1, buildId: 'abc1234-builtin' };
const hashA = 'a'.repeat(64), hashB = 'b'.repeat(64);
const file = (name: string, sha256: string) => ({ name, sha256, url: `${ORIGIN}/f/${sha256}`, size: 10 });
const manifest: UpdateManifest = {
  schema: 1, platform: 'ios', nativeMin: '1.0.0', nativeMax: '1.0.9', runtime: 'native-v1', saveSchema: 1,
  bundleId: 'def5678-next', sequence: 1, expiresAt: '2099-01-01T00:00:00Z',
  files: [file('index.html', hashA), file('assets/index-x.js', hashB)],
};
const prefix = `${OTA_STORAGE_PREFIX}ios.1.0.0.native-v1`;
const pendingKey = `${prefix}.pending`, sequenceKey = `${prefix}.sequence`, ledgerKey = `${prefix}.activations`;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCodePoint(b);
  return btoa(binary);
}
const base64url = (text: string) => base64(new TextEncoder().encode(text)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

let privateKeyPem = '';
let config: UpdateConfig;
beforeAll(async () => {
  // PKCS#1 v1.5 generation only so the PKCS#8 export carries the plain rsaEncryption OID node:crypto signs PSS with.
  const pair = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = base64(new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey)));
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${(pkcs8.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PRIVATE KEY-----\n`;
  const parsed = readUpdateConfig(`${ORIGIN}/ios/v1/manifest.json`, await subtle.exportKey('jwk', pair.publicKey));
  if (!parsed) throw new Error('test config rejected');
  config = parsed;
});

/** Signed by the release script's own signer (node:crypto), verified by the app's (WebCrypto). */
function signed(changes: Partial<Record<keyof UpdateManifest, unknown>> = {}): SignedUpdate {
  return signManifest({ ...manifest, ...changes }, privateKeyPem);
}
function serve(envelope: unknown): typeof fetch {
  return vi.fn<typeof fetch>(() => Promise.resolve(Response.json(envelope)));
}

interface Memory extends UpdateStorage { data: Map<string, string>; flush: ReturnType<typeof vi.fn<() => Promise<void>>> }
function memory(): Memory {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
    flush: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  };
}
function entry(id: string, status = 'pending', version = id): UpdateBundle { return { id, version, status }; }

/** A fake plugin whose bundle catalog really changes: download adds, delete removes. */
function plugin(initial: UpdateBundle[] = []) {
  const bundles = [...initial];
  let current: UpdateBundle = { id: 'builtin', version: '1.0.0', status: 'success' };
  const fake = {
    bundles,
    setCurrent: (b: UpdateBundle) => { current = b; },
    current: vi.fn<UpdateAdapter['current']>(() => Promise.resolve({ bundle: current })),
    list: vi.fn<UpdateAdapter['list']>(() => Promise.resolve({ bundles: [...bundles] })),
    download: vi.fn<UpdateAdapter['download']>(({ version }) => {
      const b = entry(`dl-${bundles.length}`, 'pending', version);
      bundles.push(b);
      return Promise.resolve(b);
    }),
    delete: vi.fn<UpdateAdapter['delete']>(({ id }) => {
      const i = bundles.findIndex((b) => b.id === id);
      if (i !== -1) bundles.splice(i, 1);
      return Promise.resolve();
    }),
    set: vi.fn<UpdateAdapter['set']>(() => Promise.resolve()),
    notifyAppReady: vi.fn<UpdateAdapter['notifyAppReady']>(() => Promise.resolve()),
  };
  return fake;
}
function options(a: ReturnType<typeof plugin>, storage: Memory, envelope: unknown = signed(), extra: Partial<UpdateOptions> = {}): UpdateOptions {
  return { adapter: a, storage, host, config, subtle, fetcher: serve(envelope), ...extra };
}
async function staged(a = plugin(), storage = memory()) {
  const updater = createNativeUpdater(options(a, storage));
  await updater.notifyReady();
  expect(await updater.checkForUpdate()).toBe('staged');
  return { a, storage };
}

describe('signed per-file manifest', () => {
  it('accepts a release-script signature and rejects payload tampering', async () => {
    const e = signed();
    expect(await verifyUpdate(e, config, host, subtle)).toEqual(manifest);
    const forged = { ...e, payload: base64url(JSON.stringify({ ...manifest, sequence: 2 })) };
    await expect(verifyUpdate(forged, config, host, subtle)).rejects.toThrow('signature');
  });

  it.each([
    ['other platform', { platform: 'android' }], ['native too old for it', { nativeMin: '1.1.0' }], ['native too new', { nativeMax: '0.9.9' }],
    ['save schema', { saveSchema: 2 }], ['runtime', { runtime: 'native-v2' }], ['expired', { expiresAt: '2000-01-01T00:00:00Z' }],
    ['negative sequence', { sequence: -1 }], ['builtin id', { bundleId: 'builtin' }], ['schema', { schema: 2 }],
    ['no files', { files: [] }], ['no index.html', { files: [file('main.html', hashA)] }],
    ['path traversal', { files: [file('index.html', hashA), file('../etc/passwd', hashB)] }],
    ['absolute path', { files: [file('index.html', hashA), file('/abs.js', hashB)] }],
    ['dot segment', { files: [file('index.html', hashA), file('assets/./x.js', hashB)] }],
    ['hidden file', { files: [file('index.html', hashA), file('.env', hashB)] }],
    ['backslash', { files: [file('index.html', hashA), file(String.raw`assets\x.js`, hashB)] }],
    ['brotli name', { files: [file('index.html', hashA), file('x.js.br', hashB)] }],
    ['case-folded duplicate', { files: [file('index.html', hashA), file('INDEX.html', hashB)] }],
    ['uppercase hash', { files: [file('index.html', 'A'.repeat(64))] }],
    ['off-origin url', { files: [{ ...file('index.html', hashA), url: `https://evil.example/f/${hashA}` }] }],
    ['url not the content address', { files: [{ ...file('index.html', hashA), url: `${ORIGIN}/f/${hashB}` }] }],
    ['url with query', { files: [{ ...file('index.html', hashA), url: `${ORIGIN}/f/${hashA}?x=1` }] }],
    ['http url', { files: [{ ...file('index.html', hashA), url: `http://updates.example/f/${hashA}` }] }],
    ['bad size', { files: [{ ...file('index.html', hashA), size: -1 }] }],
  ] as const)('rejects %s before any download', async (_why, change) => {
    await expect(verifyUpdate(signed(change), config, host, subtle)).rejects.toThrow();
  });

  it('maps to the plugin multi-file entries (lowercase SHA-256 hex of the raw bytes)', () => {
    expect(nativeManifest(manifest)).toEqual([
      { file_name: 'index.html', file_hash: hashA, download_url: `${ORIGIN}/f/${hashA}` },
      { file_name: 'assets/index-x.js', file_hash: hashB, download_url: `${ORIGIN}/f/${hashB}` },
    ]);
  });

  it('only takes a public HTTPS config', () => {
    const jwk = config.publicKey;
    expect(readUpdateConfig('http://updates.example/ios/v1/manifest.json', jwk)).toBeNull();
    expect(readUpdateConfig(`${ORIGIN}/ios/v1/other.json`, jwk)).toBeNull();
    for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) expect(readUpdateConfig(config.manifestUrl, { ...jwk, [field]: 'secret' })).toBeNull();
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  });
});

describe('staging and activation', () => {
  it('stages only after readiness, downloads by manifest (no checksum), activates only at the next boot', async () => {
    const a = plugin(), storage = memory();
    const first = createNativeUpdater(options(a, storage));
    expect(await first.checkForUpdate()).toBe('none'); // not ready yet
    expect(await first.activateStagedAtBoot()).toBe('none');
    await first.notifyReady();
    expect(await first.checkForUpdate()).toBe('staged');
    expect(a.download).toHaveBeenCalledWith({ url: config.manifestUrl, version: manifest.bundleId, manifest: nativeManifest(manifest) });
    expect(a.set).not.toHaveBeenCalled();
    expect(await first.activateStagedAtBoot()).toBe('none'); // never mid-session
    const second = createNativeUpdater(options(a, storage));
    expect(await second.activateStagedAtBoot()).toBe('activated');
    expect(a.set).toHaveBeenCalledExactlyOnceWith({ id: 'dl-0' });
    expect(storage.data.has(pendingKey)).toBe(false);
    a.setCurrent(entry('dl-0', 'success', manifest.bundleId));
    await second.notifyReady();
    expect(storage.data.has(ledgerKey)).toBe(false); // healthy boot clears its quarantine entry
    expect(await second.checkForUpdate()).toBe('none');
    expect(a.download).toHaveBeenCalledOnce();
  });

  it('treats the sequence-0 placeholder and a release of the running build as nothing to do', async () => {
    const a = plugin(), storage = memory();
    for (const envelope of [signed({ sequence: 0 }), signed({ bundleId: host.buildId, sequence: 5 })]) {
      const u = createNativeUpdater(options(a, storage, envelope));
      await u.notifyReady();
      expect(await u.checkForUpdate()).toBe('none');
    }
    expect(a.download).not.toHaveBeenCalled();
  });

  it('ignores a replayed older sequence', async () => {
    const { a, storage } = await staged();
    storage.data.delete(pendingKey);
    const u = createNativeUpdater(options(a, storage, signed({ bundleId: 'older', sequence: 1 })));
    await u.notifyReady();
    expect(await u.checkForUpdate()).toBe('none');
    expect(storage.getItem(sequenceKey)).toBe('1');
  });

  it('never activates a failed bundle twice and keeps player saves', async () => {
    const { a, storage } = await staged();
    storage.setItem('ws.progress.v1', 'saved');
    a.set.mockRejectedValueOnce(new Error('bad bundle'));
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('rejected');
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('none');
    // The watchdog rolled back; the same bundle id is published again at a higher sequence: still refused.
    const again = createNativeUpdater(options(a, storage, signed({ sequence: 2 })));
    await again.notifyReady();
    expect(await again.checkForUpdate()).toBe('rejected');
    expect(storage.getItem('ws.progress.v1')).toBe('saved');
  });

  it('rejects a download the plugin did not finish as this version', async () => {
    const a = plugin(), storage = memory();
    a.download.mockResolvedValueOnce(entry('x', 'error', manifest.bundleId));
    const u = createNativeUpdater(options(a, storage));
    await u.notifyReady();
    expect(await u.checkForUpdate()).toBe('rejected');
    expect(storage.data.size).toBe(0);
  });

  it('retries after an interrupted download (nothing recorded)', async () => {
    const a = plugin(), storage = memory();
    a.download.mockRejectedValueOnce(new Error('network lost'));
    const first = createNativeUpdater(options(a, storage));
    await first.notifyReady();
    expect(await first.checkForUpdate()).toBe('unavailable');
    expect(storage.data.size).toBe(0);
    const retry = createNativeUpdater(options(a, storage));
    await retry.notifyReady();
    expect(await retry.checkForUpdate()).toBe('staged');
  });

  it('bounds the download and the manifest fetch', async () => {
    const a = plugin(), storage = memory();
    a.download.mockImplementationOnce(() => new Promise<UpdateBundle>(() => { /* never settles */ }));
    const slow = createNativeUpdater(options(a, storage, signed(), { downloadTimeoutMs: 20 }));
    await slow.notifyReady();
    expect(await slow.checkForUpdate()).toBe('unavailable');
    const hanging = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(new Error('aborted')); });
    }));
    const offline = createNativeUpdater(options(a, storage, signed(), { fetcher: hanging, manifestTimeoutMs: 20 }));
    await offline.notifyReady();
    expect(await offline.checkForUpdate()).toBe('unavailable');
    expect(storage.data.has(pendingKey)).toBe(false);
  });

  it('flushes staging, and consumes the pending marker durably before switching', async () => {
    const { a, storage } = await staged();
    expect(storage.flush).toHaveBeenCalled();
    const order: string[] = [];
    storage.flush.mockImplementation(() => { order.push('flush'); return Promise.resolve(); });
    a.set.mockImplementationOnce(() => { order.push('set'); return Promise.resolve(); });
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('activated');
    expect(order).toEqual(['flush', 'flush', 'set']);
    expect(JSON.parse(storage.data.get(ledgerKey) ?? '[]')).toEqual([{ id: 'dl-0', version: manifest.bundleId }]);
  });

  it('does not switch when consuming the marker cannot be persisted', async () => {
    const { a, storage } = await staged();
    storage.flush.mockRejectedValueOnce(new Error('disk full'));
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('rejected');
    expect(a.set).not.toHaveBeenCalled();
  });

  it('does not report staged until the pointer is persisted', async () => {
    const a = plugin(), storage = memory();
    storage.flush.mockRejectedValue(new Error('disk full'));
    const u = createNativeUpdater(options(a, storage));
    await u.notifyReady();
    expect(await u.checkForUpdate()).toBe('unavailable');
  });

  it('offline and unconfigured launches stay playable and still acknowledge the watchdog', async () => {
    const a = plugin(), storage = memory();
    const offline = createNativeUpdater(options(a, storage, signed(), { fetcher: vi.fn<typeof fetch>(() => Promise.reject(new Error('offline'))) }));
    expect(await offline.activateStagedAtBoot()).toBe('none');
    await offline.notifyReady();
    expect(await offline.checkForUpdate()).toBe('unavailable');
    const disabled = createNativeUpdater({ ...options(a, storage), config: null });
    expect(await disabled.activateStagedAtBoot()).toBe('disabled');
    await disabled.notifyReady();
    expect(await disabled.checkForUpdate()).toBe('disabled');
    expect(a.notifyAppReady).toHaveBeenCalledTimes(2);
    expect(a.download).not.toHaveBeenCalled();
  });

  it('refuses an activation when the pending bundle is not the signed version', async () => {
    const { a, storage } = await staged();
    const [b] = a.bundles;
    if (b) b.version = 'something-else';
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('rejected');
    expect(a.set).not.toHaveBeenCalled();
  });

  it.each(['{broken', '{}', '[null]', JSON.stringify([{ id: 'a', version: 'same' }, { id: 'b', version: 'same' }]),
    JSON.stringify(Array.from({ length: 33 }, (_, i) => ({ id: `id-${i}`, version: `v${i}` })))])('fails closed on a malformed ledger %s', async (raw) => {
    const { a, storage } = await staged();
    storage.setItem(ledgerKey, raw);
    expect(await createNativeUpdater(options(a, storage)).activateStagedAtBoot()).toBe('rejected');
    const u = createNativeUpdater(options(a, storage, signed({ sequence: 2, bundleId: 'newer' })));
    await expect(u.notifyReady()).resolves.toBeUndefined();
    expect(await u.checkForUpdate()).toBe('unavailable');
    expect(storage.getItem(ledgerKey)).toBe(raw);
    expect(a.set).not.toHaveBeenCalled();
  });
});

describe('abandoned bundle cleanup', () => {
  it('runs after readiness and keeps active, successful, error, in-progress and unknown bundles', async () => {
    const a = plugin([
      entry('builtin'), entry('active'), entry('fallback', 'success'), entry('native-error', 'error'),
      entry('deleting', 'deleting'), entry('unknown', 'future-status'), entry('working', 'downloading'), entry('orphan'),
    ]);
    a.setCurrent(entry('active'));
    const u = createNativeUpdater({ ...options(a, memory()), config: null });
    expect((await u.cleanupAbandoned()).skipped).toBe(true);
    await u.notifyReady();
    expect(await u.cleanupAbandoned()).toEqual({ deleted: ['orphan'], failed: [], skipped: false });
  });

  it('keeps the durably staged bundle and sweeps a superseded one after staging a newer release', async () => {
    const { a, storage } = await staged();
    const u = createNativeUpdater(options(a, storage, signed({ sequence: 2, bundleId: 'newer' })));
    await u.notifyReady();
    expect((await u.cleanupAbandoned()).deleted).toEqual([]);
    expect(await u.checkForUpdate()).toBe('staged');
    expect(a.delete).toHaveBeenCalledWith({ id: 'dl-0' });
    expect(a.bundles.map((b) => b.version)).toEqual(['newer']);
    expect(storage.getItem(sequenceKey)).toBe('2');
  });

  it('retires an expired staged pointer durably before deleting its files', async () => {
    const a = plugin([entry('expired')]);
    const storage = memory();
    storage.setItem(pendingKey, JSON.stringify({ id: 'expired', envelope: signed({ expiresAt: '2000-01-01T00:00:00Z' }) }));
    storage.setItem(sequenceKey, '7');
    const events: string[] = [];
    storage.flush.mockImplementation(() => { events.push(storage.data.has(pendingKey) ? 'flush-pending' : 'flush-consumed'); return Promise.resolve(); });
    a.delete.mockImplementation(() => { events.push('delete'); return Promise.resolve(); });
    const u = createNativeUpdater({ ...options(a, storage), fetcher: serve({}) });
    await u.notifyReady();
    expect((await u.cleanupAbandoned()).deleted).toEqual(['expired']);
    expect(events).toEqual(['flush-pending', 'flush-consumed', 'delete']);
    expect(storage.getItem(sequenceKey)).toBe('7');
  });

  it('leaves unparseable bookkeeping and caps deletions per launch', async () => {
    const a = plugin(Array.from({ length: 12 }, (_, i) => entry(`orphan-${i}`)));
    const storage = memory();
    storage.setItem(pendingKey, '{truncated');
    const broken = createNativeUpdater({ ...options(a, storage), config: null });
    await broken.notifyReady();
    expect((await broken.cleanupAbandoned()).skipped).toBe(true);
    storage.data.delete(pendingKey);
    a.delete.mockRejectedValueOnce(new Error('protected'));
    const u = createNativeUpdater({ ...options(a, storage), config: null });
    await u.notifyReady();
    const first = await u.cleanupAbandoned();
    expect(first.failed).toEqual(['orphan-0']);
    expect(first.deleted).toHaveLength(7);
  });
});

describe('scripts/ota-release.mjs', () => {
  const text = (t: string) => new TextEncoder().encode(t);
  const plan = (inputs: { name: string; bytes: Uint8Array }[], extra: Partial<Parameters<typeof planRelease>[0]> = {}) => planRelease({
    config: { origin: ORIGIN, runtime: 'native-v1', saveSchema: 1, publicN: config.publicKey.n ?? '' },
    inputs, privateKeyPem, bundleId: 'abc1234-mfx', sequence: 3, nativeMin: '1.0.0', nativeMax: '1.0.0',
    expiresAt: '2099-01-01T00:00:00.000Z', platforms: ['ios', 'android'], ...extra,
  });
  const build = () => [
    { name: 'index.html', bytes: text('<!doctype html>') },
    { name: 'assets/app.js', bytes: text(`const k='${config.publicKey.n ?? ''}',u='${ORIGIN}/ios/v1/manifest.json';`) },
    { name: 'assets/deep/same.bin', bytes: text('same') },
    { name: 'assets/copy.bin', bytes: text('same') },
  ];

  it('content-addresses every file and signs per-platform manifests the app accepts', async () => {
    const { blobs, manifests, summary } = plan(build());
    expect(summary).toMatchObject({ bundleId: 'abc1234-mfx', sequence: 3, files: 4 });
    expect(blobs.size).toBe(3); // two identical files share one /f/<sha256>
    for (const platform of ['ios', 'android'] as const) {
      const m = await verifyUpdate(manifests[platform], { ...config, manifestUrl: `${ORIGIN}/${platform}/v1/manifest.json` }, { ...host, platform }, subtle);
      expect(m.files.map((f) => f.name)).toEqual(['index.html', 'assets/app.js', 'assets/deep/same.bin', 'assets/copy.bin']);
      for (const f of m.files) {
        const digest = new Uint8Array(await subtle.digest('SHA-256', blobs.get(f.sha256) ?? new Uint8Array()));
        expect([...digest].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(f.sha256);
      }
    }
  });

  it('refuses a build that could not verify or find its next release, and bad releases', () => {
    const noKey = build();
    for (const f of noKey) if (f.name.endsWith('.js')) f.bytes = text('no key here');
    expect(() => plan(noKey)).toThrow('OTA_PUBLIC_KEY');
    expect(() => plan(build(), { config: { origin: ORIGIN, runtime: 'native-v1', saveSchema: 1, publicN: 'other' } })).toThrow('does not match');
    expect(() => plan([...build(), { name: 'a b.png', bytes: text('x') }])).toThrow('reject');
    expect(() => plan([...build(), { name: 'INDEX.HTML', bytes: text('x') }])).toThrow('case');
    expect(() => plan(build(), { sequence: 0 })).toThrow('sequence');
    expect(() => plan(build(), { expiresAt: '2000-01-01T00:00:00Z' })).toThrow('expiry');
    expect(plan([{ name: 'index.html', bytes: text('stub') }], { sequence: 0, placeholder: true }).summary.sequence).toBe(0);
  });

  it('reads the channel constants from ota-config.ts source', () => {
    const src = "export const OTA_ORIGIN = 'https://x.example';\nexport const OTA_RUNTIME = 'native-v1';\nexport const OTA_SAVE_SCHEMA = 1;\nconst k = { n: 'abc_-' };";
    expect(parseOtaConfig(src)).toEqual({ origin: 'https://x.example', runtime: 'native-v1', saveSchema: 1, publicN: 'abc_-' });
  });

  it('agrees with the app on file names', () => {
    for (const ok of ['index.html', 'assets/index-DJQUWkps.js', 'assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.gain.png']) expect(validName(ok)).toBe(true);
    for (const bad of ['../x', '/x', 'a//b', '.env', 'a b.png', 'x.br', String.raw`a\b`]) expect(validName(bad)).toBe(false);
  });
});
