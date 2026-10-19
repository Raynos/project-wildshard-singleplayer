import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COLOSSUS_NATIVE_CANDIDATE, COLOSSUS_NATIVE_INPUTS, admitColossusNative } from '../../../../../scripts/colossus-native-admission.mjs';

// Run from the repository root after the exact source tests pass. No payload duplication.
admitColossusNative(process.cwd());
const owned = [
  'src/shards/driftwood-isle/generators/colossusNativeClips.ts',
  'src/shards/driftwood-isle/generators/colossusNativePreview.ts',
  'scripts/colossus-native-admission.mjs', 'scripts/colossus-native-admission.test.mjs',
  'scripts/build-colossus-native-preview.mjs', 'vite/colossus-native-preview.config.ts',
  'test/colossus-native-preview.test.ts', 'test/colossus-native-envelope.test.ts',
  ...['metadata.json', 'dimension-measurement.json', 'measure.py', 'admission.json', 'README.md', 'envelope.json', 'freeze.mjs'].map(name => `${COLOSSUS_NATIVE_CANDIDATE}/${name}`),
];
const pin = path => { const bytes = readFileSync(path); return { path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }; };
const closure = { schema: 'wildshard.colossus.arena-source-closure.v1', candidate: 'V4-skin1-native22-motion1',
  sourceOnly: true, visualAcceptance: false, colliderAcceptance: false, runtimeAcceptance: false,
  worldCorpseContactAccepted: false, buildRun: false, browserRun: false,
  files: owned.map(pin), protectedInputs: COLOSSUS_NATIVE_INPUTS.filter(path => !owned.includes(path)).map(pin) };
writeFileSync(`${COLOSSUS_NATIVE_CANDIDATE}/source-closure.json`, `${JSON.stringify(closure, null, 2)}\n`);
console.info(JSON.stringify({ files: closure.files.length, bytes: closure.files.reduce((sum, row) => sum + row.bytes, 0) }));
