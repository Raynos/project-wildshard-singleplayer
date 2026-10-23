import { expect, it } from 'vitest';
import calibrations from '../src/loadingCalibration.json';
import receipt from '../progress/loading/l12-calibration-1c61174.json';
import { loadingExpectations } from '../src/engine/boot/weights';
import { loadingPath } from '../src/game/boot/loadingPaths';

it('uses the measured workload model for uncalibrated shardfile loads, within fifteen points at observed step starts', () => {
  const model = calibrations.find(row => row.identity === '*' && row.path === 'shardfile');
  if (model === undefined) throw new Error('Missing shardfile workload model');
  const steps = loadingPath('shardfile').steps;
  for (const run of receipt.runs) {
    const expected = loadingExpectations(steps, model.ms, {}, model.workload, run.declaredBytes);
    const total = Object.values(expected).reduce((sum, ms) => sum + ms, 0);
    let estimated = 0, elapsed = 0;
    for (const step of steps) {
      expect(Math.abs(estimated / total - elapsed / run.loaderMs), `${run.mode} ${step.key}`).toBeLessThanOrEqual(0.15);
      estimated += expected[step.key] ?? 0;
      elapsed += Object.entries(run.ms).find(([key]) => key === step.key)?.[1] ?? 0;
    }
  }
});
