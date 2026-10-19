import { expect, test } from 'vitest';
import { proposedEnvelope } from './proposed-envelope';
test.each([1, 3])('stage %s full windup, stale observations, cancellation and recovery design', stage => {
  for (const phase of [0, 1, 2, 3]) {
    expect(proposedEnvelope(stage, phase, 0, 0)).toEqual({ tell: 0, cut: 0 });
    expect(proposedEnvelope(stage, phase, 0, .3)).toEqual({ tell: 1, cut: 0 });
    expect(proposedEnvelope(stage, phase, 0, .45)).toEqual({ tell: 1, cut: 0 });
    expect(proposedEnvelope(stage, phase, 0, .95)).toEqual({ tell: 0, cut: 1 });
  }
  expect(proposedEnvelope(stage, 1, .2, -1)).toEqual(proposedEnvelope(stage, 2, 0, -1));
  expect(proposedEnvelope(stage, 2, 0, -1)).toEqual(proposedEnvelope(stage, 3, 0, -1));
  expect(proposedEnvelope(stage, 3, stage === 1 ? .12 : 1.1, -1)).toEqual({ tell: 0, cut: 0 });
});
test('inactive, stunned and dead stages cannot become cuts from stale windup', () => {
  for (const stage of [0, 2, 5]) for (const phase of [0, 1, 2, 3]) for (const attack of [-1, 0, .5, 1])
    expect(proposedEnvelope(stage, phase, .1, attack)).toEqual({ tell: 0, cut: 0 });
});
test('30Hz phase-offset sweep bound is below .25rad for both strikes', () => {
  for (const [stage, duration] of [[1, .75], [3, .45]]) {
    if (stage === undefined || duration === undefined) throw new Error('Missing case');
    for (let offset = 0; offset < 100; offset++) {
      let previous = 0;
      for (let t = offset / 3000; t < duration + .1; t += 1 / 30) {
        const e = proposedEnvelope(stage, 1, 0, t < duration ? t / duration : -1);
        const angle = -.45 * e.tell + .65 * e.cut;
        expect(Math.abs(angle - previous)).toBeLessThan(.25); previous = angle;
      }
    }
  }
});
