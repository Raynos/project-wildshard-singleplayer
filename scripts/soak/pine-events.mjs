/** Scalar diagnostics only: storage footprints are not upload-transfer bytes or GPU-process footprint. */
export function summarizePineAllocations(events, uploads, native, before) {
  const live = new Map(); let total = 0, peakIndex = -1;
  /** @type {{bytes:number,at:number|null,largest:Array<{id:string,bytes:number,asset?:string}>}} */
  let peak = { bytes: 0, at: null, largest: [] };
  const positive = [];
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
  const processes = native.filter(row => row.type === 'sample' && Math.abs(Date.parse(row.t) / 1000 - before) <= 3)
    .map(row => ({ at: row.t, gpuBytes: row.gpu, identities: row.processIdentities ?? null }));
  return { policy: 'API allocation-state peak and five-second storage-call footprint window. Touched footprints count repeats and mip totals; they are NOT transfer bytes. Native GPU process stays separate.',
    through: before, apiPeak: peak, lastFiveSeconds: [...seconds.values()],
    largestGrowth: positive.sort((a, b) => b.increaseBytes - a.increaseBytes).slice(0, 10),
    largestNearEvent: [...window].sort((a, b) => b.bytes - a.bytes).slice(0, 10), nativeNearEvent: processes };
}
