/** Independent transport bytes come from the HTTP observer, never the displayed counter. */
export function accuracyReport(accuracy, networkBytes, expectedPath) {
  const final = accuracy.final;
  const seconds = duration => {
    const value = Number.parseFloat(duration);
    return Number.isFinite(value) ? value * (/ms/u.test(duration) ? 0.001 : 1) : 0;
  };
  const stageSeconds = final?.rows.reduce((sum, row) => sum + (row.ms === undefined ? seconds(row.duration) : Number(row.ms) / 1000), 0) ?? 0;
  const clockSeconds = final ? final.clock.split(':').reduce((minutes, value) => minutes * 60 + Number(value), 0) : 0;
  const updates = [accuracy.firstAt ?? accuracy.updates[0] ?? 0, ...accuracy.updates, accuracy.readyAt]
    .filter(at => Number.isFinite(at) && at <= accuracy.readyAt);
  const displayedNetworkBytes = final?.networkBytes === undefined ? null : Number(final.networkBytes);
  const byteError = networkBytes === null || displayedNetworkBytes === null ? null
    : Math.abs(displayedNetworkBytes - networkBytes) / Math.max(1, networkBytes);
  const visible = /^(\d+\.(\d+)) MB (?:network|downloaded)/u.exec(final?.download ?? '');
  const visibleByteError = visible === null || networkBytes === null ? null
    : Math.max(0, Math.abs(Number(visible[1]) * 1_000_000 - networkBytes) - 500_000 * 10 ** -visible[2].length) / Math.max(1, networkBytes);
  const maxDetailGapMs = Math.max(0, ...updates.slice(1).map((at, index) => at - updates[index]));
  const unaccountedSeconds = clockSeconds - stageSeconds;
  const failures = [];
  if (expectedPath !== undefined && final?.path !== expectedPath) failures.push(`Expected ${expectedPath} load path, observed ${final?.path ?? 'none'}`);
  if (!(accuracy.readyAt > 0)) failures.push('First frame was not reached');
  if (Math.abs(unaccountedSeconds) > 3) failures.push('Stage sum differs from wall clock by more than 3 s');
  if (unaccountedSeconds > 2) failures.push('Unlabelled gap exceeds 2 s');
  if (maxDetailGapMs > 1000) failures.push('Detailed update gap exceeds 1 s');
  if (byteError === null || byteError > 0.05) failures.push('Network bytes are unavailable or differ by more than 5%');
  if (Number(final?.unclassifiedFiles ?? 0) > 0) failures.push('Some wire sizes are unavailable from the browser');
  if (final?.download !== undefined && (visibleByteError === null || visibleByteError > 0.05)) failures.push('Visible MB count differs by more than 5%');
  for (const row of final?.rows ?? []) if (!row.label && seconds(row.duration) > 2) failures.push('Unlabelled gap exceeds 2 s');
  return { stageSeconds, clockSeconds, unaccountedSeconds, displayedNetworkBytes, networkBytes,
    byteError, visibleByteError, maxDetailGapMs, failures };
}
