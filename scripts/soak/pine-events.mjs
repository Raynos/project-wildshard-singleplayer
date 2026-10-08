/** Scalar diagnostics only: storage footprints are not upload-transfer bytes or GPU-process footprint. */
export function summarizePineAllocations(events, uploads, native, before, after = -Infinity) {
  const live = new Map(); let total = 0, peakIndex = -1;
  /** @type {{bytes:number,at:number|null,largest:Array<{id:string,bytes:number,asset?:string}>}} */
  let peak = { bytes: 0, at: null, largest: [] };
  const positive = [];
  let entryApiPeak = { bytes: 0, at: /** @type {number | null} */ (null) };
  for (const [index, row] of events.entries()) {
    if (row.at > before) continue;
    const key = `${row.document}:${row.id}`;
    if (row.op === 'allocation') {
      const previous = live.get(key)?.bytes ?? 0;
      total -= previous;
      if (row.bytes === null) live.delete(key);
      else {
        live.set(key, row); total += row.bytes;
        if (row.bytes > previous) positive.push({ ...row, increaseBytes: row.bytes - previous });
      }
    }
    if (row.op === 'end') for (const [id, resource] of live) if (resource.document === row.document) { total -= resource.bytes; live.delete(id); }
    if (row.at >= after && total > entryApiPeak.bytes) entryApiPeak = { bytes: total, at: row.at };
    if (total > peak.bytes) { peak = { bytes: total, at: row.at, largest: [] }; peakIndex = index; }
  }
  // Replay only the peak cut, then sort once; do not sort every growing allocation during entry.
  const peakLive = new Map(), peakOwners = new Map();
  for (const row of events.slice(0, peakIndex + 1)) {
    const key = `${row.document}:${row.id}`;
    if (row.op === 'label') peakOwners.set(key, { owner: row.owner, asset: row.asset });
    if (row.op === 'allocation') { if (row.bytes === null) peakLive.delete(key); else peakLive.set(key, row); }
    if (row.op === 'end') for (const [id, resource] of peakLive) if (resource.document === row.document) peakLive.delete(id);
  }
  for (const [id, value] of [...peakLive.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 10)) peak.largest.push({ ...value, ...peakOwners.get(id) });
  const window = uploads.filter(row => row.at >= before - 5 && row.at <= before);
  const seconds = new Map();
  for (const row of window) {
    const second = Math.floor(row.at), bucket = seconds.get(second) ?? { second, storageCalls: 0, touchedFootprintBytes: 0, largestFootprintBytes: 0, operations: {} };
    bucket.storageCalls++; bucket.touchedFootprintBytes += row.bytes; bucket.largestFootprintBytes = Math.max(bucket.largestFootprintBytes, row.bytes);
    bucket.operations[row.operation] = (bucket.operations[row.operation] ?? 0) + 1; seconds.set(second, bucket);
  }
  const entryGrowth = positive.filter(row => row.at >= after);
  const entryCalls = uploads.filter(row => row.at >= after && row.at <= before);
  const maximumWindow = (rows, measure) => {
    const ordered = [...rows].sort((a, b) => a.at - b.at);
    let left = 0, sum = 0, bestSum = -1, bestLeft = 0, bestRight = -1;
    for (const [right, row] of ordered.entries()) {
      sum += measure(row);
      while (ordered[left].at < row.at - 1) { sum -= measure(ordered[left]); left++; }
      if (sum > bestSum) { bestSum = sum; bestLeft = left; bestRight = right; }
    }
    const chosen = ordered.slice(bestLeft, bestRight + 1), operations = {}, kinds = {}, stages = {};
    for (const row of chosen) {
      operations[row.operation ?? 'unknown'] = (operations[row.operation ?? 'unknown'] ?? 0) + 1;
      kinds[row.kind] = (kinds[row.kind] ?? 0) + measure(row);
      stages[row.stage ?? 'unknown'] = (stages[row.stage ?? 'unknown'] ?? 0) + 1;
    }
    return { from: chosen[0]?.at ?? null, through: chosen.at(-1)?.at ?? null, count: chosen.length,
      bytes: Math.max(0, bestSum), operations, kinds, stages };
  };
  const processes = native.filter(row => row.type === 'sample' && Math.abs(Date.parse(row.t) / 1000 - before) <= 3)
    .map(row => ({ at: row.t, gpuBytes: row.gpu, identities: row.processIdentities ?? null }));
  return { policy: 'API allocation-state peak, sliding one-second entry maxima and five-second pre-end storage-call footprint window. Touched footprints count repeats and mip totals; they are NOT transfer bytes. Native GPU process stays separate.',
    through: before, entryFrom: Number.isFinite(after) ? after : null, apiPeak: peak, entryApiPeak,
    entryOneSecondGrowth: maximumWindow(entryGrowth, row => row.increaseBytes),
    entryOneSecondStorageFootprints: maximumWindow(entryCalls, row => row.bytes),
    entryOneSecondStorageCalls: maximumWindow(entryCalls, () => 1),
    entryCallSites: entryCalls.filter(row => typeof row.callSite === 'string').map(row => ({
      at: row.at, operation: row.operation, context: row.context, stage: row.stage, callSite: row.callSite,
    })), lastFiveSeconds: [...seconds.values()],
    allocationBearingContexts: events.filter(row => row.op === 'context' && row.at <= before),
    largestGrowth: positive.sort((a, b) => b.increaseBytes - a.increaseBytes).slice(0, 10),
    largestNearEvent: [...window].sort((a, b) => b.bytes - a.bytes).slice(0, 10), nativeNearEvent: processes,
    nativeNearEntryPeak: entryApiPeak.at === null ? [] : native.filter(row => row.type === 'sample' && Math.abs(Date.parse(row.t) / 1000 - entryApiPeak.at) <= 3)
      .map(row => ({ at: row.t, gpuBytes: row.gpu, identities: row.processIdentities ?? null })) };
}
