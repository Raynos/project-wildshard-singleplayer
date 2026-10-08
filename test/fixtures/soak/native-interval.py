"""Exercise the real sampler loop against a deterministic kernel-memory double."""
import contextlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location('phases', ROOT / 'scripts/sim-mem-phases.py')
PHASES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PHASES)


class Intervals(unittest.TestCase):
    def test_sample_interval_high_is_opt_in_and_phase_peaks_are_preserved(self):
        for fresh in (False, True):
            with tempfile.TemporaryDirectory() as scratch:
                phase = pathlib.Path(scratch) / 'phase'
                output = pathlib.Path(scratch) / 'samples.jsonl'
                phase.write_text('drive')
                clock = {'step': 0}
                values = [400_000_000, 100_000_000, 100_000_000, 100_000_000, 100_000_000]

                class Kernel:
                    def __init__(self):
                        self.reset = 0

                    def sample(self, pid):
                        step = clock['step']
                        return {'pid': pid, 'startAbstime': 123,
                                'physicalFootprintBytes': values[step],
                                'intervalMaxPhysicalFootprintBytes': max(values[self.reset:step + 1])}

                    def reset_interval(self, pid):
                        self.reset = clock['step']

                def sleep(_seconds):
                    clock['step'] += 1
                    if clock['step'] == 4:
                        phase.write_text('done')

                def processes(_manager, kind=None):
                    return {7} if kind is None else set()

                args = ['sampler', '--device', 'fake', '--phase-file', str(phase),
                        '--out', str(output), '--interval', '1', '--max', '100']
                if fresh:
                    args.append('--sample-interval-high')
                with patch.object(sys, 'argv', args), patch.object(PHASES.wd, 'NativeMemory', Kernel), \
                        patch.object(PHASES.wd, 'command', return_value='1'), \
                        patch.object(PHASES.wd, 'simulator_processes', processes), \
                        patch.object(PHASES.time, 'monotonic', lambda: clock['step']), \
                        patch.object(PHASES.time, 'sleep', sleep), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(PHASES.main(), 0)
                rows = [json.loads(line) for line in output.read_text().splitlines()]
                samples = [row for row in rows if row['type'] == 'sample']
                self.assertEqual([row['footprint'] for row in samples], values[:4])
                self.assertEqual([row['interval'] for row in samples],
                                 [400_000_000, 400_000_000, 100_000_000, 100_000_000] if fresh
                                 else [400_000_000] * 4)
                summary = rows[-1]['phases']['drive']
                self.assertEqual(summary['gameHighGB'], 0.4)
                self.assertEqual(summary['allWebContentGB'], 0.4)
                self.assertEqual(rows[-1]['lost'], [])


if __name__ == '__main__':
    unittest.main()
