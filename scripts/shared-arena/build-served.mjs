import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { rapierAlias, rapierPreviewPlugin } from '../../vite/rapier.ts';
import { assertHeavyLease } from '../../scripts/heavy-lane-lease.mjs';
import { starterArmClipsTableSource } from '../../scripts/gen-starter-arm-clips.mjs';
import { starterEffectsTableSource } from '../../scripts/gen-starter-effects.mjs';
import { shardfileValidationRevision } from '../../scripts/shardfile-validation-revision.mjs';
import { admitSharedArena, digest } from './admission.mjs';

assertHeavyLease('build');
const root = resolve('.'), hostRoot = process.argv[2], destination = process.argv[3];
if (!hostRoot || !destination) throw new Error('Usage: build.mjs <retained-host-directory> <new-output-directory> [rooted-input.json]');
const outDir = resolve(destination);
const reuse = JSON.parse(readFileSync(resolve('docs/reviews/shared-enemy-arena/reuse-proposal.json'), 'utf8'));
const reused = new Map();
for (const row of [...reuse.productFiles, ...reuse.explicitRuntimeAssets]) {
  if (!/^\/(?:mantis|conch|colossus|puffer)-engine\//u.test(row.url) || /\.(?:js|css|html)$/u.test(row.path)) throw new Error('Opaque reuse route rejected');
  const bytes = readFileSync(resolve(hostRoot, `.${row.url}`));
  if (digest(bytes) !== row.sha256 || bytes.length !== row.bytes || reused.has(`/${row.path}`)) throw new Error(`Invalid exact reuse: ${row.path}`);
  reused.set(`/${row.path}`, row);
}
const opaqueRoutes = Object.fromEntries(reuse.explicitRuntimeAssets.map(row => [`/${row.path}`, row.url]));
const productBases = { ...reuse.productBases };
const bundledOpaque = reuse.otherExactDuplicates.filter(row => row.path === 'assets/basis_transcoder-VXdx5NbI.wasm');
if (bundledOpaque.length !== 1) throw new Error('Expected exact bundled WASM reuse');
for (const row of bundledOpaque) {
  if (digest(readFileSync(resolve(hostRoot, `.${row.candidateUrl}`))) !== row.sha256) throw new Error('Bundled opaque reuse hash mismatch');
}

if (existsSync(outDir) && readdirSync(outDir).length > 0) throw new Error('Arena output must be new or empty');
const rootedInputPath = process.argv.at(4);
const rootedInput = rootedInputPath === undefined ? undefined : JSON.parse(readFileSync(resolve(root, rootedInputPath), 'utf8'));
const entries = admitSharedArena(root, hostRoot, rootedInput);
// Only the separately admitted fifth product/body may be local. The original
// four immutable fallback URLs remain exactly as supplied by the reuse proposal.
const localRoutes = new Map();
for (const entry of entries.filter(row => row.id === 'pitcher')) {
  productBases[entry.id] = `products/${entry.id}/`;
  const body = entry.preview.bodyFile;
  if (Object.hasOwn(opaqueRoutes, body)) throw new Error('Rooted body collides with reused route');
  opaqueRoutes[body] = body.slice(1);
  localRoutes.set(body, digest(readFileSync(resolve(entry.host, body.slice(1)))));
  for (const [path, hash] of Object.entries(JSON.parse(readFileSync(resolve(entry.host, entry.previewFile), 'utf8')).productFiles)) localRoutes.set(`/products/${entry.id}/${path}`, hash);
}
const revision = shardfileValidationRevision(root);
// Run real current SDK validation, not just historic receipt matching. Stale runtime receipts fall back to normal admission.
const require = createRequire(resolve('src/sdk/package.json'));
const validated = await build({ configFile: false, publicDir: false, logLevel: 'warn', resolve: { alias: rapierAlias },
  define: { __SHARDFILE_VALIDATOR__: JSON.stringify(revision), 'import.meta.dirname': JSON.stringify(resolve('src/sdk')) },
  plugins: [{ name: 'shared-arena-node-validation', enforce: 'pre', resolveId(id) {
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
if (hashes.some((hash,i)=>hash!==entries[i].index.build.sourceHash)) throw new Error('Current validation changed the exact source');
// Shared arms, pickup catalogue, materials and lighting must agree before they can share registration.
const fileJson = (entry,name) => { const file=entry.index.files.find(row=>row.name===name); return JSON.parse(readFileSync(resolve(entry.host,'practice-product',file.path))); };
const section = (entry,name) => { const sectionRow=entry.index.sections.find(row=>row.name===name); return JSON.parse(readFileSync(resolve(entry.host,'practice-product',sectionRow.path))); };
for (const entry of entries.slice(1)) {
  for (const name of ['practice/pickups.json']) if (JSON.stringify(fileJson(entry,name))!==JSON.stringify(fileJson(entries[0],name))) throw new Error(`Arena shared data differs: ${name}`);
  if (JSON.stringify(entry.looks.arenaLighting)!==JSON.stringify(entries[0].looks.arenaLighting)) throw new Error('Arena lighting mismatch');
  for (const name of ['held/arms','look/materials','look/look']) if (JSON.stringify(section(entry,name))!==JSON.stringify(section(entries[0],name))) throw new Error(`Arena shared presentation mismatch: ${name}`);
}
const assets = new Map(), bytes = {}, versions = {};
const include = (url,path) => { const data=readFileSync(path), hash=digest(data); if (assets.has(url) && digest(readFileSync(assets.get(url)))!==hash) throw new Error(`Shared asset collision: ${url}`); assets.set(url,path); bytes[url]=data.length; versions[url]=hash.slice(0,8); };
for (const entry of entries) {
  for (const asset of [entry.preview.bodyFile.slice(1),'assets/models/driftwood-fp/fp-arms.glb','assets/physics/rapier.wasm']) include(`/${asset}`,resolve(entry.host,asset));
  const walk = (folder,relative='') => { for (const item of readdirSync(folder,{withFileTypes:true})) { const path=join(folder,item.name), next=relative ? `${relative}/${item.name}` : item.name; if(item.isDirectory())walk(path,next);else include(`/products/${entry.id}/${next}`,path); } };
  walk(resolve(entry.host,'practice-product'));
}
const tables = new Map([
 [resolve('src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
 [resolve('src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
 [resolve('src/game/boot/bytes.generated'),`export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
 [resolve('src/game/boot/versions.generated'),`export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
]);
const assetModule = resolve('src/practiceAssets.ts');
const bootModule = resolve('practice/shared-arena/boot.ts');
const template=readFileSync(resolve('practice/shared-arena/arena.html'),'utf8').replace('./page.ts','/practice/shared-arena/page.ts').replace('./page.css','/practice/shared-arena/page.css');
let written=false;
await build({ configFile: false, publicDir:false, base:'./', resolve:{alias:rapierAlias},
 experimental: { renderBuiltUrl(filename) { return bundledOpaque.find(row => row.path === filename)?.candidateUrl; } },
 define:{__DEVSERVER__:true,__BUILD_ID__:JSON.stringify('shared-enemy-arena-v1'),__SAVE_NAMESPACES__:'[]',__SHARDFILE_VALIDATOR__:JSON.stringify(revision),__SHARDFILE_VERDICTS__:JSON.stringify(entries.map(row=>row.validation))},
 build:{outDir,target:'es2022',sourcemap:false,cssCodeSplit:false,rolldownOptions:{input:resolve('practice.html')}},
 plugins:[rapierPreviewPlugin(),{name:'shared-arena-entry',transformIndexHtml:{order:'pre',handler:()=>template},
 resolveId(source,importer){if(!importer||!source.startsWith('.'))return null;const path=resolve(dirname(importer),source).replace(/\.ts$/u,'');return tables.has(path)?`\0shared-arena:${path}`:null;},
 transform(source,id) {
  if (id === assetModule) return `const routes = ${JSON.stringify(opaqueRoutes)};
export function practiceAssetUrl(path, pageUrl = document.baseURI) {
  const route = routes[path];
  if (route === undefined) throw new Error('Unmapped opaque arena asset: ' + path);
  return new URL(route, pageUrl).href;
}`;
  if (id === bootModule) {
    const before = `new URL(\`products/\${entry.id}/\`, document.baseURI).href`;
    if (source.split(before).length !== 2) throw new Error('Arena product routing seam changed');
    return source.replace(before, `new URL((${JSON.stringify(productBases)})[entry.id], document.baseURI).href`);
  }
  return null;
},
 load(id){return id.startsWith('\0shared-arena:')?tables.get(id.slice('\0shared-arena:'.length))??null:null;},
 generateBundle(_options,bundle) {
  for (const row of bundledOpaque) {
    if (!(row.path in bundle)) throw new Error('Bundled WASM missing');
    const asset=bundle[row.path];
    if (asset.type !== 'asset' || digest(Buffer.from(asset.source)) !== row.sha256) throw new Error('Bundled WASM source changed');
    delete bundle[row.path];
  }
 },
 writeBundle(){written=true;},closeBundle(){if(!written)return;copyFileSync(join(outDir,'practice.html'),join(outDir,'arena.html'));copyFileSync(join(outDir,'practice.html'),join(outDir,'index.html'));
 for(const [url,path]of assets){const routed=reused.get(url);if(routed){if(digest(readFileSync(path))!==routed.sha256)throw new Error(`Reuse source changed: ${url}`);continue;}if(localRoutes.get(url)!==digest(readFileSync(path)))throw new Error(`Unpinned local Arena asset: ${url}`);const dest=join(outDir,url.slice(1));mkdirSync(dirname(dest),{recursive:true});copyFileSync(path,dest);}
 for(const entry of entries)copyFileSync(join(entry.host,entry.previewFile),join(outDir,entry.previewFile));
 for (const [url, path] of assets) {
   if (reused.has(url)) continue;
   if (localRoutes.get(url) !== digest(readFileSync(path))) throw new Error(`Unpinned local Arena asset: ${url}`);
 }
 if (assets.size !== reused.size + localRoutes.size || [...reused.keys(), ...localRoutes.keys()].some(url => !assets.has(url))) throw new Error('Opaque route map does not cover all assets');
 writeFileSync(join(outDir,'served-composition.json'),`${JSON.stringify({schema:'wildshard.shared-arena.served-composition.v1',mount:'/shared-arena/',productBases,opaqueRoutes,bundledOpaque,local:[...localRoutes].map(([path,sha256])=>({path,sha256})),reused:[...reused.values()],allJavaScriptOwned:true},null,2)}\n`);
 const report={schema:'wildshard.shared-arena.build.v1',builtAt:new Date().toISOString(),revision,singleRuntime:true,worldPersistence:false,bellback:'unavailable',products:entries.map(row=>({id:row.id,candidate:row.preview.candidate,mode:row.preview.mode,sourceHash:row.index.build.sourceHash,originalValidator:row.validation.revision,currentSdkValidation:'passed'}))};
 writeFileSync(join(outDir,'shared-arena-build.json'),`${JSON.stringify(report,null,2)}\n`);
 }}]});
console.log(JSON.stringify({outDir,products:entries.length,singleRuntime:true}));
