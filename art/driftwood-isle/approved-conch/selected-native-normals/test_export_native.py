"""Reproduction, preservation and negative controls; no source rebuild or rendering."""
import copy
import importlib.util
import json
from pathlib import Path
import struct
import unittest
import zlib

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('selected_normals_exporter', HERE/'export_native.py')
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)

class Contract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.mapping = e.export_native(e.SOURCE.read_bytes(), e.GLB.read_bytes())
        cls.dims = e.diagnostic_dimensions(cls.data, cls.mapping)
        cls.meta, cls.packed = e.pack_native(cls.data, cls.dims)

    def test_original_channels_bones_and_material_regions_exact(self):
        original = json.loads((e.SOURCE_DIR/'native/conch-character-pass-native.json').read_bytes())
        self.assertEqual(self.data['bones'], original['bones'])
        for new, old in zip(self.data['parts'], original['parts']):
            self.assertEqual({k:v for k,v in new.items() if k != 'normals'}, old)
        old_map = json.loads((e.SOURCE_DIR/'native/mesh-map.json').read_bytes())
        stripped = copy.deepcopy(self.mapping)
        for mesh in stripped:
            for primitive in mesh['primitives']: primitive.pop('doubleSided')
        self.assertEqual(stripped, old_map)
        self.assertEqual(len(self.mapping), 51)
        self.assertEqual(sum(len(m['primitives']) for m in self.mapping), 95)

    def test_reproduction(self):
        self.assertEqual(e.encoded(self.data), (HERE/'native/conch-character-pass-native.json').read_bytes())
        self.assertEqual(e.encoded(self.meta), (HERE/'native/metadata.json').read_bytes())
        self.assertEqual(self.packed, (HERE/'native/payload.bin').read_bytes())

    def test_all_packed_channels_independent_struct_decode(self):
        raw = zlib.decompress(self.packed)
        self.assertEqual(len(raw), self.meta['bytes'])
        for part, descriptor in zip(self.data['parts'], self.meta['bodies'][0]['hard']):
            for offset, (name, kind, width, key) in zip(descriptor['offsets'], e.ATTRS):
                values = part[key]
                fmt = '<'+('H' if kind == 'u16' else 'f')*len(values)
                decoded = struct.unpack_from(fmt, raw, offset)
                self.assertEqual(decoded, struct.unpack(fmt, struct.pack(fmt, *values)), name)
                self.assertEqual(len(values), descriptor['row']['count']*width)

    def test_bad_source_pin_refused(self):
        with self.assertRaisesRegex(ValueError, 'source hash mismatch'):
            e.export_native(e.SOURCE.read_bytes()+b' ', e.GLB.read_bytes())

    def test_bad_glb_pin_refused(self):
        with self.assertRaisesRegex(ValueError, 'GLB hash mismatch'):
            e.export_native(e.SOURCE.read_bytes(), e.GLB.read_bytes()+b' ')

    def test_missing_normals_refused(self):
        data = copy.deepcopy(self.data); data['parts'][0]['normals'].pop()
        with self.assertRaisesRegex(ValueError, 'Invalid normals'): e.validate_native(data)

    def test_nonfinite_normal_refused(self):
        data = copy.deepcopy(self.data); data['parts'][0]['normals'][0] = float('nan')
        with self.assertRaisesRegex(ValueError, 'Invalid normals'): e.validate_native(data)

    def test_nonunit_normal_refused(self):
        data = copy.deepcopy(self.data); data['parts'][0]['normals'][0:3] = [0,0,0]
        with self.assertRaisesRegex(ValueError, 'Non-unit normal'): e.validate_native(data)

    def test_pivot_change_refused(self):
        data = copy.deepcopy(self.data); data['bones'][0]['pos'][0] += .01
        with self.assertRaisesRegex(ValueError, 'rig required'): e.validate_native(data)

    def test_wrong_rigid_weights_refused(self):
        data = copy.deepcopy(self.data); data['parts'][0]['skinIndices'][0] = 1
        with self.assertRaisesRegex(ValueError, 'Rigid part index mismatch'): e.validate_native(data)

if __name__ == '__main__': unittest.main(verbosity=2)
