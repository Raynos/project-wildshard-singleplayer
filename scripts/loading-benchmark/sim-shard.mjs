import { loadingShardName } from './catalogue.mjs';

/** Exact compiled route fence; the similarly named legacy route is not evidence. */
export function requireCompiledEntry(href, shard, accuracy) {
  loadingShardName(shard);
  if (new URL(href).searchParams.get('chunk') !== shard || accuracy?.final?.path !== 'shardfile') throw new Error('Expected exact compiled shard entry');
  if (!Number.isFinite(accuracy.readyAt) || !(accuracy.readyAt > 0) || accuracy.errors.length > 0) throw new Error('Compiled entry did not finish cleanly');
}

/** Report observed counters without smoothing missing samples or denominator growth. */
export function downloadEvidence(samples) {
  let previous, admission = false, changes = 0, drops = 0, maximumError = 0, measured = 0;
  for (const sample of samples) {
    if (sample.step?.startsWith('admission.')) admission = true;
    const total = Number(sample.declaredBytes), pending = Number(sample.pendingBytes), shown = Number(sample.downloadPercent);
    if ([sample.declaredBytes, sample.pendingBytes, sample.downloadPercent].some(value => value === undefined || value.trim() === '')
      || ![total, pending, shown].every(Number.isFinite) || total <= 0 || pending < 0 || pending > total || shown < 0 || shown > 100) continue;
    if (previous !== undefined) {
      if (admission && total !== previous.total) changes++;
      if (shown < previous.shown) drops++;
    }
    maximumError = Math.max(maximumError, Math.abs(shown - 100 * (total - pending) / total));
    previous = { total, shown }; measured++;
  }
  return { measuredFrames: measured, missingFrames: samples.length - measured, denominatorChangesAfterAdmission: changes,
    downloadDrops: drops, maxPercentError: measured === 0 ? null : maximumError, finalDeclaredBytes: previous?.total ?? null };
}

/** Never compare expected content (including cache hits) to compressed network
 * traffic. Retain both independent units and any missing decode evidence. */
export function transportEvidence(receipts) {
  const unknown = receipts.filter(row => !Number.isSafeInteger(row.decodedBodyBytes) || row.decodedBodyBytes < 0);
  return { wireBodyBytes: receipts.reduce((sum, row) => sum + row.bodyBytes, 0),
    networkContentBytes: unknown.length > 0 ? null : receipts.reduce((sum, row) => sum + row.decodedBodyBytes, 0),
    unknownContentResponses: unknown.length, responses: receipts.length,
    expectedUnit: 'file content before HTTP compression; includes cache hits',
    observedUnit: 'HTTP response bodies; excludes cache hits and headers' };
}
