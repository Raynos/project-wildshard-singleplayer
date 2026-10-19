"""Source-only exact V7 tests, including independent binary decoding/winding."""
import copy
import json
import math
from pathlib import Path
import struct
import unittest
import zlib
import export_native as bridge


class MantisNative(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.mapping = bridge.export_native(bridge.SOURCE.read_bytes(), bridge.GLB.read_bytes())
        cls.dims = bridge.diagnostic_dimensions(cls.data, cls.mapping)

    def test_pinned_inputs_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'source hash'):
            bridge.export_native(bridge.SOURCE.read_bytes()+b'\n', bridge.GLB.read_bytes())
        with self.assertRaisesRegex(ValueError, 'GLB hash'):
            bridge.export_native(bridge.SOURCE.read_bytes(), bridge.GLB.read_bytes()+b'\0')

    def test_exact_rigid_partition(self):
        self.assertEqual(bridge.validate_native(self.data), {'vertices': 7986, 'triangles': 2662, 'bones': 22, 'parts': 22})
        self.assertEqual(len(self.mapping), 75)
        self.assertEqual(sum(len(row['primitives']) for row in self.mapping), 213)
        for joint in bridge.NAMES:
            selected = [row for row in self.mapping if row['joint'] == joint]
            count = 0
            for row in selected:
                self.assertEqual(row['vertexStart'], count)
                count += row['vertexCount']
            part = next(p for p in self.data['parts'] if p['name'] == joint)
            self.assertEqual(count, len(part['positions'])//3)

    def test_axes_and_bind_are_rest_preserving(self):
        bones = {b['name']: b for b in self.data['bones']}
        self.assertGreater(bones['head']['pos'][2], 0)
        self.assertLess(bones['leg1_1']['pos'][2], 0)
        self.assertLess(bones['leg1_0']['pos'][2], 0)
        worlds = {}
        for bone in self.data['bones']:
            parent = bone['parent']
            local = bone['pos'] if parent is None else [a-b for a, b in zip(bone['pos'], bones[parent]['pos'])]
            worlds[bone['name']] = local if parent is None else [a+b for a, b in zip(local, worlds[parent])]
            for a, b in zip(worlds[bone['name']], bone['pos']):
                self.assertAlmostEqual(a, b, places=12)
        for part in self.data['parts']:
            bind = worlds[part['name']]
            for i in range(0, len(part['positions']), 3):
                vertex = part['positions'][i:i+3]
                for value, pivot in zip(vertex, bind):
                    self.assertAlmostEqual((value-pivot)+pivot, value, places=12)

    def test_dimensions_are_conservative_not_old_tuning(self):
        self.assertAlmostEqual(self.dims['bodyY'], 1.4, places=6)
        self.assertEqual(len(self.dims['feet']), 4)
        for part in self.data['parts']:
            for i in range(0, len(part['positions']), 3):
                x, y, z = part['positions'][i:i+3]
                axial = max(0, abs(z)-self.dims['bodyHalfLen'])
                self.assertLessEqual(math.sqrt(x*x+(y-self.dims['bodyY'])**2+axial**2), self.dims['bodyRadius']+1e-10)

    def test_malformed_rig_weights_and_attributes_refused(self):
        for mutation in [lambda d: d['bones'][2].update(parent='body'),
                         lambda d: d['parts'][0]['skinWeights'].__setitem__(0, .5),
                         lambda d: d['parts'][0]['positions'].__setitem__(0, float('nan')),
                         lambda d: d['parts'][0]['skinIndices'].__setitem__(0, 1)]:
            malformed = copy.deepcopy(self.data)
            mutation(malformed)
            with self.assertRaises(ValueError):
                bridge.validate_native(malformed)

    def test_existing_codec_roundtrip_every_attribute(self):
        metadata, packed = bridge.pack_native(self.data, self.dims)
        body = metadata['bodies'][0]
        self.assertEqual((body['kind'], body['variant']), ('splinter-mantis', 'splinter-mantis'))
        self.assertIn(bridge.sha(packed), metadata['file'])
        raw = zlib.decompress(packed)
        self.assertEqual(len(raw), metadata['bytes'])
        self.assertEqual(body['bones'], self.data['bones'])
        for native, hard in zip(self.data['parts'], body['hard']):
            for attr, offset in zip(bridge.codec.ATTRS, hard['offsets']):
                _, kind, _, key = attr
                values = native[key]
                fmt = '<'+('H' if kind == 'u16' else 'f')*len(values)
                actual = struct.unpack_from(fmt, raw, offset)
                expected = struct.unpack(fmt, struct.pack(fmt, *values))
                self.assertEqual(actual, expected)
        self.assertLess(len(packed), 1_000_000)

    def test_transform_features_refused(self):
        doc, _ = bridge.parse_glb(bridge.GLB.read_bytes())
        doc['nodes'][0]['rotation'] = [0, 0, 0, 1]
        with self.assertRaisesRegex(ValueError, 'translation'):
            bridge.scene_nodes(doc)

    def test_source_normal_audit_retains_facet_caveats(self):
        from audit_source_normals import audit
        report = audit()
        self.assertEqual(bridge.encoded(report), (bridge.HERE/'source-normal-caveats.json').read_bytes())
        self.assertEqual(len(report['opposedTriangles']), 0)
        self.assertEqual(len(report['facetNormalDeviations']), 437)
        self.assertEqual(report['triangleCount'], 2662)
        self.assertAlmostEqual(report['minimumNormalCosine'], .4094854530691898)

    def test_pivot_provenance_matches_exact_rig(self):
        report = json.loads((bridge.HERE/'rig-provenance.json').read_text())
        self.assertFalse(report['glbContainsPivots'])
        self.assertEqual([{k: row[k] for k in ('name', 'parent', 'pos')} for row in report['bones']], self.data['bones'])
        for row in report['bones']:
            self.assertEqual(bridge.game_point(row['blenderPivot']), row['pos'])
        self.assertEqual([r['name'] for r in report['bones'] if r['pivotOrigin'] == 'derived attachment station'], ['neck', 'abdomen'])

    def test_frozen_outputs_are_reproducible(self):
        frozen = bridge.HERE/'v7-rigid1'
        self.assertEqual(bridge.encoded(self.data), (frozen/'mantis-v7-native.json').read_bytes())
        self.assertEqual(bridge.encoded(self.mapping), (frozen/'mesh-map.json').read_bytes())
        self.assertEqual(bridge.encoded(self.dims), (frozen/'diagnostic-dimensions.json').read_bytes())
        meta, packed = bridge.pack_native(self.data, self.dims)
        self.assertEqual(bridge.encoded(meta), (frozen/'metadata.json').read_bytes())
        self.assertEqual(packed, (frozen/'payload.bin').read_bytes())
        receipt = json.loads((frozen/'closure.json').read_text())
        self.assertEqual(receipt['exporterSha256'], bridge.sha(Path(bridge.__file__).read_bytes()))
        self.assertEqual(receipt['codecSha256'], bridge.sha(bridge.CODEC_PATH.read_bytes()))
        for name, row in receipt['files'].items():
            raw = (frozen/name).read_bytes()
            self.assertEqual(row, {'sha256': bridge.sha(raw), 'bytes': len(raw)})


if __name__ == '__main__':
    unittest.main()
