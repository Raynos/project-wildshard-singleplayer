import runpy
from pathlib import Path
import sys
import unittest

if '--candidate-stdin' in sys.argv:
    sys.argv.remove('--candidate-stdin')
    POLICY = {}
    exec(compile(sys.stdin.read(), 'scripts/push_batch.py', 'exec'), POLICY)
else:
    POLICY = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/push_batch.py'))


class PushBatch(unittest.TestCase):
    def test_split_before_handoff_and_retain_the_exact_prefix(self):
        commits = [str(index) * 40 for index in range(1, 6)]
        decision = POLICY['batch_disposition'](commits, [], ['products'])
        self.assertEqual(decision, {'kind': 'split', 'tip': commits[1], 'unfinished': ['products']})
        self.assertEqual(POLICY['batch_disposition'](commits[:2], [], ['products'])['tip'], commits[0])
        self.assertEqual(commits, [str(index) * 40 for index in range(1, 6)])

    def test_only_named_unfinished_steps_are_handed_to_ci(self):
        self.assertEqual(POLICY['batch_disposition'](['a' * 40], [], ['products', 'tests-products']), {
            'kind': 'deferred', 'tip': 'a' * 40, 'unfinished': ['products', 'tests-products'],
            'tags': ['Gate-deferred: products', 'Gate-deferred: tests-products']})
        self.assertEqual(POLICY['batch_disposition'](['a' * 40], [], []), {'kind': 'passed', 'tip': 'a' * 40})

    def test_observed_refusals_never_turn_into_handoffs(self):
        for commits in [['a' * 40], ['a' * 40, 'b' * 40]]:
            self.assertEqual(POLICY['batch_disposition'](commits, ['types'], ['products']),
                             {'kind': 'refused', 'failed': ['types']})

    def test_unknown_or_ambiguous_batch_identity_refuses(self):
        for commits, failed, unfinished in [([], [], []), (['bad'], [], []),
                                           (['a' * 40, 'a' * 40], [], []),
                                           (['a' * 40], [], ['all checks']),
                                           (['a' * 40], ['types'], ['types'])]:
            with self.subTest(commits=commits, failed=failed, unfinished=unfinished):
                with self.assertRaises(ValueError):
                    POLICY['batch_disposition'](commits, failed, unfinished)


if __name__ == '__main__':
    unittest.main()
