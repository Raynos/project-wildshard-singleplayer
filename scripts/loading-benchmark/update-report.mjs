/** Split an actual old-page update by recorded events, never inspector poll time.
 * @param {import('./update-report.d.mts').UpdateObservation} data */
export function updateReport(data) {
  if (data.oldVersion.build === data.newVersion.build) throw new Error('Update requires different builds');
  const rows = data.afterState.rows;
  const tap = rows.findLastIndex(row => row.kind === 'tap');
  if (tap === -1) throw new Error('Missing update tap');
  let index = tap;
  /** @param {string} kind */
  const next = kind => {
    const previous = rows[index];
    const found = rows.findIndex((row, i) => i > index && row.kind === kind);
    const row = rows[found];
    if (previous === undefined || row === undefined || !Number.isFinite(row.host) || row.host <= 0
      || !Number.isFinite(previous.host) || previous.host <= 0 || row.host < previous.host) {
      throw new Error(`Missing or unordered update ${kind}`);
    }
    index = found; return row;
  };
  const clicked = rows[tap];
  if (clicked === undefined) throw new Error('Missing update tap');
  const controller = next('controllerchange'), inline = next('document'), ready = next('ready'), paint = next('titlePaint');
  /** The same URL is not necessarily the same bytes: unhashed assets can change.
   * @param {string} value */
  const path = value => { const url = new URL(value); return `${url.pathname}${url.search}`; };
  const previous = new Set(data.transport.filter(row => row.endedAt < data.switchHost).map(row => path(row.url)));
  const previousBodies = new Map(data.transport.filter(row => row.endedAt < data.switchHost && row.status === 200
    && row.bodySHA256 !== undefined && row.bodyEncoding !== undefined).map(row => [path(row.url), row]));
  /** @param {number} from @param {number} to */
  const traffic = (from, to) => {
    const bank = data.transport.filter(row => row.endedAt >= from && row.endedAt < to);
    let unchangedBodyBytes = 0, changedBodyBytes = 0, unknownBodyBytes = 0;
    for (const row of bank) {
      const old = previousBodies.get(path(row.url));
      if (row.status !== 200 || old === undefined || row.bodySHA256 === undefined || row.bodyEncoding !== old.bodyEncoding) unknownBodyBytes += row.bodyBytes;
      else if (row.bodySHA256 === old.bodySHA256) unchangedBodyBytes += row.bodyBytes;
      else changedBodyBytes += row.bodyBytes;
    }
    return { responsesEnded: bank.length, bodyBytes: bank.reduce((sum, row) => sum + row.bodyBytes, 0),
      unchangedBodyBytes, changedBodyBytes, unknownBodyBytes,
      sameURLBodyBytes: bank.filter(row => previous.has(path(row.url))).reduce((sum, row) => sum + row.bodyBytes, 0),
      failures: bank.filter(row => row.status >= 400).map(row => ({ url: row.url, status: row.status })) };
  };
  /** @param {import('./update-report.d.mts').ArtObservation} art */
  const images = art => {
    const byURL = new Map(art.rows.map(row => [new URL(row.src, data.base).href, row]));
    return { unique: byURL.size, failed: [...byURL.values()].filter(row => !row.ok).map(row => row.src) };
  };
  const admission = data.templateState.accuracy.final?.rows.find(row => row.key === 'admission');
  const admissionMs = admission === undefined ? null : Number(admission.ms);
  return {
    oldBuild: data.oldVersion.build, newBuild: data.newVersion.build,
    adoptionMs: controller.host - clicked.host, reloadToInlineMs: inline.host - controller.host,
    inlineToReadyMs: ready.host - inline.host, readyToPaintMs: paint.host - ready.host,
    tapToPaintMs: paint.host - clicked.host,
    staleArt: images(data.staleArt), newArt: images(data.afterArt),
    installAndStaleInspection: traffic(data.switchHost, clicked.host), update: traffic(clicked.host, paint.host),
    template: { tapToReadyMs: data.templateReadyHost - data.templateTapHost,
      admissionMs: admissionMs !== null && Number.isFinite(admissionMs) ? admissionMs : null,
      traffic: traffic(data.templateTapHost, data.templateReadyHost) },
    limits: 'Diagnostic proxy response bodies include injected, uncompressed HTML. Same URL does not prove unchanged content. Unchanged/changed bytes require matching URL, successful bodies and the same encoding with SHA-256 receipts; other bytes stay unknown. No request is evidence of no wire body, not proof of a cache hit. Install traffic includes pre-tap stale-art inspection; update traffic is bounded by response end, not request start.',
  };
}

/** Measure actual step/receipt changes, deliberately excluding the elapsed clock.
 * @param {readonly import('./update-report.d.mts').UpdateProgressEvent[]} rows */
export function updateProgressReport(rows) {
  const tapIndex = rows.findLastIndex(row => row.kind === 'tap'), tap = rows[tapIndex];
  if (tap === undefined || !Number.isFinite(tap.host) || tap.host <= 0
    || typeof tap.origin !== 'number' || !Number.isFinite(tap.origin) || tap.origin <= 0) throw new Error('Missing update tap clock');
  const bank = rows.slice(tapIndex + 1), inline = bank.find(row => row.kind === 'document');
  const painted = bank.findLast(row => row.kind === 'updateTitlePaint' && row.origin === inline?.origin);
  if (inline === undefined || painted === undefined || typeof inline.origin !== 'number'
    || !Number.isFinite(inline.origin) || inline.origin <= 0 || inline.origin === tap.origin) {
    throw new Error('Missing new-document progress handoff');
  }
  const changes = bank.filter(row => row.kind === 'updateProgress' && row.host <= painted.host);
  if (changes.length === 0 || !changes.some(row => row.origin === tap.origin) || !changes.some(row => row.origin === inline.origin)) {
    throw new Error('Progress must cover both documents');
  }
  const hidden = bank.find(row => row.kind === 'updateHidden' && row.origin === inline.origin);
  if (hidden === undefined || hidden.host > painted.host) throw new Error('Title paint must follow modal release');
  let previous = tap.host, longestGapMs = 0;
  for (const row of [...changes, painted]) {
    if (!Number.isFinite(row.host) || row.host <= 0 || row.host < previous) throw new Error('Invalid progress clock');
    longestGapMs = Math.max(longestGapMs, row.host - previous); previous = row.host;
    if (row.kind === 'updateProgress' && (!['found', 'download', 'install', 'reload'].includes(row.phase ?? '')
      || typeof row.fact !== 'string')) throw new Error('Missing actual progress phase or receipt');
  }
  const first = changes[0];
  if (first === undefined) throw new Error('Missing first progress');
  return { pass: first.host - tap.host <= 1000 && longestGapMs <= 1000,
    firstModalDomMs: first.host - tap.host, tapToPaintMs: painted.host - tap.host,
    longestGapMs, actualChanges: changes.length,
    phases: [...new Set(changes.map(row => row.phase))],
    finalFact: changes.at(-1)?.fact ?? '',
    limits: 'Only recorded phase/receipt changes count. Modal appearance is DOM-observed; native video verifies paint. Elapsed clock repaint is excluded; proxy HTML is diagnostic and uncompressed.' };
}
