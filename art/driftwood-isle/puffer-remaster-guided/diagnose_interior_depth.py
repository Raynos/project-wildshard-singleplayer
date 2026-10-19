"""Read-only depth diagnostic for the frozen failed guided surface; never exports."""
import hashlib,json
from pathlib import Path
p=Path(__file__).with_name('build_guided_surface_interior.py')
expected='8023a5349f63a39b5d138cf67949b75d4d979f50d11af73ada628d4781181b07'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Frozen source changed')
ns={'__file__':str(p.resolve()),'__name__':'__main__'}
try:exec(compile(p.read_text(),str(p),'exec'),ns)
except RuntimeError as error:failure=str(error)
else:raise RuntimeError('Expected failed guard did not recur')
if 'changed source depth' not in failure:raise RuntimeError(failure)
vertices=ns['vertices'];records=[]
for old in sorted({i for fi in ns['patch'] for i in ns['faces'][fi]}):
    point=vertices[old]
    for index,f in enumerate(ns['replacement']):
        a,b,c=[vertices[i]for i in f]
        den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(den)<1e-14:continue
        u=((b[2]-c[2])*(point[0]-c[0])+(c[0]-b[0])*(point[2]-c[2]))/den
        v=((c[2]-a[2])*(point[0]-c[0])+(a[0]-c[0])*(point[2]-c[2]))/den
        if min(u,v,1-u-v)>=-1e-8:
            y=u*a[1]+v*b[1]+(1-u-v)*c[1]
            records.append({'oldVertex':old,'oldPoint':point,'replacementFace':index,'triangle':[a,b,c],'newY':y,'deltaY':y-point[1],'absoluteDelta':abs(y-point[1]),'boundary':old in ns['boundary_ids']})
result={'sourceSha256':expected,'failure':failure,'maximumDepthLoss':ns['maximum_depth_loss'],'beforeVolume':ns['before_volume'],'afterVolume':ns['after_volume'],'oldConcaveHinge':ns['old_hinge'],'newConcaveHinge':ns['new_hinge'],'worstSamples':sorted(records,key=lambda r:r['absoluteDelta'],reverse=True)[:25]}
(ns['args'].out/'depth-failure.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));raise RuntimeError(failure)
