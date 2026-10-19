#!/usr/bin/env node
// Separate opt-in adapter. Frozen motion4 builders, pins and runtime sources stay untouched.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { admitConchReadable } from './conch-readable-admission.mjs';
import { assertHeavyLease } from './heavy-lane-lease.mjs';

export const ROOT = resolve(import.meta.dirname, '..');
export const CANDIDATE = 'art/driftwood-isle/approved-conch/motion5-study';
export const REVIEWED_FREEZE_SHA256 = '47025e87c28ceb164115df26348d3994153b3aaa32bc4ef0bbf59de2e87b0c44';
export const FREEZE_SHA256 = '29f4f09a8c397394c532450aabe4c0b8989088beeb718d37249b5e7106213fc9';
export const FACTORY = `${CANDIDATE}/conchMotion5Preview.ts`;
export const BUILD_PIN = 'tmp/conch-motion5-preview/reviewed-build-pin.json';
export const PREVIEW = 'tmp/conch-motion5-preview/motion5';
export const DIST = 'tmp/conch-motion5-preview-dist';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => {
  const sorted = input => Array.isArray(input) ? input.map(sorted)
    : input !== null && typeof input === 'object' ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, sorted(child)])) : input;
  return JSON.stringify(sorted(value), null, 2);
};
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const relativePath = path => typeof path === 'string' && path.length > 0 && !path.includes('\\') && !path.startsWith('/') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
function read(root, path) {
  if (!relativePath(path)) throw new Error('Unsafe Conch build path');
  let target = root;
  for (const part of path.split('/')) { target = join(target, part); if (lstatSync(target).isSymbolicLink()) throw new Error('Symlink in Conch build path'); }
  return readFileSync(target);
}
/** Full conservative source inventory, excluding only package-link directories. */
export function inventory(root, directory) {
  const files = {};
  const visit = path => {
    for (const entry of readdirSync(resolve(root, path), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules') continue;
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in Conch inventory: ${child}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) files[child] = hash(read(root, child));
      else throw new Error(`Unsupported Conch inventory entry: ${child}`);
    }
  };
  visit(directory);
  return files;
}
/** Source-only native admission. It never treats the older motion4 build GO as motion5 permission. */
export function admitConchMotion5(root = ROOT) {
  const freezeBytes = read(root, `${CANDIDATE}/freeze-manifest.json`);
  if (hash(freezeBytes) !== FREEZE_SHA256) throw new Error('Conch motion5 freeze changed');
  const manifest = JSON.parse(freezeBytes);
  if (manifest.schema !== 'wildshard.conch.motion5.source-freeze.v1' || manifest.buildAllowed !== false
    || manifest.runtimeAcceptance !== false || manifest.visualAcceptance !== false || manifest.interruptedContinuityAcceptance !== false
    || !record(manifest.files) || typeof manifest.files[FACTORY] !== 'string') throw new Error('Invalid source-only motion5 freeze');
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(read(root, path)) !== expected) throw new Error(`Conch motion5 source changed: ${path}`);
  if (manifest.files[`${CANDIDATE}/freeze-reviewed.json`] !== REVIEWED_FREEZE_SHA256) throw new Error('Missing audited motion5 freeze mapping');
  const baseline = admitConchReadable(root);
  return { ...baseline, manifest };
}
export function buildInputs(root = ROOT) {
  const files = {};
  // Deliberately conservative: additions and removals invalidate permission too.
  for (const directory of ['src', 'vite', 'lint']) Object.assign(files, inventory(root, directory));
  for (const entry of readdirSync(resolve(root, 'scripts'), { withFileTypes: true })) {
    if (entry.isFile() && /\.(?:mjs|ts|json|py|sh)$/u.test(entry.name)) files[`scripts/${entry.name}`] = hash(read(root, `scripts/${entry.name}`));
  }
  for (const path of ['practice.html', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'public/assets/models/driftwood-fp/fp-arms.glb', 'public/assets/physics/rapier.wasm']) files[path] = hash(read(root, path));
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
export function validateBuildPin(root, manifest, pin) {
  if (!record(pin) || pin.schema !== 'wildshard.conch.motion5.reviewed-build-pin.v1' || pin.candidate !== manifest.candidate
    || pin.buildAllowed !== true || pin.runtimeAcceptance !== false || pin.visualAcceptance !== false || pin.colliderAcceptance !== false
    || typeof pin.rootGo !== 'string' || !pin.rootGo.trim() || !relativePath(pin.reviewPath) || !pin.reviewPath.startsWith('docs/reviews/')
    || pin.sourceFreezeSha256 !== FREEZE_SHA256 || pin.nodeVersion !== process.version || !record(pin.files)) throw new Error('Missing explicit reviewed motion5 build permission');
  if (hash(read(root, `${CANDIDATE}/freeze-manifest.json`)) !== FREEZE_SHA256) throw new Error('Reviewed motion5 freeze changed');
  if (pin.reviewSha256 !== hash(read(root, pin.reviewPath))) throw new Error('Reviewed motion5 audit changed');
  if (canonical(pin.files) !== canonical(buildInputs(root))) throw new Error('Conch motion5 build closure changed');
}
export function admitReviewedBuild(root = ROOT) {
  const admitted = admitConchMotion5(root);
  const buildPin = JSON.parse(read(root, BUILD_PIN));
  validateBuildPin(root, admitted.manifest, buildPin);
  return { ...admitted, buildPin };
}
/** Root only, after an independent audit GO. Never run implicitly as part of a build. */
export function pinReviewedBuild(reviewPath, rootGo, root = ROOT) {
  const { manifest } = admitConchMotion5(root);
  const pin = { schema: 'wildshard.conch.motion5.reviewed-build-pin.v1', candidate: manifest.candidate,
    buildAllowed: true, runtimeAcceptance: false, visualAcceptance: false, colliderAcceptance: false,
    reviewedAt: new Date().toISOString(), nodeVersion: process.version, rootGo, reviewPath,
    sourceFreezeSha256: FREEZE_SHA256, reviewSha256: hash(read(root, reviewPath)), files: buildInputs(root) };
  validateBuildPin(root, manifest, pin);
  safeOutputParents(resolve(root, BUILD_PIN));
  mkdirSync(dirname(resolve(root, BUILD_PIN)), { recursive: true });
  writeFileSync(resolve(root, BUILD_PIN), `${canonical(pin)}\n`, { flag: 'wx' });
  return pin;
}
function safeOutputParents(path) {
  for (let target = dirname(path); target !== dirname(target); target = dirname(target)) {
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new Error('Symlink in Conch output parent');
  }
}
function emptyDestination(path) {
  safeOutputParents(path);
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory() || readdirSync(path).length > 0)) throw new Error('Conch output must be new or empty');
}
/** Only fixed new motion5 locations can be written; arbitrary source/output overrides are unsupported. */
export async function buildConchMotion5Preview() {
  if (resolve('.') !== ROOT) throw new Error('Run motion5 adapter from repository root');
  assertHeavyLease('build');
  const { receipt, metadata, payload, manifest, buildPin } = admitReviewedBuild();
  const destination = resolve(ROOT, PREVIEW), project = resolve(ROOT, 'src/shards/driftwood-isle');
  emptyDestination(destination);
  const { build } = await import('vite');
  const { rapierAlias } = await import('../vite/rapier.ts');
  const { decisionLegacyLines } = await import('./decision-legacy-lines.mjs');
  const { shardfileValidationRevision } = await import('./shardfile-validation-revision.mjs');
  const packed = resolve(destination, 'pack'), productDirectory = resolve(destination, 'product');
  mkdirSync(packed, { recursive: true });
  writeFileSync(resolve(packed, 'metadata.json'), JSON.stringify(metadata));
  writeFileSync(resolve(packed, 'payload.bin'), payload);
  const authorRequire = createRequire(resolve(ROOT, 'src/sdk/package.json'));
  const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent',
    define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(ROOT)),
      'import.meta.dirname': JSON.stringify(resolve(ROOT, 'src/sdk')) },
    plugins: [{ name: 'practice-author-node', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
      return null;
    } }],
    build: { write: false, minify: false, lib: { entry: resolve(ROOT, FACTORY), formats: ['es'], fileName: 'conch-motion5-preview-product' },
      rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
  });
  const output = Array.isArray(result) ? result.at(0) : result;
  if (output === undefined || !('output' in output)) throw new Error('Practice author bundle produced no output');
  const chunks = output.output.filter(chunk => chunk.type === 'chunk'), chunk = chunks.at(0);
  if (chunks.length !== 1 || chunk === undefined) throw new Error('Practice author bundle must contain one module');
  const author = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof author.buildConchMotion5PreviewProduct !== 'function') throw new Error('Motion5 factory export is missing');
  const lines = decisionLegacyLines(ROOT, 'driftwood-isle');
  if (lines === undefined) throw new Error('Practice decisions require the sealed Driftwood line budget');
  const product = await author.buildConchMotion5PreviewProduct(project, productDirectory, { decisionLegacyLines: lines }, metadata);
  assertCandidatePose(ROOT, product.index, productDirectory);
  admitReviewedBuild(); // Refuse a source mutation during build, leaving the failed attempt intact.
  writeFileSync(resolve(destination, 'preview.json'), `${canonical({
    schema: 'wildshard.conch.native-preview.v1', candidate: manifest.candidate, mode: 'motion5',
    admission: receipt, sourceFreeze: manifest, buildPin, metadataSha256: hash(readFileSync(resolve(packed, 'metadata.json'))),
    packedSha256: hash(payload), bodyFile: metadata.file, sourceHash: product.index.build.sourceHash,
    productFiles: inventory(destination, 'product'),
    colliderAcceptance: false, visualAcceptance: false, runtimeAcceptance: false,
  })}\n`, { flag: 'wx' });
  return product.index;
}
export function assertCandidatePose(root, index, product) {
  const rows = index.files.filter(file => file.name === 'poses/conch-duelist.json');
  const row = rows.at(0);
  if (rows.length !== 1 || row === undefined || !relativePath(row.path)) throw new Error('Missing unique motion5 pose payload');
  const bytes = read(product, row.path);
  if (hash(bytes) !== row.hash || canonical(JSON.parse(bytes)) !== canonical(JSON.parse(read(root, `${CANDIDATE}/poses.json`)))) throw new Error('Product is not the frozen motion5 pose');
}

// Same real practice entry and virtual tables as motion4; only the admitted candidate tuple differs.
export async function conchMotion5PreviewConfig() {
  if (resolve('.') !== ROOT) throw new Error('Run motion5 adapter from repository root');
  const { rapierAlias, rapierPreviewPlugin } = await import('../vite/rapier.ts');
  const { starterArmClipsTableSource } = await import('./gen-starter-arm-clips.mjs');
  const { starterEffectsTableSource } = await import('./gen-starter-effects.mjs');
  assertHeavyLease('build');
  const admitted = admitReviewedBuild(ROOT);
  const manifest = admitted.manifest;
  if (typeof manifest !== 'object' || manifest === null || !('candidate' in manifest) || typeof manifest.candidate !== 'string') throw new Error('Invalid Conch source candidate');
  const preview = resolve(ROOT, PREVIEW);
  const product = resolve(join(preview, 'product'));
  const outDir = resolve(ROOT, DIST);
  let destinationRoot = outDir;
  let bundleWritten = false;
  const indexBytes = readFileSync(join(product, 'shard.json'));
  const receipt = JSON.parse(readFileSync(join(product, 'validation.json'), 'utf8'));
  if (typeof receipt !== 'object' || receipt === null || !('indexHash' in receipt) ||
      receipt.indexHash !== createHash('sha256').update(indexBytes).digest('hex') || !('revision' in receipt) || typeof receipt.revision !== 'string')
    throw new Error('Practice product needs its exact validated receipt');
  const bake = JSON.parse(readFileSync(join(preview, 'pack/metadata.json'), 'utf8'));
  if (typeof bake !== 'object' || bake === null || !('file' in bake) || typeof bake.file !== 'string' ||
      !/^\/assets\/driftwood-isle\/conch-canonical-[a-f0-9]{64}\.bin$/u.test(bake.file)) throw new Error('Invalid fixture body asset');
  const receiptPreview = JSON.parse(readFileSync(join(preview, 'preview.json'), 'utf8'));
  const hashFile = path => hash(readFileSync(path));
  if (typeof receiptPreview !== 'object' || receiptPreview === null || !('metadataSha256' in receiptPreview) || !('packedSha256' in receiptPreview) || typeof receiptPreview.packedSha256 !== 'string'
    || receiptPreview.metadataSha256 !== hashFile(join(preview, 'pack/metadata.json')) || receiptPreview.packedSha256 !== hashFile(join(preview, 'pack/payload.bin'))
    || !bake.file.includes(receiptPreview.packedSha256)) throw new Error('Native preview body receipt mismatch');
  if (!('mode' in receiptPreview) || receiptPreview.mode !== 'motion5'
    || !('candidate' in receiptPreview) || receiptPreview.candidate !== manifest.candidate) throw new Error('Unknown Conch tuple');
  if (canonical(bake) !== canonical(admitted.metadata)
    || !('admission' in receiptPreview) || canonical(receiptPreview.admission) !== canonical(admitted.receipt)) throw new Error('Conch app tuple differs from admission');
  if (!('buildPin' in receiptPreview) || canonical(receiptPreview.buildPin) !== canonical(admitted.buildPin)
    || !('sourceFreeze' in receiptPreview) || canonical(receiptPreview.sourceFreeze) !== canonical(admitted.manifest)) throw new Error('Reviewed Conch build pin mismatch');
  if (!('productFiles' in receiptPreview) || canonical(receiptPreview.productFiles) !== canonical(inventory(preview, 'product')))
    throw new Error('Motion5 product inventory changed');
  const index = JSON.parse(indexBytes);
  if (receiptPreview.sourceHash !== index.build.sourceHash || receiptPreview.bodyFile !== bake.file
    || receiptPreview.visualAcceptance !== false || receiptPreview.runtimeAcceptance !== false || receiptPreview.colliderAcceptance !== false)
    throw new Error('Motion5 product receipt mismatch');
  assertCandidatePose(ROOT, index, product);
  const mode = 'motion5', candidate = manifest.candidate;
  const bodyFile = bake.file.slice(1);
  const assets = [ 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm'];
  // The isolated entry must not require ignored production boot tables in a clean source export.
  // These virtual tables describe only files this preview actually copies, from their real bytes.
  const bytes = {}, versions = {};
  const include = (url , path )       => {
    const data = readFileSync(path); bytes[url] = data.byteLength;
    versions[url] = createHash('sha256').update(data).digest('hex').slice(0, 8);
  };
  for (const asset of assets) include(`/${asset}`, join('public', asset));
  include(`/${bodyFile}`, join(preview, 'pack/payload.bin'));
  const visit = (directory , url )       => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), target = `${url}/${entry.name}`;
      if (entry.isDirectory()) visit(path, target); else include(target, path);
    }
  };
  visit(product, '/practice-product');
  const tables = new Map([
    [resolve('src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
    [resolve('src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
    [resolve('src/game/boot/bytes.generated'), `export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
    [resolve('src/game/boot/versions.generated'), `export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
  ]);
  return { publicDir: false, base: './', resolve: { alias: rapierAlias },
    define: { __DEVSERVER__: true, __BUILD_ID__: JSON.stringify(`conch-native-${candidate}-unaccepted-${mode}`), __SAVE_NAMESPACES__: '[]',
      __SHARDFILE_VALIDATOR__: JSON.stringify(receipt.revision), __SHARDFILE_VERDICTS__: JSON.stringify([receipt]) },
    build: { outDir, target: 'es2022', sourcemap: false, cssCodeSplit: false,
      rolldownOptions: { input: resolve('practice.html') } },
    plugins: [rapierPreviewPlugin(), {
      name: 'conch-motion5-preview-asset-tables',
      resolveId(source, importer) {
        if (importer === undefined || !source.startsWith('.')) return null;
        const path = resolve(dirname(importer), source).replace(/\.ts$/u, '');
        return tables.has(path) ? `\0conch-preview-table:${path}.ts` : null;
      },
      load(id) { return id.startsWith('\0conch-preview-table:') ? tables.get(id.slice('\0conch-preview-table:'.length).replace(/\.ts$/u, '')) ?? null : null; },
    }, { name: 'conch-motion5-preview-closure',
      transformIndexHtml(html) { return html.replace('Wildshard practice demo', `Conch ${candidate} · UNACCEPTED WIP`).replace('Developer arena · rejected meshes', `Conch ${candidate} · UNACCEPTED WIP`).replace('These five creature meshes were rejected. Approved replacement art is still in progress.', 'One unaccepted native Conch candidate. Diagnostic pose and collider dimensions are experimental.').replace('</head>', '<style>.ws-practice-demo{top:calc(env(safe-area-inset-top,0px) + 108px);left:max(8px,env(safe-area-inset-left,0px));right:max(8px,env(safe-area-inset-right,0px))}.ws-native-preview-note{display:block;font-size:10px;margin-bottom:3px}</style></head>').replace('<section class="ws-practice-demo">', `<section class="ws-practice-demo"><small class="ws-native-preview-note">${mode} · actual-engine arena · collider tuning unaccepted</small>`); }, configResolved(config) {
        destinationRoot = config.build.outDir;
        emptyDestination(destinationRoot);
      }, writeBundle() { bundleWritten = true; }, closeBundle() {
      // Rollup also closes a failed build; never mask its original diagnostic with missing output copies.
      if (!bundleWritten) return;
      copyFileSync(join(destinationRoot, 'practice.html'), join(destinationRoot, 'index.html'));
      copyFileSync(join(preview, 'preview.json'), join(destinationRoot, 'conch-preview.json'));
      const bodyDestination = join(destinationRoot, bodyFile); mkdirSync(dirname(bodyDestination), { recursive: true });
      copyFileSync(join(preview, 'pack/payload.bin'), bodyDestination);
      cpSync(product, join(destinationRoot, 'practice-product'), { recursive: true });
      for (const asset of assets) { const destination = join(destinationRoot, asset); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join('public', asset), destination); }
    } }],
  };
}

export async function buildConchMotion5App() {
  assertHeavyLease('build');
  emptyDestination(resolve(ROOT, DIST));
  const config = await conchMotion5PreviewConfig();
  const { build } = await import('vite');
  await build({ ...config, configFile: false });
  await conchMotion5PreviewConfig(); // Revalidate the exact source and product tuple after compilation.
  const files = inventory(ROOT, DIST);
  writeFileSync(resolve(ROOT, DIST, 'motion5-host-files.json'), `${canonical({
    schema: 'wildshard.conch.motion5.host-files.v1', sourceFreezeSha256: FREEZE_SHA256,
    previewSha256: hash(read(ROOT, `${DIST}/conch-preview.json`)),
    files: Object.fromEntries(Object.entries(files).map(([path, digest]) => [path.slice(DIST.length + 1), digest])),
    visualAcceptance: false, runtimeAcceptance: false, colliderAcceptance: false,
  })}\n`, { flag: 'wx' });
}
const command = process.argv.at(1);
if (command !== undefined && import.meta.url === pathToFileURL(resolve(command)).href) {
  try {
    if (resolve('.') !== ROOT) throw new Error('Run motion5 adapter from repository root');
    const action = process.argv.at(2), review = process.argv.at(3), go = process.argv.at(4);
    if (process.argv.length > 5) throw new Error('Unexpected motion5 adapter arguments');
    if (action === '--pin-reviewed' && review !== undefined && go !== undefined) {
      pinReviewedBuild(review, go);
      console.info(JSON.stringify({ pin: BUILD_PIN, buildAllowed: true, runtimeAcceptance: false }));
    } else if (review !== undefined || go !== undefined) throw new Error('Unexpected motion5 adapter arguments');
    else if (action === '--check-source') {
      const { manifest } = admitConchMotion5();
      console.info(JSON.stringify({ candidate: manifest.candidate, freezeSha256: FREEZE_SHA256, buildAllowed: false }));
    } else if (action === '--check-pin') {
      admitReviewedBuild(); console.info(JSON.stringify({ exactPin: true, runtimeAcceptance: false }));
    } else if (action === '--product') await buildConchMotion5Preview();
    else if (action === '--app') await buildConchMotion5App();
    else throw new Error('Usage: --check-source | --pin-reviewed docs/reviews/<audit> "root GO reference" | --check-pin | --product | --app');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
