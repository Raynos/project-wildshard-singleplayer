"""Focused source tests, no Blender, Wasm, app build or renderer."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
AUTHOR = ROOT / 'art/driftwood-isle/approved-puffer'
sys.path.insert(0, str(AUTHOR))
spec = importlib.util.spec_from_file_location('preview_measurement', AUTHOR / 'measure_native_preview.py')
measurement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(measurement)


class PreviewMeasurement(unittest.TestCase):
    def setUp(self):
        self.native = json.loads((AUTHOR / 'unaccepted-native-v23.json').read_text())

    def test_preserved_v23_dimensions(self):
        dims, _ = measurement.measure(self.native)
        self.assertEqual(dims, json.loads((AUTHOR / 'unaccepted-native-v23-preview-dimensions.json').read_text()))

    def test_weight_selection_survives_merged_renamed_parts(self):
        expected, _ = measurement.measure(self.native, weighted=True)
        merged = {'name': 'Merged arbitrary geometry'}
        for key in ('positions', 'colorsLinear', 'skinIndices', 'skinWeights', 'furLen'):
            merged[key] = [value for part in self.native['parts'] for value in part[key]]
        self.native['parts'] = [merged]
        actual, receipt = measurement.measure(self.native, weighted=True)
        self.assertEqual(actual, expected)
        self.assertEqual(receipt['restHullOutsideCapsule'], 0)
        self.assertFalse(receipt['colliderAcceptance'])

    def test_pivots_resolve_by_name_and_require_inherited_head(self):
        candidate = copy.deepcopy(self.native)
        for bone in candidate['bones']:
            if bone['name'] in ('body', 'belly'):
                bone['pos'][1] = .60
            elif bone['name'] == 'head':
                bone['pos'][1] = .83
            elif bone['name'] == 'tail':
                bone['pos'][1] = .58
        dims, _ = measurement.measure(candidate, weighted=True)
        self.assertEqual(dims['bodyY'], .60)
        next(bone for bone in candidate['bones'] if bone['name'] == 'head')['parent'] = 'body'
        with self.assertRaisesRegex(ValueError, 'head under belly'):
            measurement.measure(candidate, weighted=True)


if __name__ == '__main__':
    unittest.main()
