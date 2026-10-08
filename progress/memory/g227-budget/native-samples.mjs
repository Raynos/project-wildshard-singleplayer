// Independent, fresh native journal rows. Partial writes and a stopped sampler cannot grade a settled median.
export function nativeSample(text, { phase, pid, after, now = Date.now(), maxAgeMs = 2500 }) {
  const rows = text.split('\n').slice(0, -1).map(line => JSON.parse(line));
  const row = rows.findLast(value => value.type === 'sample' && value.phase === phase);
  if (!row || row.t === after || !Number.isFinite(Date.parse(row.t)) || now - Date.parse(row.t) > maxAgeMs) return undefined;
  const entries = Object.entries(row.pids);
  const candidate = pid === undefined ? entries.sort((a, b) => b[1][0] - a[1][0])[0] : entries.find(([id]) => Number(id) === pid);
  if (!candidate) throw new Error('Admitted WebContent PID disappeared; cannot substitute another process');
  const [id, values] = candidate;
  if (!Number.isSafeInteger(Number(id)) || !values.every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid native footprint sample');
  return { at: row.t, pid: Number(id), footprintBytes: values[0], intervalPeakBytes: values[1], gpuProcessBytes: row.gpu };
}

export async function waitNativeSample(read, status, options, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const deadline = Date.now() + 5000;
  do {
    const state = status();
    if (state.error !== null || state.exitCode !== null || state.signal !== null) throw new Error('Native sampler stopped: ' + JSON.stringify(state));
    const sample = nativeSample(read(), options);
    if (sample !== undefined) return sample;
    await wait(100);
  } while (Date.now() < deadline);
  throw new Error('No fresh independent native sample: ' + JSON.stringify({ phase: options.phase, after: options.after, sampler: status() }));
}
