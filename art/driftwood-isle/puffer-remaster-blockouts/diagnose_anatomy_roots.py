"""Read-only diagnostic of the frozen failed blockout cap checks.

Re-runs the original preflight, preserves its failure, then queries root-corner
clearance under explicitly reported trial inward translations. No mesh mutation,
export or rendering. A recommendation is not an automatic control-file repair.
"""
import hashlib,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
source=Path(__file__).with_name('build_anatomy_revision.py')
if hashlib.sha256(source.read_bytes()).hexdigest()!='9f720069b4bd554fb2ef22f526ec1808a5741f921d59674cd64fb1368e08433a':raise RuntimeError('Frozen source identity changed')
ns={'__file__':str(source.resolve()),'__name__':'__main__'}
try:exec(compile(source.read_text(),str(source),'exec'),ns)
except RuntimeError as error:failure=str(error)
else:raise RuntimeError('Expected original cap failure was not reproduced')
body=ns['body'];vertices=[tuple(v.co)for v in body.data.vertices];faces=[tuple(p.vertices)for p in body.data.polygons]
tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
results=[]
for ob in ns['parts']:
    if ' fan 'not in ob.name:continue
    sign=-1 if ob.name.endswith('-1')else 1
    def clearance(shift):
        values=[]
        for v in list(ob.data.vertices)[:4]:
            point=Vector((v.co.x-sign*shift,v.co.y,v.co.z));hit,normal,index,distance=tree.find_nearest(point)
            query=ns['classify_surface_point'](tuple(point),vertices,faces,distance)
            values.append(dict(vertex=v.index,point=list(point),**query))
        return values
    before=clearance(0);chosen=None
    for mm in range(5,201,5):
        values=clearance(mm/1000)
        if all(v['signedEuclideanDistance']<=-.015 for v in values):
            chosen=dict(inwardShift=mm/1000,queries=values);break
    results.append(dict(part=ob.name,before=before,trialRecommendation=chosen))
receipt={'status':'original failure preserved; read-only trial coordinates','failure':failure,'candidate':ns['args'].candidate,'meshAudits':ns['audits'],'results':results}
(ns['args'].out/'root-diagnostic.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
raise RuntimeError(failure)
