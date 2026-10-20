import { expect, it } from 'vitest';
import { accuracyReport } from '../scripts/loading-benchmark/accuracy-report.mjs';

it('rejects an unlabelled gap over two seconds even if the stage sum balances', () => {
  const receipt = accuracyReport({ readyAt: 3000, updates: [0, 1000, 2000, 3000],
    final: { clock: '00:03.0', networkBytes: '100', rows: [{ label: '', duration: '3 s' }] } }, 100);
  expect(receipt.failures).toContain('Unlabelled gap exceeds 2 s');
});
it('accepts balanced labelled stages with live text and matching transport bytes', () => {
  const receipt = accuracyReport({ readyAt: 3000, updates: [0, 900, 1800, 2700],
    final: { clock: '00:03.0', networkBytes: '100', rows: [{ label: 'Admission', duration: '3 s' }] } }, 102);
  expect(receipt.failures).toEqual([]);
});

it('rejects missing seconds even inside the three-second stage-sum allowance', () => {
  const receipt = accuracyReport({ readyAt: 3000, updates: [0, 900, 1800, 2700],
    final: { clock: '00:03.0', networkBytes: '100', rows: [{ label: 'Admission', duration: '0.5 s' }] } }, 100);
  expect(receipt.failures).toContain('Unlabelled gap exceeds 2 s');
});
