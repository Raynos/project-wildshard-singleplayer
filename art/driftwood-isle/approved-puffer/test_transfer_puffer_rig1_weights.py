"""Focused read-only/in-memory transfer proofs; no Blender or runtime build."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from transfer_puffer_rig1_weights import (BASELINE_NAME, BASELINE_SHA256, RIG1_NAME,
                                        RIG1_SHA256, encode, sha256, transfer_native_bytes)


ROOT = Path(__file__).resolve().parent
WIDTHS = {'positions': 3, 'colorsLinear': 3, 'skinIndices': 4,
          'skinWeights': 4, 'furLen': 1}


class SemanticRig1Transfer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline_bytes = (ROOT / BASELINE_NAME).read_bytes()
        cls.rig1_bytes = (ROOT / RIG1_NAME).read_bytes()
        cls.baseline = json.loads(cls.baseline_bytes)

    def transfer(self, data, candidate='V999'):
        raw = encode(data)
        return transfer_native_bytes(raw, sha256(raw), candidate,
                                     self.baseline_bytes, self.rig1_bytes)

    def fin(self, data):
        return next(part for part in data['parts'] if part['name'] == 'Volumetric connected finL')

    def test_v57_reproduces_existing_rig1_byte_for_byte(self):
        native, receipt = transfer_native_bytes(self.baseline_bytes, BASELINE_SHA256, 'V57')
        self.assertEqual(native, self.rig1_bytes)
        self.assertEqual(sha256(native), RIG1_SHA256)
        self.assertEqual([row['changedTriangleVertices'] for row in receipt['fins']], [138] * 4)
        self.assertTrue(receipt['restPayloadUnchanged'])
        self.assertFalse(receipt['gaitAcceptance'])

    def test_triangle_and_part_reordering_does_not_change_semantic_mapping(self):
        data = copy.deepcopy(self.baseline)
        for part in data['parts']:
            count = len(part['positions']) // 9
            for key, width in WIDTHS.items():
                values = part[key]
                part[key] = [value for triangle in reversed(range(count))
                             for value in values[triangle * 3 * width:(triangle + 1) * 3 * width]]
        data['parts'].reverse()
        native, _ = self.transfer(data)
        result = json.loads(native)
        expected = json.loads(self.rig1_bytes)
        for part in expected['parts']:
            count = len(part['positions']) // 9
            for key, width in WIDTHS.items():
                values = part[key]
                part[key] = [value for triangle in reversed(range(count))
                             for value in values[triangle * 3 * width:(triangle + 1) * 3 * width]]
        expected['parts'].reverse()
        self.assertEqual(result, expected)

    def test_new_distal_toe_geometry_and_paint_survive_exactly(self):
        data = copy.deepcopy(self.baseline)
        part = self.fin(data)
        # Add a new low toe triangle with the existing semantic fin influence.
        part['positions'].extend([.60, .004, .95, .65, .02, .96, .70, .004, .95])
        part['colorsLinear'].extend([.9, .8, .6] * 3)
        fin_index = next(i for i, bone in enumerate(data['bones']) if bone['name'] == 'finL')
        part['skinIndices'].extend([fin_index, 0, 0, 0] * 3)
        part['skinWeights'].extend([1., 0., 0., 0.] * 3)
        part['furLen'].extend([0.] * 3)
        part['colorsLinear'][0] = .123
        before = copy.deepcopy(data)
        native, receipt = self.transfer(data)
        result = json.loads(native)
        self.assertEqual(data, before)
        self.assertEqual(result['bones'], data['bones'])
        for original, output in zip(data['parts'], result['parts']):
            for key in ('name', 'positions', 'colorsLinear', 'furLen'):
                self.assertEqual(output[key], original[key])
            if not original['name'].startswith('Volumetric connected '):
                self.assertEqual(output, original)
        self.assertEqual(self.fin(result)['skinWeights'][-12:], part['skinWeights'][-12:])
        self.assertEqual(receipt['fins'][0]['unchangedDistalTriangleVertices'], 261)

    def test_moved_protected_coordinate_is_rejected(self):
        data = copy.deepcopy(self.baseline)
        part = self.fin(data)
        index = next(i for i in range(len(part['positions']) // 3)
                     if part['positions'][3 * i + 1] > .4)
        part['positions'][3 * index] += .000001
        with self.assertRaisesRegex(ValueError, 'protected root/transition coordinate'):
            self.transfer(data)

    def test_missing_protected_occurrence_is_rejected(self):
        data = copy.deepcopy(self.baseline)
        part = self.fin(data)
        point = next(i for i in range(len(part['positions']) // 3)
                     if part['positions'][3 * i + 1] > .4)
        triangle = point // 3
        for key, width in WIDTHS.items():
            del part[key][triangle * 3 * width:(triangle + 1) * 3 * width]
        with self.assertRaisesRegex(ValueError, 'multiplicity mismatch'):
            self.transfer(data)

    def test_reversed_protected_triangle_is_rejected(self):
        data = copy.deepcopy(self.baseline)
        part = self.fin(data)
        for key, width in WIDTHS.items():
            values = part[key][:3 * width]
            part[key][:3 * width] = values[width:2 * width] + values[:width] + values[2 * width:]
        with self.assertRaisesRegex(ValueError, 'oriented triangle neighborhood mismatch'):
            self.transfer(data)

    def test_unknown_high_geometry_is_not_silently_left_unweighted(self):
        data = copy.deepcopy(self.baseline)
        part = self.fin(data)
        part['positions'][-2] = .25
        with self.assertRaisesRegex(ValueError, 'protected root/transition coordinate'):
            self.transfer(data)

    def test_bone_pivot_change_is_rejected(self):
        data = copy.deepcopy(self.baseline)
        data['bones'][1]['pos'][1] += .001
        with self.assertRaisesRegex(ValueError, 'bind pivots changed'):
            self.transfer(data)

    def test_preweighted_candidate_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'original pure-fin weights'):
            self.transfer(json.loads(self.rig1_bytes))

    def test_missing_or_duplicate_semantic_fin_is_rejected(self):
        data = copy.deepcopy(self.baseline)
        self.fin(data)['name'] += '-other'
        with self.assertRaisesRegex(ValueError, 'Missing semantic fin part'):
            self.transfer(data)
        data = copy.deepcopy(self.baseline)
        data['parts'].append(copy.deepcopy(self.fin(data)))
        with self.assertRaisesRegex(ValueError, 'Duplicate semantic part name'):
            self.transfer(data)

    def test_source_identity_and_reference_pins_are_mandatory(self):
        with self.assertRaisesRegex(ValueError, 'Candidate source SHA-256 mismatch'):
            transfer_native_bytes(self.baseline_bytes, '0' * 64, 'V57')
        with self.assertRaisesRegex(ValueError, 'candidate identity'):
            transfer_native_bytes(self.baseline_bytes, BASELINE_SHA256, 'V57 rig1')
        with self.assertRaisesRegex(ValueError, 'V57 baseline SHA-256 mismatch'):
            transfer_native_bytes(self.baseline_bytes, BASELINE_SHA256, 'V57', b'{}', self.rig1_bytes)
        with self.assertRaisesRegex(ValueError, 'V57 rig1 SHA-256 mismatch'):
            transfer_native_bytes(self.baseline_bytes, BASELINE_SHA256, 'V57', self.baseline_bytes, b'{}')

    def test_cli_requires_new_output_and_preserves_existing_bytes(self):
        scratch = ROOT.parents[2] / 'tmp'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='puffer-rig1-transfer-test-', dir=scratch) as directory:
            output = Path(directory) / 'proof'
            command = [sys.executable, str(ROOT / 'transfer_puffer_rig1_weights.py'),
                       '--source', str(ROOT / BASELINE_NAME), '--sha256', BASELINE_SHA256,
                       '--candidate', 'V57', '--output', str(output)]
            first = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual((output / 'native.json').read_bytes(), self.rig1_bytes)
            receipt_bytes = (output / 'equivalence.json').read_bytes()
            receipt = json.loads(receipt_bytes)
            self.assertEqual(receipt['nativeSha256'], RIG1_SHA256)
            self.assertEqual(receipt['transferScriptSha256'], sha256((ROOT / 'transfer_puffer_rig1_weights.py').read_bytes()))
            second = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('FileExistsError', second.stderr)
            self.assertEqual((output / 'native.json').read_bytes(), self.rig1_bytes)
            self.assertEqual((output / 'equivalence.json').read_bytes(), receipt_bytes)
            failed_output = Path(directory) / 'bad-source'
            command[-1] = str(failed_output)
            command[command.index('--sha256') + 1] = '0' * 64
            failed = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertNotEqual(failed.returncode, 0)
            self.assertFalse(failed_output.exists())


if __name__ == '__main__':
    unittest.main()
