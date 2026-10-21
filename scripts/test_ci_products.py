"""The CI preparation must survive transfer and refuse wrong or unsafe bytes."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ci_products', Path(__file__).with_name('ci-products.py'))
products = importlib.util.module_from_spec(spec)
spec.loader.exec_module(products)


class PreparedProducts(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / 'tmp')
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        (self.root / '.gitignore').write_text('src/*.generated.ts\npublic/generated.bin\nout/\nnode_modules/\n')
        subprocess.run(['git', '-C', str(self.root), 'add', '.gitignore'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture'], check=True)
        self.sha = products.git(self.root, 'rev-parse', 'HEAD').decode().strip()
        self.env = patch.dict(os.environ, {'GITHUB_SHA': self.sha, 'GITHUB_RUN_ID': '123'})
        self.env.start()
        self.addCleanup(self.env.stop)
        for name, content in {'src/table.generated.ts': b'export const value=7;', 'public/generated.bin': b'\0\x01', 'out/fictional/shard.json': b'{"format":2}'}.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        products.pack(self.root)

    def test_round_trip_restores_inputs_and_products(self):
        for name in ['src/table.generated.ts', 'public/generated.bin', 'out/fictional/shard.json']:
            (self.root / name).unlink()
        products.unpack(self.root)
        self.assertEqual((self.root / 'public/generated.bin').read_bytes(), b'\0\x01')
        self.assertEqual((self.root / 'src/table.generated.ts').read_text(), 'export const value=7;')
        self.assertEqual((self.root / 'out/fictional/shard.json').read_text(), '{"format":2}')

    def test_wrong_sha_and_run_refuse(self):
        for key in ['sha', 'run']:
            proof = json.loads((self.root / products.PROOF).read_text())
            proof[key] = 'wrong'
            (self.root / products.PROOF).write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError, 'different SHA or CI run'):
                products.unpack(self.root)
            products.pack(self.root)

    def test_corrupt_archive_refuses(self):
        with (self.root / products.ARCHIVE).open('ab') as stream:
            stream.write(b'changed')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            products.unpack(self.root)

    def test_link_member_refuses_before_writing(self):
        with tarfile.open(self.root / products.ARCHIVE, 'a') as archive:
            link = tarfile.TarInfo('out/unsafe')
            link.type = tarfile.SYMTYPE
            link.linkname = '../../outside'
            archive.addfile(link)
        proof = json.loads((self.root / products.PROOF).read_text())
        proof.update(sha256=products.digest(self.root / products.ARCHIVE), files=proof['files'] + 1)
        (self.root / products.PROOF).write_text(json.dumps(proof))
        (self.root / 'public/generated.bin').unlink()
        with self.assertRaisesRegex(ValueError, 'Unsafe prepared output'):
            products.unpack(self.root)
        self.assertFalse((self.root / 'public/generated.bin').exists())


if __name__ == '__main__':
    unittest.main()
