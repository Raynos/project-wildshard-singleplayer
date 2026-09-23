#!/usr/bin/env node
/**
 * ota-release — turn a built native web bundle (`pnpm build:native` → dist-native/) into a signed OTA channel for the
 * `wildshard-updates` Vercel project (docs/plans/NATIVE-APPS.md N-D). It never uploads; deploying the output is the
 * promote (`gh workflow run ota-promote` does both).
 *
 *   node scripts/ota-release.mjs --out <dir> --sequence <n> --native-min 1.0.0 --native-max 1.0.0 \
 *     [--dist dist-native] [--platforms ios,android] [--bundle-id <id>] [--expiry-days 30 | --expires-at <ISO>] \
 *     [--private-key <pem path>]            # else env OTA_SIGNING_KEY (PEM text), else ~/.config/wildshard/ota-signing.pem
 *     [--carry-from https://wildshard-updates.vercel.app]   # keep the live release's files servable (see below)
 *     [--placeholder]                       # sequence-0 channel that installs nothing (first deploy of the host)
 *
 * Output (a static site; deploy/ota/vercel.json is copied in as its config):
 *
 *   <out>/f/<sha256>                    every file of the bundle, content-addressed (immutable)
 *   <out>/<platform>/v1/manifest.json   {payload, signature}: RSA-PSS/SHA-256 (salt 32) over the JSON manifest
 *   <out>/release.json                  unsigned human summary (bundle id, sequence, files, bytes)
 *
 * The manifest lists EVERY file of the bundle (name, sha256, url, size). The phone copies each file whose hash matches
 * its built-in bundle or delta cache and downloads only the rest, so a code-only release costs a few MB, not 140.
 *
 * Checks before signing: the build is a native build (no service worker, has index.html + version.json); the signing
 * key's public half and the channel origin are compiled into the build's JS (else the build could never verify or
 * find its next update); every file name passes the same rule the app enforces (src/native/updates.ts).
 *
 * --carry-from: an app mid-download of the live release must still find its files after this deploy replaces the
 * site, so the live manifests are fetched, signature-checked and every file they list that this release does not is
 * downloaded (hash-checked) into <out>/f/ as well. One generation back is enough: a phone restarts its check from the
 * newest manifest on the next launch. It also refuses a sequence that does not advance past the live one.
 */
import { createHash, createPrivateKey, createPublicKey, constants, sign, verify } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PATH_SEGMENT = /^[A-Za-z0-9_@+~-][A-Za-z0-9._@+~-]*$/;
const BUNDLE_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$/;
const VERSION = /^\d{1,9}\.\d{1,9}\.\d{1,9}$/;
const PLATFORMS = ['ios', 'android'];

/** The public channel constants, parsed from src/native/ota-config.ts (the one place the app reads them). */
export function parseOtaConfig(src) {
  const pick = (re, what) => {
    const m = re.exec(src);
    if (!m) throw new Error(`ota-config.ts: cannot find ${what}`);
    return m[1];
  };
  return {
    origin: pick(/OTA_ORIGIN = '([^']+)'/, 'OTA_ORIGIN'),
    runtime: pick(/OTA_RUNTIME = '([^']+)'/, 'OTA_RUNTIME'),
    saveSchema: Number(pick(/OTA_SAVE_SCHEMA = (\d+)/, 'OTA_SAVE_SCHEMA')),
    publicN: pick(/\bn: '([A-Za-z0-9_-]+)'/, 'OTA_PUBLIC_KEY.n'),
  };
}

const channelPath = (platform) => `/${platform}/v1/manifest.json`;

/** RSA-PSS / SHA-256 / salt 32 over the exact JSON bytes. `privateKey` is a KeyObject or PEM text. */
export function signManifest(manifest, privateKey) {
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  const payload = Buffer.from(JSON.stringify(manifest));
  const signature = sign('sha256', payload, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
  return { payload: payload.toString('base64url'), signature: signature.toString('base64url') };
}

/** Verify an envelope with the public key; returns the parsed manifest or throws. */
export function openEnvelope(envelope, publicKey) {
  if (typeof envelope?.payload !== 'string' || typeof envelope?.signature !== 'string') throw new Error('Not a signed envelope');
  const payload = Buffer.from(envelope.payload, 'base64url');
  const ok = verify('sha256', payload, { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, Buffer.from(envelope.signature, 'base64url'));
  if (!ok) throw new Error('Envelope signature does not verify with this key');
  return JSON.parse(payload.toString('utf8'));
}

export function validName(name) {
  return name.length > 0 && name.length <= 512 && !name.endsWith('.br') && name.split('/').every((s) => PATH_SEGMENT.test(s));
}

/** Files that never ship in an OTA bundle. */
function excluded(rel) {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  if (rel.endsWith('.map')) return true;
  return base.startsWith('.') ? true : base === 'Thumbs.db';
}

function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, root, out);
    else if (st.isFile()) out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function loadPrivateKey(args) {
  let pem;
  if (args['private-key']) pem = readFileSync(resolve(args['private-key']));
  else if (process.env.OTA_SIGNING_KEY) pem = process.env.OTA_SIGNING_KEY;
  else {
    const fallback = join(homedir(), '.config/wildshard/ota-signing.pem');
    if (!existsSync(fallback)) throw new Error('No signing key: pass --private-key, set OTA_SIGNING_KEY, or create ~/.config/wildshard/ota-signing.pem');
    pem = readFileSync(fallback);
  }
  return pem.toString();
}

function expiry(args) {
  if (args['expires-at']) {
    const at = Date.parse(args['expires-at']);
    if (!Number.isFinite(at)) throw new Error('--expires-at must be an ISO date');
    return new Date(at).toISOString();
  }
  const days = Number(args['expiry-days'] ?? 30);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) throw new Error('--expiry-days must be 1–3650');
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Bring the live channel along (see header). For a platform being promoted, the live release's files stay servable;
 * a platform NOT being promoted keeps its live manifest byte-for-byte, plus its files. Returns what it carried.
 */
async function carry(carryFrom, publicKey, out, have, sequence, platforms) {
  const carried = [];
  const kept = [];
  for (const platform of PLATFORMS) {
    const url = new URL(channelPath(platform), carryFrom).href;
    const res = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (res.status === 404) { console.log(`carry: ${url} not found — nothing live yet`); continue; }
    if (!res.ok) throw new Error(`carry: ${url}: HTTP ${res.status}`);
    const text = await res.text();
    const live = openEnvelope(JSON.parse(text), publicKey);
    if (platforms.includes(platform)) {
      if (Number.isSafeInteger(live.sequence) && sequence <= live.sequence) throw new Error(`carry: sequence ${sequence} does not advance past the live ${platform} sequence ${live.sequence}`);
    } else {
      const path = join(out, channelPath(platform));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      kept.push(platform);
    }
    for (const f of live.files ?? []) {
      if (have.has(f.sha256)) continue;
      const buf = await fetchBuffer(new URL(`/f/${f.sha256}`, carryFrom).href);
      if (sha256(buf) !== f.sha256) throw new Error(`carry: ${f.name} hash mismatch from the live host`);
      writeFileSync(join(out, 'f', f.sha256), buf);
      have.add(f.sha256);
      carried.push(f);
    }
  }
  return { carried, kept };
}

/**
 * The pure core: validate a bundle's files, content-address them and sign one manifest per platform. No I/O.
 * `inputs` are the bundle's files (source maps / dotfiles already dropped); `privateKeyPem` is the RSA private key.
 */
export function planRelease({ config, inputs, privateKeyPem, bundleId, sequence, nativeMin, nativeMax, expiresAt, platforms, placeholder = false }) {
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'rsa' || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072) throw new Error('The OTA signing key must be RSA ≥ 3072 bits');
  const publicKey = createPublicKey(privateKey);
  if (publicKey.export({ format: 'jwk' }).n !== config.publicN) throw new Error('The signing key does not match OTA_PUBLIC_KEY in src/native/ota-config.ts');
  if (!Number.isSafeInteger(sequence) || sequence < 0 || (sequence === 0 && !placeholder)) throw new Error('--sequence must be a positive integer (0 only with --placeholder)');
  if (!VERSION.test(nativeMin ?? '') || !VERSION.test(nativeMax ?? '')) throw new Error('--native-min / --native-max must be major.minor.patch');
  if (platforms.length === 0 || platforms.some((p) => !PLATFORMS.includes(p))) throw new Error('--platforms must be ios, android or ios,android');
  if (typeof bundleId !== 'string' || !BUNDLE_ID.test(bundleId) || bundleId === 'builtin') throw new Error('Bundle id missing or invalid (pass --bundle-id or build with version.json)');
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error('The expiry must be in the future');

  const bad = inputs.filter(({ name }) => !validName(name)).map(({ name }) => name);
  if (bad.length > 0) throw new Error(`File names the app would reject:\n  ${bad.join('\n  ')}`);
  const folded = new Set();
  for (const { name } of inputs) {
    if (folded.has(name.toLowerCase())) throw new Error(`Two files differ only by case: ${name}`);
    folded.add(name.toLowerCase());
  }
  if (!folded.has('index.html')) throw new Error('The bundle has no index.html');
  if (!placeholder) {
    // The build must trust this key and know this host, or it could never verify / find the next release.
    const js = inputs.filter(({ name }) => name.endsWith('.js')).map(({ bytes }) => Buffer.from(bytes).toString('utf8'));
    if (!js.some((t) => t.includes(config.publicN))) throw new Error('The build does not contain OTA_PUBLIC_KEY — is it a native build of this tree?');
    if (!js.some((t) => t.includes(config.origin))) throw new Error(`The build does not contain the channel origin ${config.origin}`);
  }

  const blobs = new Map();
  const files = [];
  let bytes = 0;
  for (const input of inputs) {
    const hash = sha256(input.bytes);
    blobs.set(hash, input.bytes);
    files.push({ name: input.name, sha256: hash, url: `${config.origin}/f/${hash}`, size: input.bytes.length });
    bytes += input.bytes.length;
  }
  const manifests = {};
  const summary = { bundleId, sequence, expiresAt, nativeMin, nativeMax, runtime: config.runtime, saveSchema: config.saveSchema, files: files.length, bytes, carried: 0, kept: [], platforms: {} };
  for (const platform of platforms) {
    const manifest = { schema: 1, platform, nativeMin, nativeMax, runtime: config.runtime, saveSchema: config.saveSchema, bundleId, sequence, expiresAt, files };
    const envelope = signManifest(manifest, privateKey);
    openEnvelope(envelope, publicKey); // self-check
    manifests[platform] = envelope;
    summary.platforms[platform] = `${config.origin}${channelPath(platform)}`;
  }
  return { blobs, manifests, summary, publicKey };
}

/** The CLI: read dist-native/ + the key, plan, write <out>, carry the live channel along. */
export async function buildRelease(args) {
  const config = parseOtaConfig(readFileSync(args.config ?? join(ROOT, 'src/native/ota-config.ts'), 'utf8'));
  const source = resolve(args.dist ?? join(ROOT, 'dist-native'));
  if (!args.out) throw new Error('Missing --out');
  const out = resolve(args.out);
  if (out === source || out.startsWith(source + sep) || source.startsWith(out + sep)) throw new Error('--out must be outside the build directory');
  if (out === ROOT || ROOT.startsWith(out + sep)) throw new Error('--out must not be the repo or one of its parents');
  const placeholder = Boolean(args.placeholder);
  const platforms = (args.platforms ?? 'ios,android').split(',').map((p) => p.trim()).filter(Boolean);
  if (platforms.length < PLATFORMS.length && !args['carry-from']) throw new Error('Promoting one platform replaces the whole host: pass --carry-from so the other channel is kept');

  let bundleId = args['bundle-id'];
  const inputs = [];
  if (placeholder) {
    // The first deploy of the host, before any release: a valid, signed channel that installs nothing (sequence 0 is
    // never above a phone's high-water mark), so the app logs `none`, not `rejected`.
    bundleId ??= 'placeholder-0';
    inputs.push({ name: 'index.html', bytes: Buffer.from('<!doctype html><meta charset="utf-8"><title>Wildshard</title>\n') });
  } else {
    if (!existsSync(join(source, 'index.html'))) throw new Error(`${source} has no index.html — run pnpm build:native first`);
    if (existsSync(join(source, 'sw.js'))) throw new Error(`${source} has a service worker — that is a web build, not a native one`);
    const versionFile = join(source, 'version.json');
    bundleId ??= existsSync(versionFile) ? JSON.parse(readFileSync(versionFile, 'utf8')).build : undefined;
    for (const name of walk(source).filter((n) => !excluded(n))) inputs.push({ name, bytes: readFileSync(join(source, name)) });
  }
  const { blobs, manifests, summary, publicKey } = planRelease({
    config, inputs, privateKeyPem: loadPrivateKey(args), bundleId, platforms, placeholder,
    sequence: Number(args.sequence ?? (placeholder ? 0 : Number.NaN)),
    nativeMin: args['native-min'], nativeMax: args['native-max'], expiresAt: expiry(args),
  });

  // <out> is wiped: refuse anything that is not empty or an earlier release.
  const ours = new Set(['f', ...PLATFORMS, 'release.json', 'vercel.json', '.vercel']);
  if (existsSync(out) && readdirSync(out).some((e) => !ours.has(e))) throw new Error(`${out} is not empty and not an earlier release — refusing to wipe it`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'f'), { recursive: true });
  for (const [hash, bytes] of blobs) writeFileSync(join(out, 'f', hash), bytes);
  if (args['carry-from']) {
    const { carried, kept } = await carry(args['carry-from'], publicKey, out, new Set(blobs.keys()), summary.sequence, platforms);
    summary.carried = carried.length;
    summary.kept = kept;
  }
  for (const [platform, envelope] of Object.entries(manifests)) {
    const path = join(out, channelPath(platform));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(envelope)}\n`);
  }
  copyFileSync(join(ROOT, 'deploy/ota/vercel.json'), join(out, 'vercel.json'));
  writeFileSync(join(out, 'release.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`Unexpected argument ${a}`);
    const name = a.slice(2);
    if (name === 'placeholder') { args.placeholder = true; continue; }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
    args[name] = value;
    i++;
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const summary = await buildRelease(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(`ota-release: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
