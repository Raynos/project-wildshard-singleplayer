"""Temporary tool ownership and graceful push drain."""
import asyncio
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = runpy.run_path(str(ROOT / 'scripts/sp-tools.py'))


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



class Ownership(unittest.TestCase):
    def test_reused_pid_is_not_an_owner(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp', prefix='tools-test-') as temp:
            state = Path(temp) / 'owner.json'
            state.write_text(json.dumps({'pid': os.getpid(), 'identity': 'old process'}))
            self.assertIsNone(TOOLS['owner'](state))
            state.write_text(json.dumps({'pid': os.getpid(), 'identity': TOOLS['identity'](os.getpid())}))
            self.assertEqual(TOOLS['owner'](state)['pid'], os.getpid())



if __name__ == '__main__':
    unittest.main()
