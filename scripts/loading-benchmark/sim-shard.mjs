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


/** Wait for this exact candidate to become waiting; observing state never retries an install. */
export function waitForWaitingWorker(registration, timeoutMs = 120000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) return Promise.reject(new Error('Invalid worker state deadline'));
  if (registration.waiting !== null) return Promise.resolve(registration.waiting);
  const candidate = registration.installing;
  if (candidate === null) return Promise.reject(new Error('No new worker installing or waiting'));
  return new Promise((resolve, reject) => {
    /** @type {{poll?: ReturnType<typeof setInterval>; deadline?: ReturnType<typeof setTimeout>}} */
    const timers = {};
    /** @param {Error} [error] */
    const finish = (error) => {
      clearInterval(timers.poll); clearTimeout(timers.deadline);
      if (error !== undefined) reject(error); else resolve(candidate);
    };
    const check = () => {
      if (registration.waiting === candidate) finish();
      else if (registration.waiting !== null || (registration.installing !== null && registration.installing !== candidate)) finish(new Error('Upgrade worker candidate changed'));
      else if (candidate.state === 'redundant' || candidate.state === 'activated') finish(new Error(`Upgrade worker became ${candidate.state}`));
    };
    timers.poll = setInterval(check, 25);
    timers.deadline = setTimeout(() => { finish(new Error('Upgrade worker did not become waiting before deadline')); }, timeoutMs);
    check();
  });
}
