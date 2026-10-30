import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('prebuilt', Path(__file__).with_name('prebuilt-output.py'))
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
            '.vercel/output/functions/api/inbox.func/.vc-config.json': '{}',
            '.vercel/output/functions/api/errors.func/.vc-config.json': '{}',
            '.vercel/output/functions/api/errors.func/index.js': 'export default()=>{};',
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

    def test_wrong_source_or_producer_refuses_before_writes(self):
        for sha, run in [('b' * 40, '123'), (SHA, '124')]:
            with self.assertRaisesRegex(ValueError, 'source SHA/run'):
                prebuilt.restore(self.target, self.packet, sha, run)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_truncated_transport_refuses_before_writes(self):
        path = self.packet / 'prebuilt.tar.zst'
        path.write_bytes(path.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, 'transport checksum'):
            prebuilt.restore(self.target, self.packet, SHA, '123')
        self.assertEqual(list(self.target.iterdir()), [])

    def test_wrong_member_hash_and_missing_or_duplicate_inventory_refuse(self):
        original = (self.packet / 'proof.json').read_text()
        for change in (lambda p: p['files'][0].update(hash='0' * 64),
                       lambda p: p['files'].pop(),
                       lambda p: p['files'].append(p['files'][0])):
            self.proof(change)
            with self.assertRaises(ValueError):
                prebuilt.restore(self.target, self.packet, SHA, '123')
            self.assertEqual(list(self.target.iterdir()), [])
            (self.packet / 'proof.json').write_text(original)

    def test_destination_symlink_is_never_followed(self):
        (self.target / '.vercel').symlink_to(self.source / '.vercel', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'destination'):
            prebuilt.restore(self.target, self.packet, SHA, '123')
        self.assertEqual((self.source / '.vercel/output/static/index.html').read_text(), self.files['.vercel/output/static/index.html'])

    def test_version_must_belong_to_tested_source(self):
        (self.source / '.vercel/output/static/version.json').write_text('{"build":"wrong"}')
        with self.assertRaisesRegex(ValueError, 'version differs'):
            prebuilt.pack(self.source, self.root / 'bad', SHA, '123')


if __name__ == '__main__':
    unittest.main()
