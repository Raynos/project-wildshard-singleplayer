import importlib.util
import io
import json
import subprocess
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('boot_dist', Path(__file__).resolve().parents[1] / 'scripts/boot-dist.py')
boot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boot)


class Transfer(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(dir='tmp', prefix='boot-dist-test-')
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.dist, self.output = self.root / 'source', self.root / 'artifacts'
        self.sha = 'a' * 40
        self.values = {
            'index.html': b'<script src="/assets/shell.js"></script>',
            'version.json': b'{"build":"aaaaaaa-fixture"}',
            'assets/shell.js': b'const pack="/assets/packs/first.phone-current.bin";',
            'assets/boot-tables-a1b2c3.json': json.dumps({'packs': {'first': {'phone': {'parts': [
                {'url': '/assets/packs/first.phone-json.bin', 'bytes': 15,
                 'files': [['/assets/first/phone.webp', 0, 15, 'image/webp']]}
            ]}}}}).encode(),
            'assets/shell.js.map': b'unchanged source map',
            'assets/first/card.png': b'shared title image',
            'assets/first/scene.glb': bytes(range(256)),
            'assets/second/scene.glb': b'second geometry',
            'assets/shared/texture.png': b'shared texture',
            'assets/packs/first.phone-current.bin': b'current exact pack',
            'assets/packs/first.phone-json.bin': b'JSON exact pack',
            'assets/packs/first.phone-obsolete.bin': b'unreferenced historical pack',
            'shardfiles/first/shard.json': b'first exact descriptor',
            'shardfiles/second/shard.json': b'second exact descriptor',
        }
        for name, value in self.values.items():
            path = self.dist / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value)
        self.plan = {part: ['first', 'second'] for part in boot.PARTS}
        self.plan['boot-public'] = ['first']
        self.plan['boot-developer'] = ['second']
        self.plan['shared'] = ['assets/first/card.png']
        boot.pack(self.dist, self.output, self.plan, self.sha, '123')
        self.manifest = json.loads((self.output / 'boot-dist-manifest.json').read_text())

    def restore(self, part='boot-public', sha=None, run='123'):
        target = self.root / 'restored'
        boot.restore(self.output / (part if part in ('boot-public', 'boot-developer', 'phone-route') else 'worlds'), target, self.manifest, sha or self.sha, run, part)
        return target

    def test_every_selected_byte_and_shared_shell_survive(self):
        target = self.restore()
        expected = set(self.values) - {'assets/second/scene.glb', 'shardfiles/second/shard.json',
                                       'assets/packs/first.phone-obsolete.bin'}
        self.assertEqual({p.relative_to(target).as_posix() for p in target.rglob('*') if p.is_file()}, expected)
        for name in expected:
            self.assertEqual((target / name).read_bytes(), self.values[name])

    def test_other_leg_retains_shared_card_but_not_unselected_geometry(self):
        target = self.restore('boot-developer')
        self.assertEqual((target / 'assets/first/card.png').read_bytes(), self.values['assets/first/card.png'])
        self.assertFalse((target / 'assets/first/scene.glb').exists())
        self.assertTrue((target / 'shardfiles/second/shard.json').exists())

    def test_json_only_boot_table_pack_survives_with_exact_rows_and_bytes(self):
        target = self.restore()
        table = json.loads((target / 'assets/boot-tables-a1b2c3.json').read_text())
        part = table['packs']['first']['phone']['parts'][0]
        self.assertNotIn(part['url'].encode(), self.values['assets/shell.js'])
        self.assertEqual(part['files'], [['/assets/first/phone.webp', 0, 15, 'image/webp']])
        self.assertEqual((target / part['url'].lstrip('/')).read_bytes(), b'JSON exact pack')
        self.assertFalse((target / 'assets/packs/first.phone-obsolete.bin').exists())

    def test_grid_and_explorer_keep_all_worlds(self):
        for part in ('boot-grid', 'hover-chromium', 'hover-webkit', 'explorer', 'phone-route'):
            proof = json.loads((self.output / ('phone-route' if part == 'phone-route' else 'worlds') / 'boot-dist-proof.json').read_text())
            self.assertTrue({'shardfiles/first/shard.json', 'shardfiles/second/shard.json'}.issubset({r['path'] for r in proof['files']}))

    def test_phone_has_its_own_exact_archive_and_cannot_restore_worlds_as_phone(self):
        target = self.restore('phone-route')
        self.assertTrue((target / 'shardfiles/first/shard.json').exists())
        self.assertTrue((target / 'shardfiles/second/shard.json').exists())
        self.assertEqual(self.manifest['legs']['phone-route']['artifact'], 'phone-route')
        proof = json.loads((self.output / 'phone-route/boot-dist-proof.json').read_text())
        self.assertEqual(proof['parts'], ['phone-route'])
        with self.assertRaisesRegex(ValueError, 'SHA/run/leg'):
            boot.restore(self.output / 'worlds', self.root / 'wrong', self.manifest, self.sha, '123', 'phone-route')

    def test_truncated_transfer_refuses_without_retry_or_write(self):
        archive = self.output / 'boot-public/boot-dist.tar.zst'
        archive.write_bytes(archive.read_bytes()[:128])
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.restore()
        self.assertFalse((self.root / 'restored').exists())

    def test_missing_transfer_refuses_without_retry(self):
        (self.output / 'boot-public/boot-dist.tar.zst').unlink()
        with self.assertRaises(FileNotFoundError):
            self.restore()

    def test_matching_transport_checksum_cannot_authorize_invalid_compression(self):
        directory = self.output / 'boot-public'
        archive = directory / 'boot-dist.tar.zst'
        archive.write_bytes(b'not zstd')
        proof_path = directory / 'boot-dist-proof.json'
        proof = json.loads(proof_path.read_text())
        proof['transport'].update(bytes=archive.stat().st_size, hash=boot.digest(archive))
        proof_path.write_text(json.dumps(proof))
        self.manifest['legs']['boot-public']['transport'] = proof['transport']
        with self.assertRaisesRegex(ValueError, 'compression'):
            self.restore()
        self.assertFalse((self.root / 'restored').exists())

    def test_decompression_stops_at_the_attested_archive_extent_before_writes(self):
        proof_path = self.output / 'boot-public/boot-dist-proof.json'
        proof = json.loads(proof_path.read_text())
        proof['archiveBytes'] = 1
        proof_path.write_text(json.dumps(proof))
        self.manifest['legs']['boot-public']['archiveBytes'] = 1
        with self.assertRaisesRegex(ValueError, 'extent'):
            self.restore()
        self.assertFalse((self.root / 'restored').exists())

    def test_wrong_sha_run_or_leg_refuses(self):
        for kwargs in ({'sha': 'b' * 40}, {'run': '456'}):
            with self.assertRaisesRegex(ValueError, 'SHA/run/leg'):
                self.restore(**kwargs)
        proof_path = self.output / 'boot-public/boot-dist-proof.json'
        proof = json.loads(proof_path.read_text()); proof['parts'] = ['explorer']
        proof_path.write_text(json.dumps(proof))
        with self.assertRaisesRegex(ValueError, 'SHA/run/leg'):
            self.restore()

    def test_checksum_matching_bad_tar_still_refuses(self):
        directory = self.output / 'boot-public'
        archive = directory / 'boot-dist.tar'; archive.write_bytes(b'not tar')
        self.reseal(directory)
        with self.assertRaises(tarfile.ReadError):
            self.restore()
        self.assertFalse((self.root / 'restored').exists())

    def reseal(self, directory):
        archive = directory / 'boot-dist.tar'
        proof_path = directory / 'boot-dist-proof.json'
        proof = json.loads(proof_path.read_text())
        proof['archiveHash'], proof['archiveBytes'] = boot.digest(archive), archive.stat().st_size
        proof['transport'] = boot.compress_archive(archive)
        archive.unlink()
        proof_path.write_text(json.dumps(proof))
        self.manifest['legs']['boot-public'].update({k: proof[k] for k in ('archiveHash', 'archiveBytes', 'transport')})

    def test_symlink_traversal_extra_and_duplicate_members_refuse_before_write(self):
        directory = self.output / 'boot-public'
        original = subprocess.check_output(['zstd', '-q', '-dc', str(directory / 'boot-dist.tar.zst')])
        for name, kind in (('../escape', tarfile.REGTYPE), ('assets/link', tarfile.SYMTYPE),
                           ('extra', tarfile.REGTYPE), ('index.html', tarfile.REGTYPE)):
            (directory / 'boot-dist.tar').write_bytes(original)
            with tarfile.open(directory / 'boot-dist.tar', 'a') as tar:
                row = tarfile.TarInfo(name); row.type = kind; row.linkname = 'index.html'; row.size = 0
                tar.addfile(row, io.BytesIO())
            self.reseal(directory)
            with self.assertRaises(ValueError):
                self.restore()
            self.assertFalse((self.root / 'restored').exists())

    def test_pack_refuses_symlinks_and_wrong_version(self):
        (self.dist / 'link').symlink_to('index.html')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            boot.pack(self.dist, self.root / 'other', self.plan, self.sha, '123')
        (self.dist / 'link').unlink()
        with self.assertRaisesRegex(ValueError, 'version'):
            boot.pack(self.dist, self.root / 'other', self.plan, 'b' * 40, '123')


if __name__ == '__main__':
    unittest.main()
