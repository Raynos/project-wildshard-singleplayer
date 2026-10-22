"""Temporary tool ownership, graceful drain and smoke notice continuity."""
import asyncio
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
TOOLS = runpy.run_path(str(ROOT / 'scripts/sp-tools.py'))
SMOKE = runpy.run_path(str(ROOT / 'scripts/smoke-watch.py'))


class Cadence(unittest.IsolatedAsyncioTestCase):
    async def test_stop_drains_one_active_tick_without_starting_another(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='tools-test-') as temp:
            root = Path(temp)
            stop = asyncio.Event()
            command = [sys.executable, '-c',
                       'import pathlib,time; p=pathlib.Path("calls"); p.write_text("start"); '
                       'time.sleep(.08); p.write_text(p.read_text()+" end")']
            asyncio.get_running_loop().call_later(.03, stop.set)
            await TOOLS['cadence'](root, 'fixture', command, .01, stop, os.environ)
            self.assertEqual((root / 'calls').read_text(), 'start end')

    async def test_stop_before_a_delayed_wake_does_not_send_it(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='tools-test-') as temp:
            root = Path(temp)
            stop = asyncio.Event()
            asyncio.get_running_loop().call_soon(stop.set)
            await TOOLS['cadence'](root, 'wake', [sys.executable, '-c', 'raise Exception()'],
                                   900, stop, os.environ, delay=900)
            self.assertFalse((root / 'calls').exists())


class Ownership(unittest.TestCase):
    def test_reused_pid_is_not_an_owner(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='tools-test-') as temp:
            state = Path(temp) / 'owner.json'
            state.write_text(json.dumps({'pid': os.getpid(), 'identity': 'old process'}))
            self.assertIsNone(TOOLS['owner'](state))
            state.write_text(json.dumps({'pid': os.getpid(), 'identity': TOOLS['identity'](os.getpid())}))
            self.assertEqual(TOOLS['owner'](state)['pid'], os.getpid())

    def test_old_smoke_notices_carry_once_without_replacing_new_state(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='tools-test-') as temp:
            old, new = Path(temp) / 'old', Path(temp) / 'new'
            old.mkdir()
            (old / 'smoke-notices.json').write_text('["old"]')
            (old / 'live-version.json').write_text('{"build":"old"}')
            (old / 'smoke-watch.py').write_text('old tooling')
            SMOKE['migrate_state'](new, old)
            self.assertEqual((new / 'smoke-notices.json').read_text(), '["old"]')
            self.assertFalse((new / 'smoke-watch.py').exists())
            (new / 'smoke-notices.json').write_text('["new"]')
            SMOKE['migrate_state'](new, old)
            self.assertEqual((new / 'smoke-notices.json').read_text(), '["new"]')

    def test_release_wake_is_fifteen_minutes_and_uses_question_guard(self):
        self.assertIn(('release-wake', 'sp-tools.py', 900), TOOLS['TICKS'])
        with patch.object(sys, 'argv', ['sp-tools.py', 'wake']), \
             patch.dict(os.environ, HERDR_ENV='1'), \
             patch('subprocess.run') as command, \
             patch.dict(TOOLS['main'].__globals__, common=lambda _: ROOT / '.git'):
            command.return_value.returncode = 0
            with self.assertRaises(SystemExit):
                TOOLS['main']()
            self.assertEqual(command.call_args.args[0][:2], ['scripts/herdr-prompt.sh', 'sp-x7'])


if __name__ == '__main__':
    unittest.main()
