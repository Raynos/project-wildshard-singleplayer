"""Read-only frozen failed triangulation diagnostic; no export or render."""
import hashlib,json
from pathlib import Path
p=Path(__file__).with_name('build_guided_surface_collar.py')
if hashlib.sha256(p.read_bytes()).hexdigest()!='a715a2a7307157f785eccc26897357735ae0b26095728d053372b7142b4d97df':raise RuntimeError('Frozen source changed')
ns={'__file__':str(p.resolve()),'__name__':'__main__'}
try:exec(compile(p.read_text(),str(p),'exec'),ns)
except RuntimeError as error:failure=str(error)
else:raise RuntimeError('Expected failed guard did not recur')
actual={e for e,n in ns['new_edges'].items()if n==1};expected=ns['expected_boundary']
def describe(edges):return [{'edge':e,'points':[ns['new_points'][i]for i in e]}for e in sorted(edges)]
result={'failure':failure,'patchFaces':len(ns['patch']),'inputBoundaryEdges':len(ns['boundary']),'newFaces':len(ns['new_faces']),'missing':describe(expected-actual),'extra':describe(actual-expected),'sourceSha256':'a715a2a7307157f785eccc26897357735ae0b26095728d053372b7142b4d97df'}
(ns['args'].out/'boundary-failure.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));raise RuntimeError(failure)
