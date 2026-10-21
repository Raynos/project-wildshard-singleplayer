// Compact, reproducible evidence for a loading milestone; raw traces stay in the lane scratchpad.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { accuracyReport } from './accuracy-report.mjs';

const output = process.argv.find(value => value.startsWith('--out='))?.slice(6);
const inputs = process.argv.slice(2).filter(value => !value.startsWith('--'));
if (!output || inputs.length === 0) throw new Error('Requires --out=DIR and raw receipt files');
const receipts = inputs.map(file => {
  const bytes = readFileSync(file), raw = JSON.parse(bytes.toString('utf8'));
  const surface = raw.device?.includes('Simulator') ? 'simulator' : raw.device === 'Desktop Chromium' ? 'desktop' : 'phone';
  if (!/^[a-f0-9]{40}$/u.test(raw.pin ?? '') || !['grid', 'shardfile'].includes(raw.path)) throw new Error(`Invalid receipt: ${file}`);
  const accuracy = raw.accuracy, report = accuracyReport(accuracy, raw.networkBytes, raw.path);
  const errors = [...(raw.errors ?? []), ...(accuracy.errors ?? [])];
  if (raw.fatal) errors.push(raw.fatal);
  const receipt = { surface, pin: raw.pin, path: raw.path, device: raw.device, cpu: raw.cpu,
    rawSHA256: createHash('sha256').update(bytes).digest('hex'), errors };
  return Object.assign(receipt, report, {
    firstAt: accuracy.firstAt, readyAt: accuracy.readyAt, updates: accuracy.updates,
    final: accuracy.final, workerReceiptBatches: accuracy.workerReceipts?.length ?? 0,
    detailSamples: accuracy.samples.map(sample => ({ at: sample.at, step: sample.step,
      detail: sample.detail, footer: sample.footer, stalled: sample.stalled,
      networkBytes: sample.networkBytes, cachedBytes: sample.cachedBytes, pendingBytes: sample.pendingBytes,
      active: sample.rows.filter(row => row.state === 'on').map(row => ({ key: row.key, detail: row.detail })) })),
  });
});
const pins = new Set(receipts.map(receipt => receipt.pin)), keys = new Set(receipts.map(receipt => `${receipt.surface}-${receipt.path}`));
if (pins.size !== 1 || keys.size !== receipts.length) throw new Error('Receipts must share one SHA and have unique surface/path pairs');
for (const surface of ['phone', 'simulator', 'desktop']) for (const path of ['shardfile', 'grid']) {
  if (!keys.has(`${surface}-${path}`)) throw new Error(`Missing ${surface}/${path} receipt`);
}
mkdirSync(output, { recursive: true });
for (const receipt of receipts) writeFileSync(resolve(output, `${receipt.surface}-${receipt.path}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
const lines = ['# Loading accuracy receipt', '', `Served committed SHA: \`${receipts[0].pin}\`.`, '',
  '| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |',
  '|---|---|---|---|---|---|---|'];
for (const receipt of receipts) {
  const failures = [...receipt.errors, ...receipt.failures];
  lines.push(`| ${receipt.surface} | ${receipt.path} | ${receipt.clockSeconds} / ${receipt.stageSeconds.toFixed(3)} | ${(receipt.networkBytes / 1e6).toFixed(2)} / ${(receipt.displayedNetworkBytes / 1e6).toFixed(2)} | ${(receipt.byteError * 100).toFixed(2)}% | ${receipt.maxDetailGapMs.toFixed(1)} | ${failures.length === 0 ? 'pass' : failures.join('; ')} |`);
}
lines.push('', 'Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.',
  'Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.',
  'Network bytes come from the independent HTTP observer, including service-worker traffic.',
  'Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.', '');
writeFileSync(resolve(output, 'README.md'), lines.join('\n'));
if (receipts.some(receipt => receipt.errors.length > 0 || receipt.failures.length > 0)) throw new Error('Loading accuracy acceptance failed; compact receipts retain the failures');
