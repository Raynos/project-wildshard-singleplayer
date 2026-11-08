import importlib.util
import hashlib
import io
import json
import os
import re
from pathlib import Path
import subprocess
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prebuilt', Path(__file__).resolve().parents[1] / 'scripts/prebuilt-output.py')
prebuilt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prebuilt)
SHA = 'a' * 40


class PrebuiltTests(unittest.TestCase):
    def setUp(self):
        Path('tmp').mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir='tmp')
        self.root = Path(self.temporary.name)
        self.source, self.target, self.packet = [self.root / name for name in ('source', 'target', 'packet')]
        self.target.mkdir()
        version = json.dumps({'build': SHA[:9] + '-fixture'})
        self.files = {
            '.vercel/output/config.json': '{"version":3}',
            '.vercel/output/static/index.html': '<html>actual shell</html>',
            '.vercel/output/static/sw.js': 'const BUILD="fixture";',
            '.vercel/output/static/version.json': version,
            **{f'.vercel/output/functions/api/{route}.func/{name}': body
               for route in ('inbox', 'errors', 'waitlist', 'telemetry')
               for name, body in {'.vc-config.json': '{"handler":"index.cjs","runtime":"nodejs22.x"}',
                                  'index.cjs': 'exports.OPTIONS=()=>new Response(null,{status:204});'}.items()},
            'dist/version.json': version,
            'dist/.vite/chunk-modules.json': '{"chunks":[]}',
            'dist/assets/main.js.map': '{"private":true}',
        }
        for name, body in self.files.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body)
        prebuilt.pack(self.source, self.packet, SHA, '123')

    def tearDown(self):
        self.temporary.cleanup()

    def proof(self, change):
        path = self.packet / 'proof.json'
        value = json.loads(path.read_text())
        change(value)
        path.write_text(json.dumps(value))

    def test_complete_runtime_functions_and_private_maps_restore_exactly(self):
        prebuilt.restore(self.target, self.packet, SHA, '123')
        self.assertEqual({p.relative_to(self.target).as_posix(): p.read_text()
                          for p in self.target.rglob('*') if p.is_file()}, self.files)

    def test_failed_diagnostic_sink_preserves_success_and_original_refusal(self):
        original_print = print
        def sink(value):
            if json.loads(value).get('report') == 'ci2-prebuilt-restore':
                raise OSError('diagnostic output unavailable')
            return original_print(value)
        with patch('builtins.print', sink):
            self.assertIsNone(prebuilt.restore(self.target, self.packet, SHA, '123', timings=True))
            with self.assertRaisesRegex(ValueError, 'source SHA/run'):
                prebuilt.restore(self.root / 'foreign', self.packet, 'b' * 40, '123', timings=True)
        self.assertFalse((self.root / 'foreign').exists())

    def test_stream_retains_the_original_tar_headers_order_and_padding(self):
        (self.source / '.vercel/output/functions/api/errors.func/alias.cjs').symlink_to('index.cjs')
        long_name = self.source / ('dist/assets/' + 'long-name-' * 14 + 'é.js.map')
        long_name.write_bytes(b'private source map with a PAX header')
        prebuilt.pack(self.source, self.packet, SHA, '123')
        proof = json.loads((self.packet / 'proof.json').read_text())
        expected = io.BytesIO()
        with tarfile.open(fileobj=expected, mode='w', dereference=False) as output:
            for row in proof['files']:
                path = self.source / row['path']
                if 'link' in row:
                    output.add(path, arcname=row['path'], recursive=False)
                else:
                    info = output.gettarinfo(str(path.resolve()), arcname=row['path'])
                    info.type, info.linkname, info.size = tarfile.REGTYPE, '', row['bytes']
                    with path.open('rb') as content:
                        output.addfile(info, content)
        actual = subprocess.check_output(['zstd', '-q', '-dc', str(self.packet / 'prebuilt.tar.zst')])
        self.assertEqual(actual, expected.getvalue())
        self.assertEqual(proof['archiveBytes'], len(actual))
        self.assertEqual(proof['archiveHash'], hashlib.sha256(actual).hexdigest())
        self.assertFalse((self.packet / 'prebuilt.tar').exists())

if __name__ == '__main__':
    unittest.main()
