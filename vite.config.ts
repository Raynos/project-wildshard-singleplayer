import { defineConfig } from 'vite';
import { assetTableAddresses, readAssetTables } from './scripts/app-build/assetTables.mjs';
import { readGridSeams } from './scripts/app-build/gridSeams.mjs';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { shardfileValidationRevision } from './scripts/shardfile-validation-revision.mjs';
import { join } from 'node:path';
import { rapierAlias } from './vite/rapier';
import { assertHeavyLease } from './scripts/heavy-lane-lease.mjs';
import { BUILD_ID_EXPRESSION } from './scripts/app-build/buildIdentity.mjs';

/** The world map atlas's define, as scripts/app-build/worldMapAtlas.ts baked it before the bundle. */
function worldMapDefine(): unknown {
  let rows: string;
  try { rows = readFileSync('out/.app/world-map.json', 'utf8'); }
  catch { throw new Error('Missing out/.app/world-map.json: build the app through scripts/build-app.mjs, which bakes the world map first'); }
  return (JSON.parse(rows) as { define: unknown }).define;
}

export function buildValidationReceipts(revision: string, directory = 'out'): unknown[] {
  if (!existsSync(directory)) return [];
  const receipts: unknown[] = [];
  for (const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
    const receiptPath=join(directory,entry.name,'validation.json'),sourcePath=join(directory,entry.name,'shard.json');
    if(!existsSync(receiptPath)||!existsSync(sourcePath))throw new Error(`Missing output validation receipt: ${entry.name}`);
    const bytes=readFileSync(sourcePath),index:unknown=JSON.parse(bytes.toString('utf8')),receipt:unknown=JSON.parse(readFileSync(receiptPath,'utf8'));
    if(typeof index!=='object'||index===null||!('format' in index)||index.format!=='wildshard.shardfile'||!('formatVersion' in index)||index.formatVersion!==2||!('build' in index)||typeof index.build!=='object'||index.build===null||!('sourceHash' in index.build)||typeof index.build.sourceHash!=='string')throw new Error(`Invalid validated output index: ${entry.name}`);
    if(typeof receipt!=='object'||receipt===null||!('revision' in receipt)||receipt.revision!==revision||!('indexHash' in receipt)||receipt.indexHash!==createHash('sha256').update(bytes).digest('hex')||!('sourceHash' in receipt)||receipt.sourceHash!==index.build.sourceHash)throw new Error(`Stale output validation receipt: ${entry.name}`);
    receipts.push({ revision: receipt.revision, sourceHash: receipt.sourceHash, indexHash: receipt.indexHash,
      ...('worst' in receipt ? { worst: receipt.worst } : {}) });
  }
  return receipts;
}

export default defineConfig(({ mode, command }) => {
  if (command === 'build') assertHeavyLease('build');
  const native = mode === 'native';
  const validationRevision = shardfileValidationRevision();
  return {
    server: { port: 5173, host: true },
    // js-payload D2 (Jake): on-phone stacks show Rolldown's mangled names; hidden source maps resolve them on desktop
    // native: no source maps at all — they would ship inside the app and in every OTA bundle
    build: native
      // native.html: the web page with the web-only boot swapped for src/native.ts (scripts/native-page.mjs); build-app names it
      // index.html in dist-native/ (capacitor.config.ts `webDir`)
      ? { target: 'es2022', chunkSizeWarningLimit: 4000, sourcemap: false, outDir: 'dist-native', rolldownOptions: { input: { index: join(process.cwd(), 'native.html') } } }
      // one stylesheet: src/entry.ts splits three.js from the game's graph, and code-split CSS would add a request
      : {
        target: 'es2022', chunkSizeWarningLimit: 4000, sourcemap: 'hidden' as const, cssCodeSplit: false, manifest: true,
        // G221: standalone CLI calibration, never a game-entry or Developer switch.
        rolldownOptions: { input: { main: join(process.cwd(), 'index.html'), calibration: join(process.cwd(), 'calibration/index.html') } },
        // Manual groups remain disabled: Rolldown 1.2.9 emits circular chunks with invalid runtime bindings.
      },
    assetsInclude: ['**/*.hdr', '**/*.gltf', '**/*.bin'],
    resolve: { alias: rapierAlias }, // Rapier's wasm-importing module → plain bindings (vite/rapier.ts)
    define: { __GRID_SEAM_ASSET__: JSON.stringify(readGridSeams(process.cwd()).address), __BOOT_TABLE_ASSETS__: JSON.stringify(assetTableAddresses(readAssetTables(process.cwd()))), __GRID_MAP_ATLAS__: JSON.stringify(worldMapDefine()), __SHARDFILE_VALIDATOR__: JSON.stringify(validationRevision), __SHARDFILE_VERDICTS__: JSON.stringify(buildValidationReceipts(validationRevision)), __DEVSERVER__: mode === 'devserver', __BUILD_ID__: BUILD_ID_EXPRESSION, __SAVE_NAMESPACES__: JSON.stringify(readdirSync('src/shards').filter((slug) => existsSync(join('src/shards', slug, 'manifest.ts')))) },
  };
});
