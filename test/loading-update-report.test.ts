import { expect, test } from 'vitest';
import { updateReport, updateProgressReport, type UpdateObservation, type UpdateProgressEvent } from '../scripts/loading-benchmark/update-report.mjs';

function observation(): UpdateObservation {
  return { base: 'http://local/', oldVersion: { build: 'old' }, newVersion: { build: 'new' }, switchHost: 500,
    afterState: { rows: [{ kind: 'ready', host: 50 }, { kind: 'tap', host: 1000 },
      { kind: 'controllerchange', host: 1001 }, { kind: 'document', host: 1472 }, { kind: 'ready', host: 1759 }, { kind: 'titlePaint', host: 1813 }] },
    staleArt: { rows: [{ src: '/hero.jpg', ok: true }, { src: 'http://local/hero.jpg', ok: true }] },
    afterArt: { rows: [{ src: '/hero.jpg', ok: false }] }, templateTapHost: 2000, templateReadyHost: 6365,
    templateState: { accuracy: { final: { rows: [{ key: 'admission', ms: '1252' }] } } },
    transport: [{ url: 'http://before/hero.jpg', endedAt: 400, status: 200, bodyBytes: 5 },
      { url: 'http://after/hero.jpg', endedAt: 1200, status: 200, bodyBytes: 7 },
      { url: 'http://after/missing.js', endedAt: 1250, status: 404, bodyBytes: 0 },
      { url: 'http://after/late.js', endedAt: 1813, status: 200, bodyBytes: 99 }] };
}
test('splits event clocks, deduplicates art and keeps same-URL bytes distinct from unchanged content', () => {
  const report = updateReport(observation());
  expect([report.adoptionMs, report.reloadToInlineMs, report.inlineToReadyMs, report.readyToPaintMs, report.tapToPaintMs]).toEqual([1, 471, 287, 54, 813]);
  expect(report.staleArt).toEqual({ unique: 1, failed: [] });
  expect(report.newArt.failed).toEqual(['/hero.jpg']);
  expect(report.update).toEqual({ responsesEnded: 2, bodyBytes: 7, sameURLBodyBytes: 7, failures: [{ url: 'http://after/missing.js', status: 404 }] });
  expect(report.template).toMatchObject({ tapToReadyMs: 4365, admissionMs: 1252 });
  expect(report.limits).toContain('Same URL does not prove unchanged content');
});
test.each(['controllerchange', 'document', 'ready', 'titlePaint'])('refuses a missing %s instead of substituting inspector poll time', kind => {
  const data = observation(); data.afterState.rows = data.afterState.rows.filter(row => row.kind !== kind);
  expect(() => updateReport(data)).toThrow();
});
test.each([0, Number.NaN, 999])('refuses a zero, unknown or backwards post-tap clock %s', host => {
  const data = observation(); const row = data.afterState.rows[2];
  if (row === undefined) throw new Error('Missing fixture controller'); row.host = host;
  expect(() => updateReport(data)).toThrow('controllerchange');
});
test('refuses same-build claims and keeps unavailable admission unmeasured', () => {
  const data = observation(); data.newVersion.build = 'old'; expect(() => updateReport(data)).toThrow('different builds');
  data.newVersion.build = 'new'; data.templateState.accuracy.final = null;
  expect(updateReport(data).template.admissionMs).toBeNull();
});

function progress(): UpdateProgressEvent[] {
  return [{ kind: 'tap', host: 1000, origin: 1 },
    { kind: 'updateProgress', host: 1002, origin: 1, phase: 'found', fact: '0 files' },
    { kind: 'updateProgress', host: 1068, origin: 1, phase: 'install', fact: '0 files' },
    { kind: 'document', host: 1400, origin: 2 },
    { kind: 'updateProgress', host: 1500, origin: 2, phase: 'reload', fact: '8 files' },
    { kind: 'updateHidden', host: 1800, origin: 2 }, { kind: 'updateTitlePaint', host: 1868, origin: 2 }];
}
test('counts real phase/receipt changes across the navigation, with no elapsed-clock credit', () => {
  expect(updateProgressReport(progress())).toMatchObject({ pass: true, firstVisibleMs: 2,
    tapToPaintMs: 868, longestGapMs: 432, actualChanges: 3, phases: ['found', 'install', 'reload'], finalFact: '8 files' });
  const slow = progress(); const end = slow.at(-1);
  if (end === undefined) throw new Error('Missing title paint'); end.host = 2800;
  expect(updateProgressReport(slow)).toMatchObject({ pass: false, longestGapMs: 1300 });
});
test.each(['document', 'updateProgress', 'updateHidden', 'updateTitlePaint'])('refuses missing actual %s observations', kind => {
  expect(() => updateProgressReport(progress().filter(row => row.kind !== kind))).toThrow();
});
test('refuses backwards progress clocks and a source-document-only modal', () => {
  const rows = progress(), first = rows[1]; if (first === undefined) throw new Error('Missing first progress');
  first.host = 999; expect(() => updateProgressReport(rows)).toThrow('clock');
  expect(() => updateProgressReport(progress().filter(row => row.kind !== 'updateProgress' || row.origin !== 2))).toThrow('both documents');
});
test.each([0, Number.NaN])('refuses an unmeasured update tap clock %s', host => {
  const rows = progress(), tap = rows[0]; if (tap === undefined) throw new Error('Missing tap');
  tap.host = host; expect(() => updateProgressReport(rows)).toThrow('tap clock');
});
