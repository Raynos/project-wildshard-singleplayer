import { expect, it } from 'vitest';
import { bootErrorReport } from '../scripts/parity/boot-smoke.mjs';

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
