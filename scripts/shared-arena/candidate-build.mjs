import { build } from 'vite';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { rapierAlias, rapierPreviewPlugin } from '../../vite/rapier.ts';
import { assertHeavyLease } from '../../scripts/heavy-lane-lease.mjs';
import { starterArmClipsTableSource } from '../../scripts/gen-starter-arm-clips.mjs';
import { starterEffectsTableSource } from '../../scripts/gen-starter-effects.mjs';
import { shardfileValidationRevision } from '../../scripts/shardfile-validation-revision.mjs';
import { retainedCandidateProducts, digest, sourceSnapshot, assertPermission, inventory, ACCEPTANCE, candidateBuildPolicy, reserveOutput, pinnedBytes, writePinnedOutput, verifyPinnedOutputs, safeFile } from './candidate-inputs.mjs';

assertHeavyLease('build');
const root = resolve('.');
// Fix Vite's production decision; do not retain or log ambient values.
process.env.NODE_ENV = 'production';
const policy = candidateBuildPolicy();
const [hostRoot, destination, snapshotPath, permissionPath] = process.argv.slice(2);
if (process.argv.length !== 6) throw new Error('Usage: candidate-build.mjs <retained-host-directory> <NEW tmp/shared-arena-candidates/name> <snapshot.json> <root-permission.json>');
const outDir = resolve(destination);
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const permission = JSON.parse(readFileSync(permissionPath, 'utf8'));
assertPermission(permission, snapshot, hostRoot, outDir, root);
const assertUnchanged = () => { if (JSON.stringify(sourceSnapshot(root)) !== JSON.stringify(snapshot)) throw new Error('Candidate source/dependency closure changed since root review'); };
assertUnchanged();
const entries = retainedCandidateProducts(root, hostRoot);
// Refuse a reviewed source closure which silently expands the active runtime roster.
const boot = readFileSync(resolve(root, 'practice/shared-arena/boot.ts'), 'utf8');
const catalogue = /const catalogue = \[([\s\S]*?)\] as const;/u.exec(boot)?.[1];
if (!catalogue || JSON.stringify([...catalogue.matchAll(/id: '([^']+)'/gu)].map(match => match[1])) !== JSON.stringify(entries.map(row => row.id))) throw new Error('Candidate runtime catalogue is not the exact original four');
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
// Run real current SDK validation, not just historic receipt matching. Stale runtime receipts fall back to normal admission.
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
const hashes = validator.validateArenaProducts(entries.map(row=>resolve(row.host,'practice-product')));
if (hashes.length !== 4 || hashes.some((hash,i)=>hash!==entries[i].index.build.sourceHash)) throw new Error('Current validation changed the exact source');
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
  for (const asset of [entry.preview.bodyFile.slice(1), 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm']) include(`/${asset}`, entry, asset);
  for (const name of Object.keys(entry.pins)) if (name.startsWith('practice-product/')) include(`/products/${entry.id}/${name.slice(17)}`, entry, name);
  include(`/${entry.previewFile}`, entry, entry.previewFile);
}
const tables = new Map([
 [resolve('src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
 [resolve('src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
 [resolve('src/game/boot/bytes.generated'),`export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
 [resolve('src/game/boot/versions.generated'),`export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
]);
const template=readFileSync(resolve('practice/shared-arena/arena.html'),'utf8').replace('./page.ts','/practice/shared-arena/page.ts').replace('./page.css','/practice/shared-arena/page.css').replace('./arena-compact.css','/practice/shared-arena/arena-compact.css').replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="connect-src 'self'">`).replace('<body>', '<body><div role="status" style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#8b0000;color:white;text-align:center;font:700 14px sans-serif;pointer-events:none">NOT ADMITTED · LOCAL CURRENT-RUNTIME TEST ONLY</div>');
assertUnchanged();
assertPermission(permission, snapshot, hostRoot, outDir, root);
const reservation = reserveOutput(outDir);
const bundled = await build({ ...policy, resolve:{alias:rapierAlias},
 define:{...policy.define,__DEVSERVER__:true,__BUILD_ID__:JSON.stringify('NOT-ADMITTED-shared-arena-candidate'),__SAVE_NAMESPACES__:'[]',__SHARDFILE_VALIDATOR__:JSON.stringify(revision),__SHARDFILE_VERDICTS__:JSON.stringify(entries.map(row=>row.validation))},
 build:{write:false,outDir,emptyOutDir:false,target:'es2022',sourcemap:false,cssCodeSplit:false,rolldownOptions:{input:resolve('practice.html')}},
 plugins:[frozenModules(),rapierPreviewPlugin(),{name:'shared-arena-entry',transformIndexHtml:{order:'pre',handler:()=>template},
 resolveId(source,importer){if(!importer||!source.startsWith('.'))return null;const path=resolve(dirname(importer),source).replace(/\.ts$/u,'');return tables.has(path)?`\0shared-arena:${path}`:null;},
 load(id){return id.startsWith('\0shared-arena:')?tables.get(id.slice('\0shared-arena:'.length))??null:null;},
 buildStart(){reservation.assert(true);},
 generateBundle(){reservation.assert(true);},
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
for(const [url,data]of assets)writePinnedOutput(reservation,url.slice(1),data,copiedPins[url.slice(1)]);
verifyPinnedOutputs(reservation,copiedPins);
assertUnchanged(); retainedCandidateProducts(root, hostRoot);
const report={schema:'wildshard.shared-arena.candidate-build.v1',admitted:false,localOnly:true,acceptance:ACCEPTANCE,sourceSnapshotSha256:digest(Buffer.from(JSON.stringify(snapshot))),permissionSha256:digest(readFileSync(permissionPath)),builtAt:new Date().toISOString(),revision,singleRuntime:true,worldPersistence:false,buildPolicy:policy,bellback:'unavailable',products:entries.map(row=>({id:row.id,candidate:row.preview.candidate,mode:row.preview.mode,sourceHash:row.index.build.sourceHash,originalValidator:row.validation.revision,currentSdkValidation:'passed'}))};
const reportBytes = Buffer.from(`${JSON.stringify(report,null,2)}\n`);
writePinnedOutput(reservation,'shared-arena-build.json',reportBytes,digest(reportBytes));
assertUnchanged();
verifyPinnedOutputs(reservation,copiedPins);
reservation.assert();
writeFileSync(join(outDir,'candidate-inventory.json'), `${JSON.stringify({schema:'wildshard.shared-arena.candidate-inventory.v1',excludes:['candidate-inventory.json'],files:inventory(outDir)},null,2)}\n`, {flag:'wx'});
reservation.assert();
verifyPinnedOutputs(reservation,copiedPins);
console.info(JSON.stringify({outDir,products:entries.length,singleRuntime:true,admitted:false,acceptance:ACCEPTANCE}));
