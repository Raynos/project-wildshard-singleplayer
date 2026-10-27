"""The red hold selects only an explicit fix prefix; it never changes history."""
from pathlib import Path
import runpy
import sys
import unittest


source = Path(__file__).resolve().parents[1] / 'scripts/push_red_hold.py'
if '--candidate-stdin' in sys.argv:
    sys.argv.remove('--candidate-stdin')
    candidate = {'__name__': 'push_red_hold_candidate'}
    exec(compile(sys.stdin.read(), str(source), 'exec'), candidate)
    select_tip = candidate['red_hold_tip']
else:
    select_tip = runpy.run_path(str(source))['red_hold_tip']


class RedHold(unittest.TestCase):
    def test_green_admits_the_whole_outgoing_batch(self):
        commits = [{'sha': 'a' * 40, 'message': 'feat: first'}, {'sha': 'b' * 40, 'message': 'perf: second'}]
        self.assertEqual(select_tip(commits, False), 'b' * 40)

    def test_red_holds_every_unmarked_commit_after_the_newest_fix(self):
        commits = [
            {'sha': 'a' * 40, 'message': 'feat: before'},
            {'sha': 'b' * 40, 'message': 'fix: repair\n\nRed-fix: 40414562022\n\nAssisted-by: lane:model'},
            {'sha': 'c' * 40, 'message': 'feat: after'},
        ]
        before = [dict(commit) for commit in commits]
        self.assertEqual(select_tip(commits, True), 'b' * 40)
        self.assertEqual(commits, before)
        commits.append({'sha': 'd' * 40, 'message': 'fix: next\n\nRed-fix: 40414562023'})
        self.assertEqual(select_tip(commits, True), 'd' * 40)

    def test_red_with_no_fix_marker_holds_the_batch(self):
        for message in ['feat: use Red-fix in prose', 'fix: empty\n\nRed-fix:   ', 'fix: quoted\n\n> Red-fix: 123']:
            with self.subTest(message=message):
                self.assertIsNone(select_tip([{'sha': 'a' * 40, 'message': message}], True))
        self.assertIsNone(select_tip([], True))

    def test_unknown_verdict_or_invalid_identity_cannot_admit_a_batch(self):
        with self.assertRaisesRegex(ValueError, 'completed push verdict'):
            select_tip([], None)
        for commits in [[{'sha': 'short', 'message': 'Red-fix: 123'}],
                        [{'sha': 'a' * 40, 'message': 'Red-fix: 123'}] * 2]:
            with self.subTest(commits=commits), self.assertRaisesRegex(ValueError, 'commit identity'):
                select_tip(commits, True)


if __name__ == '__main__':
    unittest.main()
