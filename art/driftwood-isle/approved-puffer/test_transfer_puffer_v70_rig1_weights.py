"""V70 exact-profile proofs without Blender, browser, app build or publication."""
from collections import Counter
import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import transfer_puffer_v70_rig1_weights as profile
from transfer_puffer_rig1_weights import encode, sha256, transfer_native_bytes


ROOT = Path(__file__).resolve().parent


class V70Rig1Transfer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source_bytes = (ROOT / 'unaccepted-native-v70.json').read_bytes()
        cls.source = json.loads(cls.source_bytes)
        cls.native_bytes, cls.receipt = profile.transfer_v70_native_bytes(cls.source_bytes)
        cls.native = json.loads(cls.native_bytes)

    def test_frozen_source_and_output_are_exact_and_reproducible(self):
        self.assertEqual(sha256(self.source_bytes), profile.SOURCE_SHA256)
        self.assertEqual(self.native_bytes, (ROOT / 'unaccepted-v70-motion-rig1-native.json').read_bytes())
        self.assertEqual(sha256(self.native_bytes), 'b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762')
        self.assertEqual(profile.transfer_v70_native_bytes(self.source_bytes), (self.native_bytes, self.receipt))
        self.assertEqual(self.receipt['candidate'], 'V70')
        self.assertFalse(self.receipt['gaitAcceptance'])

    def test_v57_strict_path_still_rejects_v70(self):
        with self.assertRaisesRegex(ValueError, 'bind pivots changed'):
            transfer_native_bytes(self.source_bytes, profile.SOURCE_SHA256, 'V70')

    def test_entire_rest_payload_and_non_fin_weights_are_preserved(self):
        self.assertEqual(self.native['bones'], self.source['bones'])
        for before, after in zip(self.source['parts'], self.native['parts']):
            for key in ('name', 'positions', 'colorsLinear', 'furLen'):
                self.assertEqual(before[key], after[key])
            if not before['name'].startswith('Volumetric connected '):
                self.assertEqual(before, after)
        self.assertTrue(self.receipt['restPayloadUnchanged'])

    def test_explicit_game_axis_transform_matches_all_protected_cap_coordinates(self):
        baseline = json.loads((ROOT / profile.BASELINE_NAME).read_bytes())
        reference, records = profile._transformed_reference(baseline)
        self.assertEqual(reference['bones'], self.source['bones'])
        self.assertEqual([row['changedCoordinates'] for row in records], [3, 3, 12, 12])
        for original, expected in zip(baseline['bones'], reference['bones']):
            if original['name'] != 'tail':
                self.assertEqual(original, expected)
            else:
                self.assertEqual(expected['pos'][2], -0.5174999833106995)
                self.assertEqual(original['pos'][:2], expected['pos'][:2])
        source_parts = profile._parts_by_name(self.source)
        for part in reference['parts']:
            if not part['name'].startswith('Volumetric connected '):
                continue
            expected = Counter(point for point in profile._points(part) if point[1] > .14)
            actual = Counter(point for point in profile._points(source_parts[part['name']]) if point[1] > .14)
            self.assertEqual(actual, expected)

    def test_calibration_changes_only_leg_length_and_keeps_measurements_honest(self):
        outputs = profile.preview_measurements(self.native_bytes)
        names = {'measured-dimensions.json': 'v70-rig1-measured-dimensions.json',
                 'measured-receipt.json': 'v70-rig1-measurements.json',
                 'gait5-dimensions.json': 'v70-gait5-dimensions.json',
                 'gait5-measurements.json': 'v70-gait5-measurements.json'}
        for filename, artifact in names.items():
            self.assertEqual(outputs[filename], (ROOT / artifact).read_bytes())
        measured = json.loads(outputs['measured-dimensions.json'])
        calibrated = json.loads(outputs['gait5-dimensions.json'])
        receipt = json.loads(outputs['gait5-measurements.json'])
        self.assertEqual({**calibrated, 'legLen': measured['legLen']}, measured)
        self.assertEqual(calibrated['legLen'], profile.PHASE_LEG_LEN)
        self.assertEqual(receipt['dimensions'], calibrated)
        self.assertEqual(receipt['measuredDimensions'], measured)
        self.assertEqual(receipt['dimensionsSha256'], sha256(outputs['gait5-dimensions.json']))

    def test_wrong_source_bytes_cannot_borrow_the_v70_profile(self):
        with self.assertRaisesRegex(ValueError, 'V70 source SHA-256 mismatch'):
            profile.transfer_v70_native_bytes(self.source_bytes + b'\n')
        with self.assertRaisesRegex(ValueError, 'V70 source SHA-256 mismatch'):
            profile.transfer_v70_native_bytes((ROOT / profile.BASELINE_NAME).read_bytes())

    def test_structural_checks_independently_reject_changed_pivots_and_caps(self):
        # Test only: substitute the outer checksum so structural rejection is
        # exercised independently. Production contains one immutable V70 pin.
        for mutation, error in [('pivot', 'expected bone'), ('coordinate', 'protected coordinate'),
                                ('winding', 'oriented triangle')]:
            data = copy.deepcopy(self.source)
            part = next(row for row in data['parts'] if row['name'] == 'Volumetric connected rearL')
            if mutation == 'pivot':
                data['bones'][0]['pos'][0] += .01
            elif mutation == 'coordinate':
                i = next(i for i in range(len(part['positions']) // 3) if part['positions'][3 * i + 1] > .4)
                part['positions'][3 * i] += .001
            else:
                part['positions'][:6] = part['positions'][3:6] + part['positions'][:3]
            raw = encode(data)
            with patch.object(profile, 'SOURCE_SHA256', sha256(raw)):
                with self.assertRaisesRegex(ValueError, error):
                    profile.transfer_v70_native_bytes(raw)


if __name__ == '__main__':
    unittest.main()
