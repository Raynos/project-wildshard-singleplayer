"""Light preparation proof, not a renderer/build/appearance test."""
import hashlib
import json
import unittest
from pathlib import Path
import analyze_seam
HERE=Path(__file__).resolve().parent
class Preparation(unittest.TestCase):
    def test_frozen_inputs(self):
        for row in json.loads((HERE/'frozen-inputs.json').read_text())['files']:
            data=Path(row['path']).read_bytes()
            self.assertEqual(len(data),row['bytes'],row['path'])
            self.assertEqual(hashlib.sha256(data).hexdigest(),row['sha256'],row['path'])
    def test_source_seam_reconstruction(self):
        actual=analyze_seam.analyze()
        self.assertEqual(actual,json.loads((HERE/'seam-analysis.json').read_text()))
        self.assertEqual([r['guideSwitched'] for r in actual['frames']],[False,True,False])
        self.assertEqual([r['sidePolygon'] for r in actual['opposedTriangles']],[6,7,8])
        self.assertFalse(actual['repairSelected'])
    def test_native_isolation_mapping(self):
        source=json.loads((HERE.parent/'v4-skin1/colossus-v4-native.json').read_text())
        mapping=json.loads((HERE.parent/'v4-skin1/mesh-map.json').read_text())
        names=['body','head','arm-1','arm1','leg-1','leg1','foliage-body','foliage-head','foliage-arm-1','foliage-arm1','foliage-leg-1','foliage-leg1']
        self.assertEqual(names,[p['name'] for p in source['parts']])
        for row in mapping:
            part=source['parts'][names.index(row['joint'])]
            self.assertLessEqual(row['vertexStart']+row['vertexCount'],len(part['positions'])//3)
        row=next(r for r in mapping if r['node']==81)
        self.assertEqual(row['joint'],'foliage-leg-1')
        self.assertEqual(row['vertexCount'],96)
        self.assertEqual(sum(len(p['positions'])//3 for p in source['parts']),15600)
if __name__=='__main__':unittest.main()
