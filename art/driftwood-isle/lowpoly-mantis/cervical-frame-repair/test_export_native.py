"""Focused candidate proofs; production/V7 files remain read-only."""
import copy
import json
import struct
import unittest
import zlib
import export_native as bridge

class CandidateNative(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data,cls.mapping,cls.audit=bridge.export_native()
        cls.dims=bridge.readers.diagnostic_dimensions(cls.data,cls.mapping)

    def test_all_geometry_and_authored_mapping(self):
        self.assertEqual(bridge.validate_native(self.data),dict(vertices=9156,triangles=3052,bones=22,parts=22))
        self.assertEqual(len(self.mapping),89)
        self.assertEqual(sum(len(p['primitives']) for p in self.mapping),255)
        self.assertEqual(sum(p['newlyMapped'] for p in bridge.AUTHORED['parts']),7)
        self.assertEqual(sum(b['staticLabel'] is not None for b in bridge.AUTHORED['bones']),20)
        for part in self.data['parts']:
            rows=[r for r in self.mapping if r['joint']==part['name']]
            cursor=0
            for row in rows:
                self.assertEqual(cursor,row['vertexStart']);cursor+=row['vertexCount']
            self.assertEqual(cursor,len(part['positions'])//3)

    def test_complete_packed_roundtrip_all_six_channels(self):
        meta,payload=bridge.pack_native(self.data,self.dims)
        raw=zlib.decompress(payload)
        self.assertEqual(len(raw),meta['bytes'])
        self.assertIn(bridge.sha(payload),meta['file'])
        self.assertEqual(meta['bodies'][0]['bones'],self.data['bones'])
        for part,row in zip(self.data['parts'],meta['bodies'][0]['hard']):
            for (_,kind,_,key),offset in zip(bridge.ATTRS,row['offsets']):
                values=part[key];fmt='<'+('H' if kind=='u16' else 'f')*len(values)
                self.assertEqual(struct.unpack_from(fmt,raw,offset),struct.unpack(fmt,struct.pack(fmt,*values)))

    def test_rest_transform_preservation_every_vertex(self):
        worlds={}
        for bone in self.data['bones']:
            parent=bone['parent'];p=[0,0,0] if parent is None else worlds[parent]
            local=[a-b for a,b in zip(bone['pos'],p)]
            worlds[bone['name']]=[a+b for a,b in zip(local,p)]
            for a,b in zip(worlds[bone['name']],bone['pos']):self.assertAlmostEqual(a,b,places=12)
        for part in self.data['parts']:
            for i,value in enumerate(part['positions']):
                pivot=worlds[part['name']][i%3]
                self.assertAlmostEqual((value-pivot)+pivot,value,places=12)

    def test_fail_closed_for_wrong_rig_weights_normals(self):
        mutations=[lambda d:d['bones'][2].update(parent='body'),lambda d:d['parts'][0]['skinWeights'].__setitem__(0,.5),lambda d:d['parts'][0]['skinIndices'].__setitem__(0,1),lambda d:d['parts'][0]['normals'].__setitem__(0,float('nan')),lambda d:d['parts'][0]['positions'].pop()]
        for mutate in mutations:
            data=copy.deepcopy(self.data);mutate(data)
            with self.assertRaises(ValueError):bridge.validate_native(data)

    def test_no_transform_schema_exemption(self):
        doc,_=bridge.parse_glb(bridge.GLB.read_bytes())
        doc['nodes'][0]['rotation']=[0,0,0,1]
        with self.assertRaises(ValueError):bridge.scene_nodes(doc)
        with self.assertRaisesRegex(ValueError,'V7 source hash mismatch'):
            bridge.readers.export_native(bridge.SOURCE.read_bytes(),bridge.GLB.read_bytes())

    def test_repaired_source_normals_pass_unchanged_strict_gate(self):
        self.assertEqual(len(self.audit['facetNormalDeviations']),595)
        self.assertEqual(self.audit['opposedTriangles'],[])
        self.assertGreater(self.audit['minimumNormalCosine'],0)
        import admit_native
        result=admit_native.admit()
        self.assertEqual(result['status'],'STRUCTURAL_ONLY')
        self.assertEqual(result['cleanNormalOrientation'],'PASS')
        self.assertFalse(result['visualAcceptance'])

    def test_frozen_outputs_reproduce(self):
        meta,packed=bridge.pack_native(self.data,self.dims)
        expected={'mantis-native.json':bridge.encoded(self.data),'mesh-map.json':bridge.encoded(self.mapping),'normal-audit.json':bridge.encoded(self.audit),'diagnostic-dimensions.json':bridge.encoded(self.dims),'metadata.json':bridge.encoded(meta),'payload.bin':packed}
        closure=bridge.read_json(bridge.HERE/'closure.json')
        self.assertEqual(closure['exporterSha256'],bridge.sha(bridge.Path(bridge.__file__).read_bytes()))
        for name,raw in expected.items():
            self.assertEqual((bridge.HERE/name).read_bytes(),raw)
            self.assertEqual(closure['files'][name],dict(bytes=len(raw),sha256=bridge.sha(raw)))
        for key in ['visualAcceptance','animationAcceptance','worldContactAcceptance','runtimeAcceptance','promotion']:
            self.assertFalse(closure[key])

if __name__=='__main__':unittest.main()
