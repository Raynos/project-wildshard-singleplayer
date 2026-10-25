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
  /** @param {number} from @param {number} to */
  const traffic = (from, to) => {
    const bank = data.transport.filter(row => row.endedAt >= from && row.endedAt < to);
    return { responsesEnded: bank.length, bodyBytes: bank.reduce((sum, row) => sum + row.bodyBytes, 0),
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
    limits: 'Diagnostic proxy response bodies include injected, uncompressed HTML. Same URL does not prove unchanged content. Install traffic includes pre-tap stale-art inspection; update traffic is bounded by response end, not request start.',
  };
}
