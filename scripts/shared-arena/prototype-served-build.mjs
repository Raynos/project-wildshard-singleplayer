import { build } from 'vite';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join, relative, sep, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { rapierAlias, rapierPreviewPlugin } from '../../vite/rapier.ts';
import { assertHeavyLease } from '../../scripts/heavy-lane-lease.mjs';
import { starterArmClipsTableSource } from '../../scripts/gen-starter-arm-clips.mjs';
import { starterEffectsTableSource } from '../../scripts/gen-starter-effects.mjs';
import { shardfileValidationRevision } from '../../scripts/shardfile-validation-revision.mjs';
import { retainedCandidateProducts, digest, inventory, ACCEPTANCE, candidateBuildPolicy, reserveOutput, pinnedBytes, writePinnedOutput, verifyPinnedOutputs, safeFile } from './candidate-inputs.mjs';

import { prototypeSnapshot, NINE } from './prototype-inputs.mjs';
import { isDeepStrictEqual } from 'node:util';

assertHeavyLease('build');
const root = resolve('.');
// Fix Vite's production decision; do not retain or log ambient values.
process.env.NODE_ENV = 'production';
const policy = candidateBuildPolicy();
const [hostRoot, sourceHostArg, destination, snapshotPath, permissionPath] = process.argv.slice(2);
if (process.argv.length !== 7) throw new Error('Usage: prototype-served-build.mjs RETAINED_HOST EXACT_SELF_CONTAINED_HOST NEW_OUTPUT SNAPSHOT ROOT_PERMISSION');
const outDir = resolve(destination), sourceHost = realpathSync(sourceHostArg);
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const permission = JSON.parse(readFileSync(permissionPath, 'utf8'));
const sourceReceiptBytes = readFileSync(safeFile(sourceHost, 'prototype-nine-build.json'));
const sourceInventoryBytes = readFileSync(safeFile(sourceHost, 'candidate-inventory.json'));
const sourceReceipt = JSON.parse(sourceReceiptBytes), sourceInventory = JSON.parse(sourceInventoryBytes);
function assertSource() {
  const actual = inventory(sourceHost); delete actual['candidate-inventory.json'];
  if (digest(readFileSync(safeFile(sourceHost, 'prototype-nine-build.json'))) !== permission.sourceReceiptSha256
    || digest(readFileSync(safeFile(sourceHost, 'candidate-inventory.json'))) !== permission.sourceInventorySha256
    || !isDeepStrictEqual(actual, sourceInventory.files)
    || sourceReceipt.schema !== 'wildshard.prototype-nine.build.v1'
    || !isDeepStrictEqual(sourceReceipt.products.map(row => row.id), NINE)
    || sourceReceipt.products.some(row => row.currentSdkValidation !== 'passed')) throw new Error('Self-contained source receipt/inventory mismatch');
}
if (permission.schema !== 'wildshard.prototype-nine.served-permission.v1' || permission.reviewedBy !== 'root'
  || permission.buildAllowed !== true || permission.localOnly !== true || permission.admitted !== false
  || typeof permission.rootGo !== 'string' || !permission.rootGo.trim()
  || !isDeepStrictEqual(permission.acceptance, ACCEPTANCE) || !isDeepStrictEqual(permission.products, NINE)
  || permission.sourceSnapshotSha256 !== digest(Buffer.from(JSON.stringify(snapshot)))
  || permission.hostRoot !== realpathSync(hostRoot) || permission.sourceHost !== sourceHost || permission.destination !== outDir
  || dirname(outDir) !== resolve(root, 'tmp') || !/^prototype-nine-[a-z0-9][a-z0-9-]*$/u.test(basename(outDir))
  || existsSync(outDir)) throw new Error('Missing exact new served-build root permission');
assertSource();
const reuse = JSON.parse(readFileSync(safeFile(root, 'docs/reviews/shared-enemy-arena/reuse-proposal.json')));
const reused = new Map();
const bundledOpaque = reuse.otherExactDuplicates.filter(row => row.path === 'assets/basis_transcoder-VXdx5NbI.wasm');
if (bundledOpaque.length !== 1) throw new Error('Expected exact basis WASM');
function assertReuse() {
  for (const row of [...reuse.productFiles, ...reuse.explicitRuntimeAssets]) {
    if (!/^\/(?:mantis|conch|colossus|puffer)-engine\//u.test(row.url) || /\.(?:js|css|html)$/u.test(row.path)) throw new Error('Executable or unknown fallback reuse refused');
    const bytes = pinnedBytes(hostRoot, row.url.slice(1), row.sha256);
    if (bytes.length !== row.bytes || sourceInventory.files[row.path] !== row.sha256) throw new Error(`Source/fallback reuse mismatch: ${row.path}`);
  }
  for (const row of bundledOpaque) {
    if (pinnedBytes(hostRoot, row.candidateUrl.slice(1), row.sha256).length !== row.bytes
      || sourceInventory.files[row.path] !== row.sha256) throw new Error('Bundled opaque source/fallback mismatch');
  }
}
for (const row of [...reuse.productFiles, ...reuse.explicitRuntimeAssets]) {
  if (reused.has(`/${row.path}`)) throw new Error('Duplicate reuse source');
  reused.set(`/${row.path}`, row);
}
const opaqueRoutes = Object.fromEntries(reuse.explicitRuntimeAssets.map(row => [`/${row.path}`, row.url]));
const productBases = { ...reuse.productBases };
for (const row of snapshot.catalogue) {
  if (Object.hasOwn(opaqueRoutes, row.bodyFile)) throw new Error('Prototype asset collision');
  opaqueRoutes[row.bodyFile] = row.bodyFile.slice(1); productBases[row.id] = `products/${row.id}/`;
}
assertReuse();
const assertUnchanged = () => { if (JSON.stringify(prototypeSnapshot(root)) !== JSON.stringify(snapshot)) throw new Error('Candidate source/dependency closure changed since root review'); };
assertUnchanged();
const entries = retainedCandidateProducts(root, hostRoot);
// Refuse a reviewed source closure which silently expands the active runtime roster.
const boot = readFileSync(resolve(root, 'practice/prototype-nine/boot.ts'), 'utf8');
const catalogue = /const catalogue = \[([\s\S]*?)\] as const;/u.exec(boot)?.[1];
if (!catalogue || JSON.stringify([...catalogue.matchAll(/id: '([^']+)'/gu)].map(match => match[1])) !== JSON.stringify(NINE)) throw new Error('Prototype runtime catalogue is not the exact nine');
// Any real module outside the reviewed conservative closure is an error, not an implicit dependency.
const frozenModules = () => ({ name: 'candidate-reviewed-module-closure', generateBundle() {
  for (const id of this.getModuleIds()) {
    if (!id.startsWith('/')) continue;
    const path = id.split('?')[0];
    if (!existsSync(path)) throw new Error(`Unresolved candidate module path: ${id}`);
    const name = relative(root, realpathSync(path)).split(sep).join('/');
    if (snapshot.files[name] !== digest(readFileSync(path))) throw new Error(`Unreviewed candidate module: ${name}`);
  }
} });
const revision = shardfileValidationRevision(root);
// Reuse exact authored products from the finished candidate, without rebaking models.
const productTemp = realpathSync(sourceReceipt.productTemp);
for (const row of snapshot.catalogue) {
  const host = resolve(productTemp, row.id), product = resolve(host, 'practice-product');
  const productFiles = inventory(product);
  const copied = Object.fromEntries(Object.entries(sourceInventory.files).filter(([name]) => name.startsWith(`products/${row.id}/`)).map(([name, hash]) => [name.slice(`products/${row.id}/`.length), hash]));
  if (!isDeepStrictEqual(productFiles, copied)) throw new Error(`Author/candidate product mismatch: ${row.id}`);
  const pins = Object.fromEntries(Object.entries(productFiles).map(([name, hash]) => [`practice-product/${name}`, hash]));
  const indexBytes = readFileSync(safeFile(host, 'practice-product/shard.json'));
  const index = JSON.parse(indexBytes), validation = JSON.parse(readFileSync(safeFile(host, 'practice-product/validation.json')));
  if (validation.indexHash !== digest(indexBytes) || validation.revision !== revision
    || sourceReceipt.products.find(entry => entry.id === row.id)?.sourceHash !== index.build.sourceHash) throw new Error('Invalid exact prototype validation receipt');
  const read = name => {
    const rows = index.files.filter(file => file.name === name);
    if (rows.length !== 1) throw new Error(`Missing or duplicate prototype file: ${name}`);
    return JSON.parse(readFileSync(safeFile(product, rows[0].path)));
  };
  const bodies = read('practice/bodies.json'), looks = read('practice/looks.json');
  if (bodies.bodies.length !== 1 || bodies.bodies[0].kind !== row.kind || bodies.bodies[0].variant !== row.variant || bodies.file !== row.bodyFile || looks.looks.length !== 1 || looks.looks[0].kind !== row.kind) throw new Error('Prototype body identity mismatch');
  entries.push({ id: row.id, host, index, validation, bodies, looks, pins, prototype: row,
    preview: { bodyFile: row.bodyFile, candidate: 'WIP prototype', mode: 'simplified-combat-despawn' } });
}
// Current unchanged SDK validates all nine exact products, not merely historic receipts.
const require = createRequire(resolve('src/sdk/package.json'));
const validated = await build({ ...policy, logLevel: 'warn', resolve: { alias: rapierAlias },
  define: { ...policy.define, __SHARDFILE_VALIDATOR__: JSON.stringify(revision), 'import.meta.dirname': JSON.stringify(resolve('src/sdk')) },
  plugins: [frozenModules(), { name: 'shared-arena-node-validation', enforce: 'pre', resolveId(id) {
    if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
    if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(require.resolve(id)).href, external: true };
    return null;
  } }],
  build: { write: false, minify: false, lib: { entry: resolve('practice/shared-arena/validate.ts'), formats: ['es'] },
    rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
});
const result = Array.isArray(validated) ? validated[0] : validated;
const chunks = result.output.filter(row => row.type === 'chunk');
if (chunks.length !== 1) throw new Error('Arena validator must be one module');
const validator = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
const hashes = validator.validateArenaProducts(entries.map(row => resolve(row.host, 'practice-product')));
if (hashes.length !== 9 || hashes.some((hash, i) => hash !== entries[i].index.build.sourceHash)) throw new Error('Current SDK source identity mismatch');
assertUnchanged(); assertSource(); assertReuse();
const reservation = reserveOutput(outDir);
const contentKeys = new Set();
for (const entry of entries) for (const look of entry.looks.looks) for (const key of [`look:${look.id}`, `species:${look.species}`, `kind:${look.kind}`]) {
  if (contentKeys.has(key)) throw new Error(`Duplicate nine-product content key: ${key}`);
  contentKeys.add(key);
}
// Shared arms, pickup catalogue, materials and lighting must agree before they can share registration.
const fileJson = (entry,name) => { const file=entry.index.files.find(row=>row.name===name); return JSON.parse(readFileSync(resolve(entry.host,'practice-product',file.path))); };
const section = (entry,name) => { const sectionRow=entry.index.sections.find(row=>row.name===name); return JSON.parse(readFileSync(resolve(entry.host,'practice-product',sectionRow.path))); };
for (const entry of entries.slice(1)) {
  for (const name of ['practice/pickups.json']) if (JSON.stringify(fileJson(entry,name))!==JSON.stringify(fileJson(entries[0],name))) throw new Error(`Arena shared data differs: ${name}`);
  if (JSON.stringify(entry.looks.arenaLighting)!==JSON.stringify(entries[0].looks.arenaLighting)) throw new Error('Arena lighting mismatch');
  for (const name of ['held/arms','look/materials','look/look']) if (JSON.stringify(section(entry,name))!==JSON.stringify(section(entries[0],name))) throw new Error(`Arena shared presentation mismatch: ${name}`);
}
const assets = new Map(), bytes = {}, versions = {}, copiedPins = {};
const include = (url, entry, name) => {
  const expected = entry.pins[name], data = pinnedBytes(entry.host, name, expected);
  if (assets.has(url) && digest(assets.get(url)) !== expected) throw new Error(`Shared asset collision: ${url}`);
  assets.set(url, data); copiedPins[url.slice(1)] = expected;
  bytes[url] = data.length; versions[url] = expected.slice(0, 8);
};
for (const entry of entries) {
  if (entry.prototype) {
    const row = entry.prototype, data = pinnedBytes(root, row.payloadPath, row.payloadSha256), url = row.bodyFile;
    if (assets.has(url)) throw new Error(`Duplicate prototype body asset: ${url}`);
    assets.set(url, data); copiedPins[url.slice(1)] = row.payloadSha256;
    bytes[url] = data.length; versions[url] = row.payloadSha256.slice(0, 8);
  } else for (const asset of [entry.preview.bodyFile.slice(1), 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm']) include(`/${asset}`, entry, asset);
  for (const name of Object.keys(entry.pins)) if (name.startsWith('practice-product/')) include(`/products/${entry.id}/${name.slice(17)}`, entry, name);
  if (entry.previewFile) include(`/${entry.previewFile}`, entry, entry.previewFile);
}
const tables = new Map([
 [resolve('src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
 [resolve('src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
 [resolve('src/game/boot/bytes.generated'),`export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
 [resolve('src/game/boot/versions.generated'),`export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
]);
const template = readFileSync(resolve('practice/prototype-nine/arena.html'), 'utf8')
 .replace('./page.ts', '/practice/prototype-nine/page.ts')
 .replace('../shared-arena/page.css', '/practice/shared-arena/page.css')
 .replace('../shared-arena/arena-compact.css', '/practice/shared-arena/arena-compact.css')
 .replace('<head>', `<head><link rel="icon" href="data:,"><meta http-equiv="Content-Security-Policy" content="connect-src 'self'">`)
 .replace('<body>', '<body><div role="status" style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#8b0000;color:white;text-align:center;font:700 12px sans-serif;pointer-events:none">WIP PROTOTYPES · QUALITY INCOMPLETE</div>');
assertUnchanged();
reservation.assert(true);
const bundled = await build({ ...policy, resolve:{alias:rapierAlias},
 experimental: { renderBuiltUrl(filename) { return bundledOpaque.find(row => row.path === filename)?.candidateUrl; } },
 define:{...policy.define,__DEVSERVER__:true,__BUILD_ID__:JSON.stringify('WIP-prototype-nine-NOT-YET-PLAYTESTED'),__SAVE_NAMESPACES__:'[]',__SHARDFILE_VALIDATOR__:JSON.stringify(revision),__SHARDFILE_VERDICTS__:JSON.stringify(entries.map(row=>row.validation))},
 build:{write:false,outDir,emptyOutDir:false,target:'es2022',sourcemap:false,cssCodeSplit:false,rolldownOptions:{input:resolve('practice.html')}},
 plugins:[frozenModules(),rapierPreviewPlugin(),{name:'shared-arena-entry',transformIndexHtml:{order:'pre',handler:()=>template},
 resolveId(source,importer){if(!importer||!source.startsWith('.'))return null;const path=resolve(dirname(importer),source).replace(/\.ts$/u,'');return tables.has(path)?`\0shared-arena:${path}`:null;},
 transform(source, id) {
  if (id === resolve('src/practiceAssets.ts')) return `const routes = ${JSON.stringify(opaqueRoutes)};
export function practiceAssetUrl(path, pageUrl = document.baseURI) {
  const route = routes[path]; if (route === undefined) throw new Error('Unmapped opaque arena asset: ' + path);
  return new URL(route, pageUrl).href;
}`;
  if (id === resolve('practice/prototype-nine/boot.ts')) {
    const before = `new URL(\`products/\${entry.id}/\`, document.baseURI).href`;
    if (source.split(before).length !== 2) throw new Error('Prototype routing seam changed');
    return source.replace(before, `new URL((${JSON.stringify(productBases)})[entry.id], document.baseURI).href`);
  }
  return null;
 },
 load(id){return id.startsWith('\0shared-arena:')?tables.get(id.slice('\0shared-arena:'.length))??null:null;},
 buildStart(){reservation.assert(true);},
 generateBundle(_options, bundle) {
  reservation.assert(true);
  for (const row of bundledOpaque) {
    if (!Object.hasOwn(bundle, row.path)) throw new Error('Missing bundled opaque WASM');
    const asset = bundle[row.path];
    if (asset.type !== 'asset' || digest(Buffer.from(asset.source)) !== row.sha256) throw new Error('Exact bundled opaque WASM changed');
    delete bundle[row.path];
  }
 },
 }]});
// Vite never writes into a shared pathname. Every output is exclusively created.
const output = Array.isArray(bundled) ? bundled[0] : bundled;
for (const file of output.output) {
 const data = Buffer.from(file.type === 'chunk' ? file.code : file.source);
 writePinnedOutput(reservation,file.fileName,data,digest(data));
}
reservation.assert();
const html = readFileSync(safeFile(outDir,'practice.html'));
for(const name of ['arena.html','index.html'])writePinnedOutput(reservation,name,html,digest(html));
for (const [url, data] of assets) {
  const reusedRow = reused.get(url);
  if (reusedRow) {
    if (digest(data) !== reusedRow.sha256) throw new Error('Opaque reuse bytes changed');
    delete copiedPins[url.slice(1)]; continue;
  }
  writePinnedOutput(reservation, url.slice(1), data, copiedPins[url.slice(1)]);
}
if ([...reused.keys()].some(url => !assets.has(url))) throw new Error('Unused reuse mapping');
const composition = { schema: 'wildshard.prototype-nine.served-composition.v1', mount: '/shared-arena/',
  productBases, opaqueRoutes, bundledOpaque, reused: [...reused.values()], local: copiedPins, allJavaScriptOwned: true,
  sourceReceiptSha256: digest(sourceReceiptBytes), sourceInventorySha256: digest(sourceInventoryBytes) };
const compositionBytes = Buffer.from(`${JSON.stringify(composition, null, 2)}\n`);
writePinnedOutput(reservation, 'served-composition.json', compositionBytes, digest(compositionBytes));
verifyPinnedOutputs(reservation,copiedPins);
assertUnchanged(); assertSource(); assertReuse(); retainedCandidateProducts(root, hostRoot);
const report={schema:'wildshard.prototype-nine.build.v1',admitted:false,localOnly:true,acceptance:ACCEPTANCE,sourceSnapshotSha256:digest(Buffer.from(JSON.stringify(snapshot))),permissionSha256:digest(readFileSync(permissionPath)),delivery:'served-exact-opaque-reuse',sourceReceiptSha256:digest(sourceReceiptBytes),sourceInventorySha256:digest(sourceInventoryBytes),builtAt:new Date().toISOString(),revision,singleRuntime:true,worldPersistence:false,buildPolicy:policy,status:'NOT YET PLAYTESTED',qualityComplete:false,prototypeAcceptance:false,sourceAssets:snapshot.catalogue.map(row=>({id:row.id,metadataPath:row.metadataPath,metadataSha256:row.metadataSha256,payloadPath:row.payloadPath,payloadSha256:row.payloadSha256})),products:entries.map(row=>({id:row.id,candidate:row.preview.candidate,mode:row.preview.mode,sourceHash:row.index.build.sourceHash,originalValidator:row.validation.revision,currentSdkValidation:'passed'}))};
const reportBytes = Buffer.from(`${JSON.stringify(report,null,2)}\n`);
writePinnedOutput(reservation,'prototype-nine-build.json',reportBytes,digest(reportBytes));
assertUnchanged();
verifyPinnedOutputs(reservation,copiedPins);
reservation.assert();
writeFileSync(join(outDir,'candidate-inventory.json'), `${JSON.stringify({schema:'wildshard.prototype-nine.inventory.v1',excludes:['candidate-inventory.json'],files:inventory(outDir)},null,2)}\n`, {flag:'wx'});
reservation.assert();
verifyPinnedOutputs(reservation,copiedPins);
console.info(JSON.stringify({outDir,products:entries.length,singleRuntime:true,admitted:false,acceptance:ACCEPTANCE}));
