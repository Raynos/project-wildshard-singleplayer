"""Exact rest geometry and derived ownership tests; no Blender or runtime writes."""
import copy
import json
import math
from pathlib import Path
import struct
import unittest
import zlib
import export_native as bridge


class ColossusNative(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.mapping = bridge.export_native(bridge.SOURCE.read_bytes(), bridge.GLB.read_bytes())
        cls.dims = bridge.diagnostic_dimensions(cls.data, cls.mapping)

    def test_pinned_inputs_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'source hash'):
            bridge.export_native(bridge.SOURCE.read_bytes()+b'\n', bridge.GLB.read_bytes())
        with self.assertRaisesRegex(ValueError, 'GLB hash'):
            bridge.export_native(bridge.SOURCE.read_bytes(), bridge.GLB.read_bytes()+b'\0')

    def test_exact_partition(self):
        self.assertEqual(bridge.validate_native(self.data), dict(vertices=15600, triangles=5200, bones=22, parts=12))
        self.assertEqual(len(self.mapping), 227)
        self.assertEqual(sum(len(row['primitives']) for row in self.mapping), 730)
        self.assertEqual(len({r['name'] for r in self.mapping}), 227)
        for part in self.data['parts']:
            count = 0
            for row in (r for r in self.mapping if r['joint'] == part['name']):
                self.assertEqual(row['vertexStart'], count)
                count += row['vertexCount']
                self.assertEqual(row['sourceWorldTranslation'], [0, 0, 0])
                self.assertIsNone(row['authoredJoint'])
            self.assertEqual(count, len(part['positions'])//3)

    def test_weight_ownership_exactly_matches_contract(self):
        used = set()
        for row in self.mapping:
            part = next(p for p in self.data['parts'] if p['name'] == row['joint'])
            self.assertEqual(bridge.ownership(row['name']), (row['joint'], row['weightRegion']))
            for i in range(row['vertexStart'], row['vertexStart']+row['vertexCount']):
                ids, weights = bridge.weights(row['name'], row['weightRegion'], part['positions'][i*3:i*3+3])
                self.assertEqual(part['skinIndices'][i*4:i*4+4], ids)
                self.assertEqual(part['skinWeights'][i*4:i*4+4], weights)
                used.update(j for j,w in zip(ids,weights) if w)
        self.assertEqual(used, set(range(22)))
        with self.assertRaisesRegex(ValueError, 'Unmapped'):
            bridge.ownership('Unknown new root')

    def test_coincident_limb_and_foliage_vertices_share_fields(self):
        # Same spatial deformation field for every interwoven root, seam and
        # leaf in the named arm/leg region; no free-floating foliage bone.
        for side in (-1, 1):
            for y in [0, .35, .58, .8, 1.1, 1.3, 1.5, 1.65, 1.95, 2.45, 2.7, 3.1, 3.7, 4.2, 5]:
                p = [side*1.8, y, .3]
                for names in [(f'Arm descending trunk {side}', f'Elbow growth {side} layered blade 0'),
                              (f'Calf crossing root {side}', f'Shin growth {side} living seam')]:
                    results = [bridge.weights(n, bridge.ownership(n)[1], p) for n in names]
                    self.assertEqual(results[0], results[1])

    def test_weight_fields_are_continuous_at_every_joint_and_digit_boundary(self):
        def vector(name, y):
            ids, ws = bridge.weights(name, bridge.ownership(name)[1], [1.8, y, .2])
            out = [0.]*22
            for i,w in zip(ids,ws): out[i] += w
            return out
        names = ['Arm descending trunk 1', 'Forearm main to outer claw 1', 'Middle root digit 1',
                 'Inner root digit 1', 'Opposed root thumb 1', 'Calf crossing root 1', 'Neck rear root']
        for name in names:
            for y in [.35,.8,.95,1.1,1.16,1.21,1.22,1.25,1.5,1.52,1.54,1.65,1.74,1.95,2.45,2.7,3.1,3.7,3.73,4.15,4.2]:
                self.assertLess(max(abs(a-b) for a,b in zip(vector(name,y-1e-8),vector(name,y+1e-8))), 1e-6, (name,y))

    def test_axes_and_bind_are_rest_preserving(self):
        bones = {b['name']: b for b in self.data['bones']}
        self.assertGreater(bones['hand1']['pos'][2], 0)
        self.assertLess(bones['body']['pos'][2], 0)
        worlds = {}
        for bone in self.data['bones']:
            parent = bone['parent']
            local = bone['pos'] if parent is None else [a-b for a,b in zip(bone['pos'],bones[parent]['pos'])]
            worlds[bone['name']] = local if parent is None else [a+b for a,b in zip(local,worlds[parent])]
            for a,b in zip(worlds[bone['name']],bone['pos']): self.assertAlmostEqual(a,b,places=12)

    def test_dimensions_are_conservative_and_diagnostic(self):
        self.assertEqual(self.dims['bodyY'], 2.28)
        self.assertEqual(len(self.dims['feet']), 2)
        for part in self.data['parts']:
            for i in range(0, len(part['positions']), 3):
                x,y,z = part['positions'][i:i+3]
                axial = max(0, abs(z)-self.dims['bodyHalfLen'])
                self.assertLessEqual(math.sqrt(x*x+(y-self.dims['bodyY'])**2+axial**2), self.dims['bodyRadius']+1e-10)

    def test_malformed_rig_weights_and_attributes_refused(self):
        for mutate in [lambda d:d['bones'][2].update(parent='head'),
                       lambda d:d['parts'][0]['skinWeights'].__setitem__(0,.5),
                       lambda d:d['parts'][0]['positions'].__setitem__(0,float('nan')),
                       lambda d:d['parts'][0]['skinIndices'].__setitem__(0,500)]:
            data = copy.deepcopy(self.data); mutate(data)
            with self.assertRaises(ValueError): bridge.validate_native(data)

    def test_existing_codec_roundtrip_every_attribute(self):
        metadata, packed = bridge.pack_native(self.data,self.dims)
        body = metadata['bodies'][0]
        self.assertEqual((body['kind'],body['variant']),('tideRootColossus','tide-root-colossus'))
        self.assertIn(bridge.sha(packed),metadata['file'])
        raw = zlib.decompress(packed)
        self.assertEqual(len(raw),metadata['bytes'])
        for native,hard in zip(self.data['parts'],body['hard']):
            for attr,offset in zip(bridge.codec.ATTRS,hard['offsets']):
                _,kind,_,key = attr
                values = native[key]; fmt = '<'+('H' if kind=='u16' else 'f')*len(values)
                self.assertEqual(struct.unpack_from(fmt,raw,offset),struct.unpack(fmt,struct.pack(fmt,*values)))
        self.assertLess(len(packed),1_000_000)

    def test_unsupported_transforms_refused(self):
        doc,_ = bridge.parse_glb(bridge.GLB.read_bytes())
        doc['nodes'][0]['rotation'] = [0,0,0,1]
        with self.assertRaisesRegex(ValueError,'translation'): bridge.scene_nodes(doc)

    def test_source_normal_audit_preserves_exact_caveats(self):
        from audit_source_normals import audit
        report = audit()
        self.assertEqual(bridge.encoded(report),bridge.encoded(json.loads((bridge.HERE/'source-normal-caveats.json').read_text())))
        self.assertEqual(len(report['opposedTriangles']),3)
        self.assertEqual({r['name'] for r in report['opposedTriangles']},{'Shin growth -1 living seam'})
        self.assertEqual(len(report['facetNormalDeviations']),1733)
        self.assertEqual(report['triangleCount'],5200)
        self.assertAlmostEqual(report['minimumNormalCosine'],-.18608508391712192)
        self.assertTrue(all(r['sharedEdgeSameNormalTriangles'] for r in report['opposedTriangles']))

    def test_derived_pivots_and_material_limits_are_explicit(self):
        report = bridge.rig_provenance()
        self.assertFalse(report['authoredRigMetadata'])
        self.assertFalse(report['glbContainsSkin'])
        self.assertEqual([{k:r[k] for k in ('name','parent','pos')} for r in report['bones']],self.data['bones'])
        for row in report['bones']: self.assertEqual(bridge.game_point(row['blenderPivot']),row['pos'])
        doc,_ = bridge.parse_glb(bridge.GLB.read_bytes())
        self.assertTrue(all(m['doubleSided'] for m in doc['materials']))
        self.assertEqual([m['name'] for m in doc['materials'] if m.get('emissiveFactor')],['heartLight','heart','eye'])

    def test_frozen_outputs_are_reproducible(self):
        frozen = bridge.HERE/'v4-skin1'
        meta,packed = bridge.pack_native(self.data,self.dims)
        doc,_ = bridge.parse_glb(bridge.GLB.read_bytes())
        expected = {'colossus-v4-native.json':bridge.encoded(self.data),'mesh-map.json':bridge.encoded(self.mapping),
                    'diagnostic-dimensions.json':bridge.encoded(self.dims),'metadata.json':bridge.encoded(meta),
                    'payload.bin':packed,'rig-provenance.json':bridge.encoded(bridge.rig_provenance()),
                    'source-materials.json':bridge.encoded(doc['materials'])}
        for name,raw in expected.items(): self.assertEqual(raw,(frozen/name).read_bytes())
        receipt = json.loads((frozen/'closure.json').read_text())
        self.assertEqual(receipt['exporterSha256'],bridge.sha(Path(bridge.__file__).read_bytes()))
        self.assertEqual(receipt['codecSha256'],bridge.sha(bridge.CODEC_PATH.read_bytes()))
        for name,row in receipt['files'].items():
            raw = (frozen/name).read_bytes()
            self.assertEqual(row,dict(sha256=bridge.sha(raw),bytes=len(raw)))
        for key in ('geometryAcceptance','animationAcceptance','colliderAcceptance','runtimeAcceptance','phonePerformanceAcceptance'):
            self.assertIs(receipt[key],False)


if __name__ == '__main__': unittest.main()
