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
        source = Path('src')
        self.table = (source / 'table.generated.ts').as_posix()
        self.shard = source / 'shards' / 'fictional'
        self.asset = (self.shard / 'assets' / 'hash').as_posix()
        self.policy = (self.shard / '.wildshard' / 'build-policy.json').as_posix()
        (self.root / '.gitignore').write_text(f'{source}/*.generated.ts\npublic/generated.bin\nout/\nnode_modules/\nlint/*.generated.json\n')
        (self.root / 'scripts').mkdir()
        self.catalogue = {'jobs': [{'outputs': [self.asset],
                                   'buildOutputs': {'public/generated.bin': 'hash'},
                                   'buildTimeOutputs': [self.table]}]}
        (self.root / 'scripts/generation-jobs.json').write_text(json.dumps(self.catalogue))
        subprocess.run(['git', '-C', str(self.root), 'add', '.gitignore'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'fixture'], check=True)
        self.sha = products.git(self.root, 'rev-parse', 'HEAD').decode().strip()
        self.env = patch.dict(os.environ, {'GITHUB_SHA': self.sha, 'GITHUB_RUN_ID': '123'})
        self.env.start()
        self.addCleanup(self.env.stop)
        for name, content in {self.table: b'export const value=7;', 'public/generated.bin': b'\0\x01', 'out/fictional/shard.json': b'{"format":2}',
                              self.asset: b'retained bytes',
                              'lint/shard-words.generated.json': b'{"slugs":["fictional"]}',
                              self.policy: b'{"version":1,"decisionLegacyLines":100}'}.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        self.create_phase_receipt()
        products.pack(self.root)

    def phase_probe(self, action):
        repo = Path(__file__).resolve().parents[1]
        probe = f"""
          import {{InputHashMemo}} from '{(repo/'scripts/bake-input-hashes.mjs').as_uri()}';
          import {{generationSnapshotIdentity,publishGenerationSnapshot,verifiedGenerationSnapshot}} from '{(repo/'scripts/generation-snapshot.mjs').as_uri()}';
          const root=process.argv[1], action=process.argv[2], memo=new InputHashMemo(root);
          memo.enableSnapshot(file=>file==='public/generated.bin');
          const path=root+'/.cache/generation-phase.json', identity=generationSnapshotIdentity('CI fixture');
          if(action==='create'){{memo.hash('src/table.generated.ts');publishGenerationSnapshot(path,identity,memo,{{'public/generated.bin':memo.hash('public/generated.bin',true)}});}}
          else console.log(verifiedGenerationSnapshot(path,identity,memo,['public/generated.bin']));
        """
        return subprocess.run(['node','--input-type=module','-e',probe,str(self.root),action],
                              text=True,capture_output=True,check=True).stdout.strip()

    def create_phase_receipt(self):
        self.phase_probe('create')

    def test_phase_receipt_transfers_and_rechecks_real_inputs_and_outputs(self):
        products.pack(self.root, generated=True)
        (self.root / products.PHASE).unlink()
        (self.root / self.table).unlink()
        products.unpack(self.root, generated=True)
        self.assertEqual(self.phase_probe('verify'), 'true')
        (self.root / 'public/generated.bin').write_bytes(b'changed output')
        self.assertEqual(self.phase_probe('verify'), 'false')
        (self.root / 'public/generated.bin').write_bytes(b'\0\x01')
        (self.root / self.table).write_text('changed input')
        self.assertEqual(self.phase_probe('verify'), 'false')

    def test_only_the_fixed_phase_cache_path_is_admitted(self):
        self.assertEqual(str(products.admitted_path(products.PHASE)), products.PHASE)
        with self.assertRaisesRegex(ValueError, 'Unexpected prepared output path'):
            products.admitted_path('.cache/other.json')
        (self.root / products.PHASE).unlink()
        with self.assertRaisesRegex(ValueError, 'missing its verified phase receipt'):
            products.pack(self.root, generated=True)


    def test_round_trip_restores_inputs_and_products(self):
        declared, required = products.catalogue_outputs(self.root)
        policy = self.policy
        words = 'lint/shard-words.generated.json'
        for name in declared | required | {policy, words, 'out/fictional/shard.json'}:
            (self.root / name).unlink()
        products.unpack(self.root)
        for name in declared | required:
            self.assertTrue((self.root / name).is_file(), name)
        self.assertEqual(json.loads((self.root / policy).read_text())['decisionLegacyLines'], 100)
        self.assertEqual(json.loads((self.root / words).read_text())['slugs'], ['fictional'])
        repo = Path(__file__).resolve().parents[1]
        probe = f"""
          import {{projectDecisionBudget}} from '{(repo / 'src/sdk/projectPolicy.ts').as_uri()}';
          import {{decisionLineCeiling}} from '{(repo / 'src/sdk/buildDecisionScripts.ts').as_uri()}';
          const ceiling = decisionLineCeiling({{decisionLegacyLines: projectDecisionBudget(process.argv[1])}});
          if (ceiling !== 10) throw new Error('Restored policy did not reach decision admission');
        """
        subprocess.run(['node', '--import', str(repo / 'scripts/bake-loader.mjs'), '--input-type=module',
                        '-e', probe, str(self.root / self.shard)], check=True)
        self.assertEqual((self.root / 'public/generated.bin').read_bytes(), b'\0\x01')
        self.assertEqual((self.root / self.table).read_text(), 'export const value=7;')
        self.assertEqual((self.root / 'out/fictional/shard.json').read_text(), '{"format":2}')

    def test_unchanged_retained_catalogue_output_is_transferred(self):
        name = self.asset
        subprocess.run(['git', '-C', str(self.root), 'add', name], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
                        'commit', '-qm', 'retained asset'], check=True)
        os.environ['GITHUB_SHA'] = products.git(self.root, 'rev-parse', 'HEAD').decode().strip()
        products.pack(self.root)
        proof = json.loads((self.root / products.PROOF).read_text())
        self.assertIn(name, proof['retained'])
        products.unpack(self.root)
        self.assertEqual((self.root / name).read_bytes(), b'retained bytes')

    def retain_asset(self):
        subprocess.run(['git', '-C', str(self.root), 'add', self.asset], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
                        'commit', '-qm', 'tracked output'], check=True)
        os.environ['GITHUB_SHA'] = products.git(self.root, 'rev-parse', 'HEAD').decode().strip()
        products.pack(self.root)

    def test_dirty_tracked_output_is_transferred_not_retained_even_when_staged(self):
        self.retain_asset()
        (self.root / self.asset).write_bytes(b'new producer bytes')
        subprocess.run(['git', '-C', str(self.root), 'add', self.asset], check=True)
        products.pack(self.root)
        proof = json.loads((self.root / products.PROOF).read_text())
        self.assertNotIn(self.asset, proof['retained'])
        (self.root / self.asset).unlink()
        products.unpack(self.root)
        self.assertEqual((self.root / self.asset).read_bytes(), b'new producer bytes')

    def test_missing_or_changed_retained_output_refuses_before_writes(self):
        self.retain_asset()
        (self.root / self.table).unlink()
        for content in [None, b'corrupt checkout']:
            if content is None:
                (self.root / self.asset).unlink()
            else:
                (self.root / self.asset).write_bytes(content)
            with self.assertRaisesRegex(ValueError, 'retained output|Retained output'):
                products.unpack(self.root)
            self.assertFalse((self.root / self.table).exists())

    def test_retained_inventory_cannot_overlap_an_archive_member(self):
        self.retain_asset()
        with tarfile.open(self.root / products.ARCHIVE, 'a') as archive:
            archive.add(self.root / self.asset, arcname=self.asset)
        proof = json.loads((self.root / products.PROOF).read_text())
        proof.update(sha256=products.digest(self.root / products.ARCHIVE), files=proof['files'] + 1)
        (self.root / products.PROOF).write_text(json.dumps(proof))
        (self.root / self.table).unlink()
        with self.assertRaisesRegex(ValueError, 'overlaps'):
            products.unpack(self.root)
        self.assertFalse((self.root / self.table).exists())

    def test_retained_symlink_parent_refuses_even_inside_checkout(self):
        self.retain_asset()
        path = self.root / self.asset
        moved = self.root / 'other-assets'
        path.parent.rename(moved)
        path.parent.symlink_to(moved, target_is_directory=True)
        (self.root / self.table).unlink()
        with self.assertRaisesRegex(ValueError, 'Unsafe prepared output'):
            products.unpack(self.root)
        self.assertFalse((self.root / self.table).exists())

    def test_retained_mode_is_checked_before_writes(self):
        self.retain_asset()
        (self.root / self.asset).chmod(0o755)
        (self.root / self.table).unlink()
        with self.assertRaisesRegex(ValueError, 'Retained output differs'):
            products.unpack(self.root)
        self.assertFalse((self.root / self.table).exists())

    def test_required_output_is_admitted_from_retained_inventory(self):
        subprocess.run(['git', '-C', str(self.root), 'add', '-f', self.table], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com',
                        'commit', '-qm', 'tracked required table'], check=True)
        os.environ['GITHUB_SHA'] = products.git(self.root, 'rev-parse', 'HEAD').decode().strip()
        products.pack(self.root, generated=True)
        products.unpack(self.root, generated=True)
        proof = json.loads((self.root / products.archive_names(True)[1]).read_text())
        self.assertIn(self.table, proof['retained'])
        self.assertEqual((self.root / self.table).read_text(), 'export const value=7;')


    def test_wrong_sha_and_run_refuse(self):
        for key in ['sha', 'run']:
            proof = json.loads((self.root / products.PROOF).read_text())
            proof[key] = 'wrong'
            (self.root / products.PROOF).write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError, 'different SHA or CI run'):
                products.unpack(self.root)
            products.pack(self.root)

    def duplicate_payload(self):
        source, other = 'public/duplicate.bin', 'out/fictional/duplicate.bin'
        payload = bytes(range(256)) * 512
        for name in [source, other]:
            (self.root / name).write_bytes(payload)
        (self.root / other).chmod(0o755)
        products.pack(self.root)
        proof = json.loads((self.root / products.PROOF).read_text())
        self.assertEqual(len(proof['duplicates']), 1)
        duplicate, row = next(iter(proof['duplicates'].items()))
        return payload, duplicate, row, proof

    def test_duplicate_payloads_restore_exact_paths_bytes_and_modes(self):
        payload, duplicate, row, proof = self.duplicate_payload()
        source = row['source']
        with tarfile.open(self.root / products.ARCHIVE) as archive:
            self.assertNotIn(duplicate, archive.getnames())
            self.assertEqual(archive.getmember(source).size, len(payload))
        mode = (self.root / duplicate).stat().st_mode & 0o777
        (self.root / duplicate).unlink()
        (self.root / source).unlink()
        products.unpack(self.root)
        self.assertEqual((self.root / duplicate).read_bytes(), payload)
        self.assertEqual((self.root / source).read_bytes(), payload)
        self.assertEqual((self.root / duplicate).stat().st_mode & 0o777, mode)
        self.assertNotEqual((self.root / duplicate).stat().st_ino, (self.root / source).stat().st_ino)

    def test_duplicate_tampering_refuses_before_any_writes(self):
        _, duplicate, row, proof = self.duplicate_payload()
        (self.root / self.table).unlink()
        for field, bad in [('source', duplicate), ('source', '../../outside'),
                           ('size', row['size'] + 1), ('sha256', '0' * 64), ('mode', 0o1000)]:
            proof['duplicates'][duplicate] = {**row, field: bad}
            (self.root / products.PROOF).write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError, 'duplicate'):
                products.unpack(self.root)
            self.assertFalse((self.root / self.table).exists())

    def test_duplicate_inventory_rejects_overlap_and_symlink_parent(self):
        _, duplicate, row, proof = self.duplicate_payload()
        (self.root / self.table).unlink()
        proof['duplicates'][row['source']] = row
        (self.root / products.PROOF).write_text(json.dumps(proof))
        with self.assertRaisesRegex(ValueError, 'overlaps'):
            products.unpack(self.root)
        del proof['duplicates'][row['source']]
        (self.root / products.PROOF).write_text(json.dumps(proof))
        parent = (self.root / duplicate).parent
        moved = self.root / 'duplicate-parent'
        parent.rename(moved)
        parent.symlink_to(moved, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Unsafe prepared output'):
            products.unpack(self.root)
        self.assertFalse((self.root / self.table).exists())

    def test_required_generated_output_can_be_a_verified_duplicate(self):
        payload = bytes(range(256)) * 512
        (self.root / 'public/generated.bin').write_bytes(payload)
        (self.root / self.table).write_bytes(payload)
        self.create_phase_receipt()
        products.pack(self.root, generated=True)
        proof = json.loads((self.root / products.archive_names(True)[1]).read_text())
        self.assertIn(self.table, proof['duplicates'])
        (self.root / self.table).unlink()
        products.unpack(self.root, generated=True)
        self.assertEqual((self.root / self.table).read_bytes(), payload)
        self.assertEqual(self.phase_probe('verify'), 'true')

    def test_legacy_proof_without_duplicates_still_restores(self):
        proof = json.loads((self.root / products.PROOF).read_text())
        del proof['duplicates']
        (self.root / products.PROOF).write_text(json.dumps(proof))
        (self.root / self.table).unlink()
        products.unpack(self.root)
        self.assertTrue((self.root / self.table).is_file())

    def test_duplicate_cannot_use_an_archived_file_as_a_parent(self):
        _, duplicate, row, proof = self.duplicate_payload()
        proof['duplicates'] = {row['source'] + '/child': row}
        (self.root / products.PROOF).write_text(json.dumps(proof))
        (self.root / self.table).unlink()
        with self.assertRaisesRegex(ValueError, 'Unsafe prepared output hierarchy'):
            products.unpack(self.root)
        self.assertFalse((self.root / self.table).exists())

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


    def run_prepared_checks(self):
        repo = Path(__file__).resolve().parents[1]
        for name in ['ci-checks.mjs', 'ci-products.py']:
            (self.root / 'scripts' / name).write_bytes((repo / 'scripts' / name).read_bytes())
        (self.root / 'package.json').write_text(json.dumps({'type': 'module', 'scripts': {
            'test:checks': 'pnpm gen && node check.mjs'}}))
        (self.root / 'check.mjs').write_text("""
          import {readFileSync,writeFileSync} from 'node:fs';
          if(readFileSync('src/table.generated.ts','utf8')!=='export const value=7;')throw new Error('Missing verified preparation');
          writeFileSync('checks-ran','once');
        """)
        (self.root / 'extra.mjs').write_text("import {writeFileSync} from 'node:fs';writeFileSync('extra-ran','once');")
        return subprocess.run(['node', 'scripts/ci-checks.mjs', '--prepared', 'node extra.mjs'],
                              cwd=self.root, text=True, capture_output=True)

    def test_prepared_checks_restore_exact_run_without_generation(self):
        (self.root / self.table).unlink()
        result = self.run_prepared_checks()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.root / 'checks-ran').read_text(), 'once')
        self.assertEqual((self.root / 'extra-ran').read_text(), 'once')
        self.assertNotIn('ci-checks: gen ', result.stdout)
        self.assertIn('verified same-run preparation', result.stdout)

    def test_prepared_checks_refuse_a_foreign_run_before_any_checks(self):
        proof = json.loads((self.root / products.PROOF).read_text())
        proof['run'] = 'foreign'
        (self.root / products.PROOF).write_text(json.dumps(proof))
        result = self.run_prepared_checks()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('different SHA or CI run', result.stderr)
        self.assertFalse((self.root / 'checks-ran').exists())
        self.assertFalse((self.root / 'extra-ran').exists())

    def test_prepared_checks_require_the_archive_without_rebuilding(self):
        (self.root / products.ARCHIVE).unlink()
        result = self.run_prepared_checks()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('ci-checks: gen ', result.stdout)
        self.assertFalse((self.root / 'checks-ran').exists())
        self.assertFalse((self.root / 'extra-ran').exists())


    def test_generated_inputs_transfer_without_granting_product_proof(self):
        products.pack(self.root, generated=True)
        archive_name, proof_name = products.archive_names(True)
        with tarfile.open(self.root / archive_name, 'r') as archive:
            self.assertFalse(any(member.name.startswith('out/') for member in archive.getmembers()))
        (self.root / self.table).unlink()
        (self.root / 'out/fictional/shard.json').unlink()
        products.unpack(self.root, generated=True)
        self.assertTrue((self.root / self.table).is_file())
        self.assertFalse((self.root / 'out/fictional/shard.json').exists())
        # Renaming generated-only evidence cannot satisfy a full consumer.
        (self.root / products.ARCHIVE).write_bytes((self.root / archive_name).read_bytes())
        (self.root / products.PROOF).write_bytes((self.root / proof_name).read_bytes())
        with self.assertRaisesRegex(ValueError, 'products are missing'):
            products.unpack(self.root)

    def test_generated_inputs_refuse_foreign_run_and_product_members_before_writing(self):
        products.pack(self.root, generated=True)
        archive_name, proof_name = products.archive_names(True)
        proof = json.loads((self.root / proof_name).read_text())
        proof['run'] = 'foreign'
        (self.root / proof_name).write_text(json.dumps(proof))
        with self.assertRaisesRegex(ValueError, 'different SHA or CI run'):
            products.unpack(self.root, generated=True)
        products.pack(self.root, generated=True)
        with tarfile.open(self.root / archive_name, 'a') as archive:
            archive.add(self.root / 'out/fictional/shard.json', arcname='out/fictional/shard.json')
        proof = json.loads((self.root / proof_name).read_text())
        proof.update(sha256=products.digest(self.root / archive_name), files=proof['files'] + 1)
        (self.root / proof_name).write_text(json.dumps(proof))
        (self.root / self.table).unlink()
        with self.assertRaisesRegex(ValueError, 'cannot contain products'):
            products.unpack(self.root, generated=True)
        self.assertFalse((self.root / self.table).exists())


if __name__ == '__main__':
    unittest.main()
