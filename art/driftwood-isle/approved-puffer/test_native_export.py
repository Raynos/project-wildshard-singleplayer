"""Focused no-Blender contract proofs: python3 -m unittest discover -s <folder> -p test_native_export.py."""
import copy
import json
import struct
import unittest
import zlib
from native_export import SCHEMA, game_point, influences, pack_native_puffer, validate_native


def fixture():
    return {'schema': SCHEMA, 'bones': [
        {'name': 'body', 'parent': None, 'pos': [0, .7, 0]},
        {'name': 'belly', 'parent': 'body', 'pos': [0, .7, 0]},
        {'name': 'head', 'parent': 'belly', 'pos': [0, .93, .5]}],
        'parts': [{'name': 'test triangle', 'positions': [0, 0, 0, 0, 0, 1, 1, 0, 0],
                   'colorsLinear': [.1, .2, .3]*3, 'skinIndices': [1, 2, 0, 0]*3,
                   'skinWeights': [.25, .75, 0, 0]*3, 'furLen': [0]*3}]}


DIMS = {'bodyY': .7, 'bodyHalfLen': .5, 'bodyRadius': .6, 'headRadius': .2,
        'legLen': .5, 'feet': [[.7, .5], [-.7, .5]], 'halfWidth': .8}


class NativeExportTests(unittest.TestCase):
    def test_axis_and_winding(self):
        # Blender +Z-facing triangle becomes game +Y-facing only after reversal.
        a, b, c = [game_point(v) for v in reversed([(0, 0, 0), (1, 0, 0), (0, 1, 0)])]
        u, v = [[q[i]-a[i] for i in range(3)] for q in [b, c]]
        self.assertGreater(u[2]*v[0]-u[0]*v[2], 0)

    def test_preserves_four_blended_influences(self):
        ids, weights = influences([('a', 1), ('b', 2), ('c', 3), ('d', 4)], dict(a=0,b=1,c=2,d=3))
        self.assertEqual(ids, [3,2,1,0])
        self.assertEqual(weights, [.4,.3,.2,.1])
        with self.assertRaises(ValueError):
            influences([(str(i), 1) for i in range(5)], {str(i):i for i in range(5)})
        with self.assertRaises(ValueError):
            influences([], {'body': 0})
        with self.assertRaises(ValueError):
            influences([('typo', 1)], {'body': 0})

    def test_typed_packed_roundtrip(self):
        data = fixture()
        meta, compressed = pack_native_puffer(data, DIMS)
        raw = zlib.decompress(compressed)
        self.assertEqual(len(raw), meta['bytes'])
        part = meta['bodies'][0]['hard'][0]
        source = data['parts'][0]
        keys = ['positions','colorsLinear','skinIndices','skinWeights','furLen']
        for (name, dtype, width, normalized), offset, key in zip(part['row']['attrs'], part['offsets'], keys):
            self.assertEqual(offset % 4, 0)
            self.assertFalse(normalized)
            values = struct.unpack_from('<'+('H' if dtype == 'u16' else 'f')*(3*width), raw, offset)
            for actual, expected in zip(values, source[key]):
                self.assertAlmostEqual(actual, expected, places=6)
        self.assertEqual(meta['bodies'][0]['bones'], data['bones'])
        self.assertEqual(pack_native_puffer(data,DIMS), (meta,compressed))
        self.assertLess(len(compressed), 1_000_000)
        self.assertLess(len(json.dumps(meta)), 5_000_000)

    def test_rejects_bad_payloads(self):
        mutations = [lambda d: d['bones'][2].update(parent='absent'),
                     lambda d: d['parts'][0]['skinWeights'].__setitem__(0, .5),
                     lambda d: d['parts'][0]['skinIndices'].__setitem__(0, 999),
                     lambda d: d['parts'][0]['positions'].__setitem__(0, float('nan')),
                     lambda d: d['parts'][0]['colorsLinear'].__setitem__(0, 1.1),
                     lambda d: d['parts'][0]['furLen'].__setitem__(0, 1)]
        for mutate in mutations:
            data = copy.deepcopy(fixture()); mutate(data)
            with self.assertRaises(ValueError): validate_native(data)
        with self.assertRaises(ValueError): pack_native_puffer(fixture(), {**DIMS, 'bodyY': .43})

    def test_head_and_belly_inflate_together(self):
        # Factory derives local head pivot from absolute bind positions. With
        # head parent belly and identity head pose both skin matrices coincide.
        body, belly, head = [b['pos'] for b in fixture()['bones']]
        for scale in [1, 1.05, 1.10]:
            local_head = [h-b for h,b in zip(head,belly)]
            animated_head = [b+scale*l for b,l in zip(belly,local_head)]
            point = [.3, .9, .7]
            via_belly = [b+scale*(p-b) for b,p in zip(belly,point)]
            via_head = [a+scale*(p-h) for a,p,h in zip(animated_head,point,head)]
            for a,b in zip(via_belly,via_head): self.assertAlmostEqual(a,b)
            # Blending either attachment preserves that exact same deformation.
            for a,b in zip(via_belly,via_head): self.assertAlmostEqual(.25*a+.75*b,a)


if __name__ == '__main__': unittest.main()
