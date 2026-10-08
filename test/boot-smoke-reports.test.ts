import { expect, it } from 'vitest';
import { bootErrorReport, bootLifecycleDiagnostic } from '../scripts/parity/boot-smoke.mjs';

it('preserves fatal report fields rather than hiding them behind an API 404', () => {
  const payload = { system: 'boot-entry', fatal: true, message: 'Asset already registered: scene:undefined', stack: 'actual stack' };
  expect(bootErrorReport('http://127.0.0.1:4400/api/errors', 'POST', JSON.stringify(payload))).toEqual(payload);
});

it('preserves a lifecycle finding for classification and keeps unrelated API traffic separate', () => {
  const payload = { system: 'lifecycle', fatal: false, message: 'boot followed reload', stack: 'actual trace' };
  expect(bootErrorReport('http://127.0.0.1:4400/api/errors', 'POST', JSON.stringify(payload))).toEqual(payload);
  expect(bootErrorReport('http://127.0.0.1:4400/api/telemetry', 'POST', '{}')).toBeNull();
  expect(bootErrorReport('http://127.0.0.1:4400/api/errors', 'GET', null)).toBeNull();
  expect(bootErrorReport('http://127.0.0.1:4400/api/errors', 'POST', 'broken')).toEqual({ malformed: 'broken' });
});

it('acknowledges only nonfatal boot-after-hide findings after observed grid navigation', () => {
  const report = { system: 'lifecycle', fatal: false, message: 'boot after the last page ended on "hide" (nav navigate): 18 frames / 6s', stack: 'original trace' };
  expect(bootLifecycleDiagnostic(report, true)).toBe(true);
  expect(bootLifecycleDiagnostic(report, false)).toBe(false);
  expect(bootLifecycleDiagnostic({ ...report, message: 'boot after the last page ended on "reload" (nav reload): 18 frames / 6s' }, true)).toBe(false);
  expect(bootLifecycleDiagnostic({ ...report, message: 'back after 10 min: restored, 18 frames / 6s' }, true)).toBe(false);
  expect(bootLifecycleDiagnostic({ ...report, fatal: true }, true)).toBe(false);
  expect(bootLifecycleDiagnostic({ ...report, system: 'boot-entry' }, true)).toBe(false);
  expect(bootLifecycleDiagnostic({ system: 'lifecycle' }, true)).toBe(false);
  expect(bootLifecycleDiagnostic({ system: 'lifecycle', fatal: 0 }, true)).toBe(false);
  for (const malformed of [null, 'lifecycle', false, [], { malformed: 'broken' }]) {
    expect(bootLifecycleDiagnostic(malformed, true)).toBe(false);
  }
});
