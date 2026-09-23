/**
 * Signed, self-hosted, per-file (delta) web-bundle updates for the native shells (docs/plans/NATIVE-APPS.md N-D).
 * Ported from trials-gauntlet's signed manual-mode updater, with one big difference: Wildshard's web bundle is
 * ~140 MB of mostly unchanged textures, so a release is a file list, not a ZIP. The native plugin
 * (@capgo/capacitor-updater, multi-file `download({ manifest })`) copies every file whose SHA-256 matches the
 * built-in bundle or its delta cache, and downloads only the rest from `/f/<sha256>` — each file hash-checked natively.
 *
 * Trust: the manifest is an RSA-PSS (SHA-256, salt 32) signed envelope checked against the public key pinned in the
 * binary (ota-config.ts) before any URL in it is used. It is bound to platform, native version range, runtime, save
 * schema, a monotonic sequence and an expiry; every file URL must be the content address of its hash on the channel's
 * own origin.
 *
 * Lifecycle: the app always boots its installed bundle with no network on the critical path. After a healthy boot
 * (`notifyReady`) it checks the channel and downloads + stages in the background. A staged bundle activates only at
 * the NEXT cold start, before the game initialises (`activateStagedAtBoot`) — never mid-session and never through
 * the plugin's `next()`, which could switch on backgrounding. If the new bundle does not call `notifyAppReady()`
 * within `appReadyTimeout` the plugin's watchdog rolls back; a durable activation ledger keeps a failed bundle from
 * ever being retried.
 *
 * Pure: no Capacitor import. The plugin, storage, fetch and WebCrypto are injected (tests use fakes; ota.ts wires
 * the real ones).
 */

export interface OtaFile {
  /** Path inside the web bundle, relative, '/'-separated (e.g. `assets/index-abc.js`). */
  name: string;
  /** Lowercase hex SHA-256 of the file's bytes — what the native plugin verifies and deduplicates on. */
  sha256: string;
  /** `<channel origin>/f/<sha256>`. */
  url: string;
  size: number;
}

export interface UpdateManifest {
  schema: 1;
  platform: 'ios' | 'android';
  nativeMin: string;
  nativeMax: string;
  runtime: string;
  saveSchema: number;
  bundleId: string;
  /** Monotonic per channel. 0 is the "nothing to install" placeholder (a fresh install's high-water mark is 0). */
  sequence: number;
  expiresAt: string;
  files: OtaFile[];
}

export interface SignedUpdate { payload: string; signature: string }
export interface UpdateConfig { manifestUrl: string; publicKey: JsonWebKey }
/** The subset of the plugin's BundleInfo we read. In multi-file mode the plugin stores no bundle checksum. */
export interface UpdateBundle { id: string; version: string; status: string }
/** The plugin's multi-file ManifestEntry. */
export interface NativeManifestEntry { file_name: string; file_hash: string; download_url: string }
export interface UpdateAdapter {
  current: () => Promise<{ bundle: UpdateBundle }>;
  list: () => Promise<{ bundles: UpdateBundle[] }>;
  download: (options: { url: string; version: string; manifest: NativeManifestEntry[] }) => Promise<UpdateBundle>;
  delete: (options: { id: string }) => Promise<void>;
  set: (options: { id: string }) => Promise<void>;
  notifyAppReady: () => Promise<unknown>;
}
export type UpdateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { flush?: () => Promise<void> };
export interface UpdateHost {
  platform: 'ios' | 'android';
  /** The store binary's version (App.getInfo().version), major.minor.patch. */
  nativeVersion: string;
  runtime: string;
  saveSchema: number;
  /** The running web bundle's build id (__BUILD_ID__); a release of the same build is never downloaded. */
  buildId: string;
}
export interface UpdateOptions {
  adapter: UpdateAdapter;
  storage: UpdateStorage;
  host: UpdateHost;
  config: UpdateConfig | null;
  fetcher?: typeof fetch;
  subtle?: SubtleCrypto;
  now?: () => number;
  /** Manifest fetch budget (default 10 s). */
  manifestTimeoutMs?: number;
  /** Delta download budget (default 20 min). A download past it is abandoned here; the native side may still finish
   *  it, and the next launch's cleanup sweeps the unreferenced bundle (its files stay in the plugin's delta cache). */
  downloadTimeoutMs?: number;
}
export type UpdateResult = 'disabled' | 'none' | 'staged' | 'activated' | 'rejected' | 'unavailable';
export interface UpdateCleanupResult { deleted: string[]; failed: string[]; skipped: boolean }
export interface NativeUpdater {
  configured: boolean;
  activateStagedAtBoot: () => Promise<UpdateResult>;
  notifyReady: () => Promise<void>;
  cleanupAbandoned: () => Promise<UpdateCleanupResult>;
  checkForUpdate: () => Promise<UpdateResult>;
}

/** All persisted keys start with this (src/native/saves.ts mirrors every `ws.*` key into durable Preferences). */
export const OTA_STORAGE_PREFIX = 'ws.ota.';
/** Bound native filesystem work per launch; a later launch retries any remaining or failed cleanup. */
const CLEANUP_LIMIT = 8;
/** Failed activations stay quarantined for this native/runtime version. Failure history is never evicted to make
 *  room: a full ledger closes OTA until the next native release. */
const ACTIVATION_LIMIT = 32;
/** Signed envelope / manifest ceiling: a few hundred files is ~50 KB; this leaves room for thousands. */
const MAX_ENVELOPE_CHARS = 4_000_000;
const MAX_FILES = 20_000;
const BUNDLE_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const PATH_SEGMENT = /^[A-Za-z0-9_@+~-][A-Za-z0-9._@+~-]*$/;
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'] as const;

interface ActivationAttempt { id: string; version: string }
interface PendingUpdate { envelope: SignedUpdate; id: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function plainHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch {
    return null;
  }
}

/** Public configuration only. A malformed URL or anything that looks like a private key leaves OTA disabled. */
export function readUpdateConfig(manifestUrl: string, publicKey: JsonWebKey): UpdateConfig | null {
  const url = plainHttps(manifestUrl);
  if (!url?.pathname.endsWith('/manifest.json')) return null;
  if (publicKey.kty !== 'RSA' || !publicKey.n || !publicKey.e || PRIVATE_JWK_FIELDS.some((field) => field in publicKey)) return null;
  return { manifestUrl: url.href, publicKey: { kty: 'RSA', n: publicKey.n, e: publicKey.e } };
}

function decodeBase64Url(value: unknown): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > MAX_ENVELOPE_CHARS) throw new Error('Invalid signed update');
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.codePointAt(0) ?? 0);
}

function versionParts(value: unknown): [number, number, number] {
  if (typeof value !== 'string') throw new Error('Invalid native version');
  const match = /^(\d{1,9})\.(\d{1,9})\.(\d{1,9})$/.exec(value);
  if (!match) throw new Error('Invalid native version');
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a: unknown, b: unknown): number {
  const aa = versionParts(a), bb = versionParts(b);
  for (let i = 0; i < 3; i++) {
    const x = aa[i] ?? 0, y = bb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function validFileName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 512 || name.endsWith('.br')) return false;
  return name.split('/').every((segment) => PATH_SEGMENT.test(segment));
}

function parseFiles(value: unknown, channel: URL): OtaFile[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILES) throw new Error('Invalid file list');
  const seen = new Set<string>();
  const files: OtaFile[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) throw new Error('Invalid file entry');
    const { name, sha256, url, size } = entry;
    if (!validFileName(name)) throw new Error('Invalid file name');
    // Case-folded: two names that collide on a case-insensitive filesystem are one file there.
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error('Duplicate file name');
    seen.add(key);
    if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) throw new Error('Invalid file hash');
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) throw new Error('Invalid file size');
    const parsed = typeof url === 'string' ? plainHttps(url) : null;
    if (parsed?.origin !== channel.origin || parsed.pathname !== `/f/${sha256}`) throw new Error('File URL is not the content address on the channel origin');
    files.push({ name, sha256, url: parsed.href, size });
  }
  if (!seen.has('index.html')) throw new Error('Bundle has no index.html');
  return files;
}

/** Validate a decoded payload's fields against this host. Throws on anything unexpected. */
export function parseManifest(value: unknown, config: UpdateConfig, host: UpdateHost, now: number): UpdateManifest {
  if (!isRecord(value)) throw new Error('Invalid manifest');
  const { schema, platform, nativeMin, nativeMax, runtime, saveSchema, bundleId, sequence, expiresAt, files } = value;
  if (schema !== 1 || platform !== host.platform || runtime !== host.runtime || saveSchema !== host.saveSchema) throw new Error('Incompatible update');
  if (typeof nativeMin !== 'string' || typeof nativeMax !== 'string') throw new Error('Invalid native version');
  if (compareVersions(nativeMin, nativeMax) > 0 || compareVersions(host.nativeVersion, nativeMin) < 0 || compareVersions(host.nativeVersion, nativeMax) > 0) throw new Error('Native version outside update bounds');
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0) throw new Error('Invalid update sequence');
  if (typeof bundleId !== 'string' || !BUNDLE_ID.test(bundleId) || bundleId === 'builtin') throw new Error('Invalid bundle ID');
  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now) throw new Error('Expired update');
  const channel = new URL(config.manifestUrl);
  return { schema: 1, platform: host.platform, nativeMin, nativeMax, runtime: host.runtime, saveSchema: host.saveSchema, bundleId, sequence, expiresAt, files: parseFiles(files, channel) };
}

/** Verify the exact signed bytes before trusting any URL, native bound or save contract inside them. */
export async function verifyUpdate(envelope: unknown, config: UpdateConfig, host: UpdateHost, subtle: SubtleCrypto, now = Date.now()): Promise<UpdateManifest> {
  if (!isRecord(envelope)) throw new Error('Invalid signed update');
  const payload = decodeBase64Url(envelope['payload']);
  const signature = decodeBase64Url(envelope['signature']);
  const key = await subtle.importKey('jwk', config.publicKey, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
  if (!await subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, key, signature, payload)) throw new Error('Invalid update signature');
  const decoded: unknown = JSON.parse(new TextDecoder().decode(payload));
  return parseManifest(decoded, config, host, now);
}

/** The plugin's multi-file download list for a verified manifest. */
export function nativeManifest(manifest: UpdateManifest): NativeManifestEntry[] {
  return manifest.files.map((f) => ({ file_name: f.name, file_hash: f.sha256, download_url: f.url }));
}

function parsePending(raw: string): PendingUpdate {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error('Invalid pending update');
  const { id, envelope } = value;
  if (typeof id !== 'string' || !id || !isRecord(envelope) || typeof envelope['payload'] !== 'string' || typeof envelope['signature'] !== 'string') throw new Error('Invalid pending update');
  return { id, envelope: { payload: envelope['payload'], signature: envelope['signature'] } };
}

function parseActivations(raw: string | null): ActivationAttempt[] {
  if (raw === null) return [];
  if (raw.length > 16_384) throw new Error('Invalid activation ledger');
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > ACTIVATION_LIMIT) throw new Error('Invalid activation ledger');
  const entries: ActivationAttempt[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) throw new Error('Invalid activation ledger');
    const { id, version } = entry;
    if (typeof id !== 'string' || !id || id.length > 200 || id === 'builtin' || typeof version !== 'string' || !BUNDLE_ID.test(version) || version === 'builtin') throw new Error('Invalid activation ledger');
    entries.push({ id, version });
  }
  if (new Set(entries.map((e) => e.version)).size !== entries.length) throw new Error('Invalid activation ledger');
  return entries;
}

async function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(new Error(`${what} timed out`)); }, ms); });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construct once per launch. Call activateStagedAtBoot before the game initialises, notifyReady only once the
 * title is up, then checkForUpdate without awaiting it from gameplay.
 */
export function createNativeUpdater(options: UpdateOptions): NativeUpdater {
  const { adapter, storage, host, config } = options;
  const namespace = `${OTA_STORAGE_PREFIX}${host.platform}.${host.nativeVersion}.${host.runtime}`;
  const pendingKey = `${namespace}.pending`;
  const sequenceKey = `${namespace}.sequence`;
  const activationKey = `${namespace}.activations`;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const subtle = options.subtle ?? crypto.subtle;
  const manifestTimeoutMs = options.manifestTimeoutMs ?? 10_000;
  const downloadTimeoutMs = options.downloadTimeoutMs ?? 20 * 60_000;
  const flush = async (): Promise<void> => { if (storage.flush) await storage.flush(); };
  const verify = (envelope: unknown): Promise<UpdateManifest> => {
    if (!config) return Promise.reject(new Error('Updates are not configured'));
    return verifyUpdate(envelope, config, host, subtle, now());
  };
  let checking = false;
  let bootChecked = false;
  let ready = false;
  let cleanupAttempts = 0;

  const readActivations = (): ActivationAttempt[] => parseActivations(storage.getItem(activationKey));
  const writeActivations = (entries: ActivationAttempt[]): void => {
    if (entries.length > 0) storage.setItem(activationKey, JSON.stringify(entries));
    else storage.removeItem(activationKey);
  };

  /** Caller owns `checking`: cleanup must never race our download or pending-marker writes. */
  const cleanup = async (): Promise<UpdateCleanupResult> => {
    const result: UpdateCleanupResult = { deleted: [], failed: [], skipped: false };
    try {
      // If any earlier marker write failed to persist, keep every bundle until durable state catches up.
      await flush();
      let pendingId: string | null = null;
      const raw = storage.getItem(pendingKey);
      if (raw !== null) {
        const pending = parsePending(raw);
        pendingId = pending.id;
        if (config) {
          try {
            await verify(pending.envelope);
          } catch {
            // An expired / incompatible release can no longer be activated. Retire its pointer durably, but keep the
            // high-water sequence so it is not downloaded again.
            storage.removeItem(pendingKey);
            await flush();
            pendingId = null;
          }
        }
      }
      const { bundles } = await adapter.list();
      for (const candidate of bundles) {
        if (cleanupAttempts >= CLEANUP_LIMIT) break;
        // Keep every success: the plugin's private previous-fallback pointer has no public getter. Error / deleting /
        // deleted metadata stays with native cleanup; unknown / downloading statuses are left alone.
        if (candidate.status !== 'pending' || !candidate.id || candidate.id === 'builtin' || candidate.id === pendingId) continue;
        const { bundle: current } = await adapter.current();
        if (candidate.id === current.id) continue;
        const latest = (await adapter.list()).bundles;
        const bundle = latest.find((b) => b.id === candidate.id);
        // Android cancels work by version: keep a pending copy while another copy of that version is downloading.
        if (bundle?.status !== 'pending' || latest.some((b) => b.version === bundle.version && b.status === 'downloading')) continue;
        cleanupAttempts++;
        try {
          await adapter.delete({ id: bundle.id });
          result.deleted.push(bundle.id);
        } catch {
          result.failed.push(bundle.id);
        }
      }
    } catch {
      result.skipped = true;
    }
    return result;
  };

  return {
    configured: config !== null,

    async activateStagedAtBoot(): Promise<UpdateResult> {
      if (bootChecked || ready) return 'none';
      bootChecked = true;
      if (!config) return 'disabled';
      try {
        const raw = storage.getItem(pendingKey);
        if (raw === null) return 'none';
        // Consume before set(): a crash, rollback or failed switch must not retry this bundle forever.
        storage.removeItem(pendingKey);
        await flush(); // durable consumption must precede the WebView reload
        const pending = parsePending(raw);
        const manifest = await verify(pending.envelope);
        const { bundle: current } = await adapter.current();
        if (current.id === pending.id) return 'none';
        const { bundles } = await adapter.list();
        const bundle = bundles.find((b) => b.id === pending.id);
        if (bundle?.status !== 'pending' || bundle.version !== manifest.bundleId) return 'rejected';
        const attempts = readActivations();
        if (attempts.length >= ACTIVATION_LIMIT || attempts.some((entry) => entry.version === manifest.bundleId)) return 'rejected';
        // Recorded before the reload, independent of native metadata. Only this bundle's acknowledged healthy boot
        // (notifyReady) clears its entry; a watchdog rollback leaves it, so it is never activated again.
        writeActivations([...attempts, { id: bundle.id, version: manifest.bundleId }]);
        await flush();
        await adapter.set({ id: bundle.id }); // reloads the WebView — only ever at this cold-start boundary
        return 'activated';
      } catch {
        return 'rejected';
      }
    },

    async notifyReady(): Promise<void> {
      // Required even without a channel: the native plugin owns the rollback watchdog.
      await adapter.notifyAppReady();
      ready = true;
      // Persistence trouble must not undo the native acknowledgement or block the game. A stale entry is conservative:
      // it only prevents reusing this bundle version.
      try {
        const attempts = readActivations();
        if (attempts.length > 0) {
          const { bundle: current } = await adapter.current();
          const remaining = attempts.filter((entry) => entry.id !== current.id || entry.version !== current.version);
          if (remaining.length !== attempts.length) {
            writeActivations(remaining);
            await flush();
          }
        }
      } catch { /* malformed / unpersisted ledger: OTA stays closed, the game stays up */ }
    },

    /** Optional explicit sweep; checkForUpdate also sweeps before and after its download. */
    async cleanupAbandoned(): Promise<UpdateCleanupResult> {
      if (!ready || checking) return { deleted: [], failed: [], skipped: true };
      checking = true;
      try { return await cleanup(); } finally { checking = false; }
    },

    async checkForUpdate(): Promise<UpdateResult> {
      if (!ready || checking) return config ? 'none' : 'disabled';
      checking = true;
      const controller = new AbortController();
      const timer = setTimeout(() => { controller.abort(); }, manifestTimeoutMs);
      try {
        await cleanup();
        if (!config) return 'disabled';
        const response = await fetcher(config.manifestUrl, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal });
        if (!response.ok) return 'unavailable';
        const text = await response.text();
        clearTimeout(timer);
        if (text.length > MAX_ENVELOPE_CHARS) return 'rejected';
        let envelope: unknown;
        let manifest: UpdateManifest;
        try {
          envelope = JSON.parse(text);
          manifest = await verify(envelope);
        } catch {
          return 'rejected';
        }
        const highest = Number(storage.getItem(sequenceKey) ?? '0');
        if (!Number.isSafeInteger(highest) || manifest.sequence <= highest) return 'none';
        if (manifest.bundleId === host.buildId) return 'none';
        const { bundle: current } = await adapter.current();
        if (current.version === manifest.bundleId) return 'none';
        const attempts = readActivations();
        if (attempts.length >= ACTIVATION_LIMIT || attempts.some((entry) => entry.version === manifest.bundleId)) return 'rejected';
        // Unchanged files are copied from the built-in bundle / delta cache natively; only new hashes hit the network.
        const bundle = await withTimeout(
          adapter.download({ url: config.manifestUrl, version: manifest.bundleId, manifest: nativeManifest(manifest) }),
          downloadTimeoutMs,
          'Bundle download',
        );
        if (bundle.status !== 'pending' || bundle.version !== manifest.bundleId) return 'rejected';
        storage.setItem(pendingKey, JSON.stringify({ envelope: manifestEnvelope(envelope), id: bundle.id } satisfies PendingUpdate));
        storage.setItem(sequenceKey, String(manifest.sequence));
        await flush();
        return 'staged';
      } catch {
        return 'unavailable';
      } finally {
        clearTimeout(timer);
        await cleanup();
        checking = false;
      }
    },
  };
}

/** The verified envelope, reduced to exactly its two signed fields for storage. */
function manifestEnvelope(envelope: unknown): SignedUpdate {
  if (!isRecord(envelope) || typeof envelope['payload'] !== 'string' || typeof envelope['signature'] !== 'string') throw new Error('Invalid signed update');
  return { payload: envelope['payload'], signature: envelope['signature'] };
}
