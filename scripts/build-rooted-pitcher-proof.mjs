#!/usr/bin/env node
/** One root-pinned ISOLATED engineering build. No production entry, public product or selected model is changed. */
import { build } from 'vite';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertHeavyLease } from './heavy-lane-lease.mjs';
import { decisionLegacyLines } from './decision-legacy-lines.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { starterArmClipsTableSource } from './gen-starter-arm-clips.mjs';
import { starterEffectsTableSource } from './gen-starter-effects.mjs';
import { rapierAlias, rapierPreviewPlugin } from '../vite/rapier.ts';
import { ROOT, OUTPUT, CANONICAL, PIN, hash, inventory, verifyPin, isolatedProofBuildOptions } from './rooted-pitcher-proof-pin.mjs';
import { rootedPitcherProofComposition, assertRootedPitcherProofComposition } from './rooted-pitcher-proof-composition.ts';

assertHeavyLease('build');
const pin = verifyPin(), destination = resolve(ROOT, OUTPUT), product = join(destination, 'product'), dist = join(destination, 'dist');
if (existsSync(destination)) throw new Error('Preserve prior proof: output root must not exist');
mkdirSync(destination, { recursive: true });
const sourceFiles = {}, isolatedOptions = isolatedProofBuildOptions();
const watchInputs = () => ({ name: 'native-owner-proof-source-receipt',
  load(id) {
    const path = id.split('?')[0];
    if (path?.startsWith(`${ROOT}/`) && !path.includes('/node_modules/') && existsSync(path)) {
      const key = path.slice(ROOT.length + 1), digest = hash(readFileSync(path));
      if ((pin.sourceFiles[key] ?? pin.files[key]) !== digest) throw new Error(`Unpinned build source: ${key}`);
      if (sourceFiles[key] !== undefined && sourceFiles[key] !== digest) throw new Error(`Build source changed during read: ${key}`);
      sourceFiles[key] = digest;
    }
    return null;
  },
});
const authorRequire = createRequire(resolve(ROOT, 'src/sdk/package.json'));
const authorResult = await build({ ...isolatedOptions, configFile: false, publicDir: false, logLevel: 'silent', resolve: { alias: rapierAlias },
  define: { ...isolatedOptions.define, __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(ROOT)), 'import.meta.dirname': JSON.stringify(resolve(ROOT, 'src/sdk')) },
  plugins: [watchInputs(), { name: 'native-owner-proof-author', enforce: 'pre', resolveId(id) {
    if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
    if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
    return null;
  } }],
  build: { write: false, minify: false, lib: { entry: resolve(ROOT, 'src/shards/driftwood-isle/generators/rootedPitcherProof.ts'), formats: ['es'] },
    rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
});
const authorOutput = Array.isArray(authorResult) ? authorResult.at(0) : authorResult;
if (authorOutput === undefined || !('output' in authorOutput)) throw new Error('Missing proof author output');
const chunks = authorOutput.output.filter(row => row.type === 'chunk');
if (chunks.length !== 1) throw new Error('Proof author must be one module');
const author = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
if (typeof author.buildRootedPitcherProofProduct !== 'function') throw new Error('Missing proof author');
const metadataBytes = readFileSync(resolve(ROOT, CANONICAL, 'core-runtime-study/metadata.json'));
const metadata = JSON.parse(metadataBytes);
const lines = decisionLegacyLines(ROOT, 'driftwood-isle');
if (lines === undefined) throw new Error('Missing unchanged admitted decision budget');
await author.buildRootedPitcherProofProduct(resolve(ROOT, 'src/shards/driftwood-isle'), product, { decisionLegacyLines: lines }, metadataBytes);
const indexBytes = readFileSync(join(product, 'shard.json')), index = JSON.parse(indexBytes), validation = JSON.parse(readFileSync(join(product, 'validation.json')));
if (validation.indexHash !== hash(indexBytes) || typeof validation.revision !== 'string') throw new Error('Invalid exact product receipt');
const payloadPath = resolve(ROOT, CANONICAL, 'v3/payload.bin'), bodyFile = metadata.file.slice(1);
if (metadata.file !== `/assets/driftwood-isle/brine-pitcher-native-${hash(readFileSync(payloadPath))}.bin`) throw new Error('Canonical payload identity mismatch');
const assets = ['assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm'];
const bytes = {}, versions = {};
const include = (url, path) => { const data = readFileSync(path); bytes[url] = data.byteLength; versions[url] = hash(data).slice(0, 8); };
for (const asset of assets) include(`/${asset}`, resolve(ROOT, 'public', asset));
include(`/${bodyFile}`, payloadPath);
for (const path of Object.keys(inventory(product))) include(`/practice-product/${path}`, join(product, path));
const tables = new Map([
  [resolve(ROOT, 'src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
  [resolve(ROOT, 'src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
  [resolve(ROOT, 'src/game/boot/bytes.generated'), `export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
  [resolve(ROOT, 'src/game/boot/versions.generated'), `export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
]);
await build({ ...isolatedOptions, configFile: false, publicDir: false, base: './', resolve: { alias: rapierAlias },
  define: { ...isolatedOptions.define, __DEVSERVER__: true, __BUILD_ID__: JSON.stringify(`WIP-ROOTED-PITCHER-${hash(readFileSync(resolve(ROOT, PIN))).slice(0, 12)}`),
    __SAVE_NAMESPACES__: '[]', __SHARDFILE_VALIDATOR__: JSON.stringify(validation.revision), __SHARDFILE_VERDICTS__: JSON.stringify([validation]) },
  build: { outDir: dist, target: 'es2022', sourcemap: false, cssCodeSplit: false, rolldownOptions: { input: resolve(ROOT, 'rooted-pitcher-proof.html') } },
  plugins: [watchInputs(), rapierPreviewPlugin(), rootedPitcherProofComposition(ROOT, tables)],
});
copyFileSync(join(dist, 'rooted-pitcher-proof.html'), join(dist, 'index.html'));
cpSync(product, join(dist, 'practice-product'), { recursive: true });
for (const [from, relative] of [[payloadPath, bodyFile], ...assets.map(path => [resolve(ROOT, 'public', path), path])]) {
  const target = join(dist, relative); mkdirSync(dirname(target), { recursive: true }); copyFileSync(from, target);
}
verifyPin();
for (const [path, digest] of Object.entries(sourceFiles)) if (hash(readFileSync(resolve(ROOT, path))) !== digest) throw new Error(`Build source changed: ${path}`);
assertRootedPitcherProofComposition(sourceFiles, { 'src/rootedPitcherProof.ts': pin.files['src/rootedPitcherProof.ts'], 'src/rootedPitcherProofBoot.ts': pin.files['src/rootedPitcherProofBoot.ts'] });
const receipt = { schema: 'wildshard.rooted-pitcher.isolated-host.v1', synthetic: false, modelAdmission: false, publicAdmission: false,
  pin, pinSha256: hash(readFileSync(resolve(ROOT, PIN))), sourceHash: index.build.sourceHash,
  productFiles: inventory(product), sourceFiles, hostFiles: inventory(dist),
  limits: 'WIP ROOTED PITCHER; SOURCE-BODY LIVING COLLISION; HELD DEATH/NO FOLD; NOT ADMITTED. Exact retained seven-bone source and real two-strike combat.' };
writeFileSync(join(dist, 'rooted-pitcher-proof.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
console.info(JSON.stringify({ destination: OUTPUT, sourceHash: index.build.sourceHash, receiptSha256: hash(readFileSync(join(dist, 'rooted-pitcher-proof.json'))), synthetic: false, modelAdmission: false, publicAdmission: false }));
