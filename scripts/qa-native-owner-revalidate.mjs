/** Post-hoc assertion audit of one immutable exit-1 capture. Never launches or changes a browser/build. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { nativeOwnerPersistenceEmpty } from './native-owner-proof-persistence.ts';

const root = resolve(import.meta.dirname, '..'), base = 'tmp/native-owner-browser-proof-resolver1';
const docs = 'docs/reviews/conch-authoritative-motion-contract';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path));
const reportPath = `${base}/capture/report.json`, receiptPath = `${base}/dist/native-owner-proof.json`;
const originalReportSha256 = 'e1baf026f0a4de87c7e454d4c25b802c8cd0e3270acb330c4db67f50a41089eb';
const originalReceiptSha256 = 'fc98822427d9fbca80b229ee726c60b5492e7f4e9d8969886901242fddfa662a';
const reportBytes = read(reportPath), receiptBytes = read(receiptPath);
if (hash(reportBytes) !== originalReportSha256 || hash(receiptBytes) !== originalReceiptSha256) throw new Error('Immutable native-owner capture identity changed');
const report = JSON.parse(reportBytes), receipt = JSON.parse(receiptBytes);
if (report.schema !== 'wildshard.native-owner.private-capture.v1' || report.synthetic !== true
  || report.modelAdmission !== false || report.publicAdmission !== false || report.finishedAt === undefined
  || report.fatal !== undefined || report.hostReceiptSha256 !== originalReceiptSha256
  || report.checks.emptyPersistence !== false || Object.entries(report.checks).some(([key, value]) => key !== 'emptyPersistence' && value !== true))
  throw new Error('Capture is not the exact retained persistence-only assertion failure');
const observations = [
  { stage: 'before-start', phase: 'preboot', stores: report.storesBefore },
  { stage: 'after-cycle', phase: 'running', stores: report.storesAfterCycle },
  { stage: 'reload-before-start', phase: 'preboot', stores: report.storesAfterReloadBeforeStart },
  { stage: 'after-reload', phase: 'running', stores: report.storesAfterReload },
];
for (const row of observations) {
  if (row.phase !== 'preboot' && row.phase !== 'running') throw new Error('Unknown observation phase');
  if (!nativeOwnerPersistenceEmpty(row.stores, row.phase)) throw new Error(`Nonempty or malformed persistence at ${row.stage}`);
}
const files = {};
function visit(directory, prefix = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = `${prefix}${entry.name}`, path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path, `${name}/`);
    else if (entry.isFile()) { const bytes = readFileSync(path); files[name] = { bytes: bytes.length, sha256: hash(bytes) }; }
    else throw new Error('Unexpected capture evidence resource');
  }
}
visit(resolve(root, base, 'capture'));
for (const row of [report.cycleTrace, report.reloadTrace])
  if (files[row.file]?.sha256 !== row.sha256 || files[row.file]?.bytes !== row.bytes) throw new Error('Complete capture trace changed');
const result = { schema: 'wildshard.native-owner.posthoc-assertion-review.v1',
  originalProcessExit: 1, originalEmptyPersistenceCheck: false, originalReportPath: reportPath, originalReportSha256,
  newBrowserRun: false, originalReportModified: false, correctedPersistenceAssertion: true,
  verdict: 'Exact captured empty SaveStore envelope revalidated post hoc; original process remains exit 1.',
  synthetic: true, modelAdmission: false, publicAdmission: false, qualityAdmission: false,
  originalChecks: report.checks, observations, startedAt: report.startedAt, finishedAt: report.finishedAt,
  sourceFiles: Object.fromEntries(['scripts/native-owner-proof-persistence.ts', 'scripts/qa-native-owner-revalidate.mjs',
    'test/native-owner-proof-persistence.test.ts', 'src/engine/saves/store.ts'].map(path => [path, hash(read(path))])),
  cycleTrace: report.cycleTrace, reloadTrace: report.reloadTrace, captureFiles: files,
  network: { requestCount: report.requests.length, deniedRequests: report.deniedRequests, errors: report.errors },
  faults: report.faults, reloadFaults: report.reloadFaults,
  samples: report.samples.map(row => ({ label: row.label, nativeClock: row.nativeClock, hp: row.actor?.hp,
    alive: row.actor?.alive, playerHealth: row.player?.vitals.health, owner: row.owner, loot: row.loot })),
  limits: 'Only localStorage, sessionStorage and SaveStore.exportAll().docs were checked, not every browser storage API. Synthetic tetrahedron/time-entry witness is not model, contact, animation or phone-performance admission.',
};
const buildSummary = { schema: 'wildshard.native-owner.compact-build-evidence.v1', originalReceiptPath: receiptPath,
  originalReceiptSha256, pinPath: `${docs}/PRIVATE-CANONICAL-BROWSER-PIN-RESOLVER1.json`, pinSha256: receipt.pinSha256,
  sourceHash: receipt.sourceHash, productFiles: receipt.productFiles, sourceFiles: receipt.sourceFiles, hostFiles: receipt.hostFiles,
  synthetic: true, modelAdmission: false, publicAdmission: false, limits: receipt.limits };
for (const [name, value] of [['PRIVATE-CANONICAL-CAPTURE-POSTHOC.json', result], ['PRIVATE-CANONICAL-RESOLVER1-BUILD-SUMMARY.json', buildSummary]])
  writeFileSync(resolve(root, docs, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
if (hash(read(reportPath)) !== originalReportSha256) throw new Error('Original report changed during post-hoc audit');
console.info(JSON.stringify({ originalProcessExit: 1, originalReportSha256, correctedPersistenceAssertion: true, newBrowserRun: false,
  files: Object.keys(files).length, output: `${docs}/PRIVATE-CANONICAL-CAPTURE-POSTHOC.json` }));
