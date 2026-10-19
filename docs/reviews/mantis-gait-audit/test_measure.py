"""Cross-check saved trajectories against captured joint-world matrices, independently of hierarchy reconstruction."""
import hashlib,json,unittest
from pathlib import Path
import numpy as np
ROOT=Path(__file__).parent
class Measurements(unittest.TestCase):
 def test_actual_material_points(self):
  trace_path=Path('tmp/mantis-precontact-capture-run2/render-trace.json');trace=json.loads(trace_path.read_text()); metrics=json.loads((ROOT/'metrics.json').read_text());rows=json.loads((ROOT/'trajectories.json').read_text());native=json.loads(Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json').read_text())
  self.assertEqual(hashlib.sha256(trace_path.read_bytes()).hexdigest(),metrics['traceSha256']);self.assertEqual(len(rows),1306)
  maximum=0
  for r,row in zip(trace,rows):
   self.assertEqual(r['frame'],row['frame'])
   for p in native['parts']:
    name=p['name']
    if name not in metrics['footSelections']:continue
    v=np.array(p['positions']).reshape(-1,3);ix=np.array(p['skinIndices']).reshape(-1,4);ww=np.array(p['skinWeights']).reshape(-1,4);deformed=np.zeros_like(v)
    for j in np.unique(ix):
     b=native['bones'][int(j)];world=np.array(r['boneTransforms'][b['name']]['world']).reshape(4,4).T
     h=np.column_stack((v-np.array(b['pos']),np.ones(len(v))));deformed+=(world@h.T).T[:,:3]*(ww*(ix==j)).sum(1)[:,None]
    actual=deformed[metrics['footSelections'][name]].mean(0);expect=row['feet'][name]['worldMaterialCentroid'];maximum=max(maximum,float(np.max(abs(actual-expect))))
    self.assertAlmostEqual(float(deformed[:,1].min()-r['floor']),row['feet'][name]['minimumClearance'],places=10)
  self.assertLess(maximum,1e-10);print('Maximum direct-world material centroid error:',maximum)
 def test_classification_and_pair_exclusions(self):
  rows=json.loads((ROOT/'trajectories.json').read_text());pairs=json.loads((ROOT/'pairs.json').read_text());byframe={r['frame']:r for r in rows}
  for p in pairs:
   a,b=[byframe[f] for f in p['frames']];self.assertEqual(a['bout'],b['bout']);self.assertEqual(a['category'],b['category']);self.assertEqual(a['hitEventCount'],b['hitEventCount']);self.assertGreater(p['dt'],0);self.assertLessEqual(p['dt'],.15)
  self.assertEqual(sum(r['category']=='locomotion' for r in rows),198)
if __name__=='__main__':unittest.main()
