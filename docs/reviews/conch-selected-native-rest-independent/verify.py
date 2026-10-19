"""Read-only verification and pixel statistics; stdout only, no render/cache writes."""
import hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[3]
Q=R/'tmp/conch-selected-view-qa/attempt3'
load=lambda p:json.loads(p.read_text())
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
r=load(Q/'report.json'); assert r['completed'] and not r['errors']
assert r['identityBefore']==r['identityAfter']
i=r['identityBefore'];host=R/'tmp/conch-selected-view-dist-attempt3'
actual={str(p.relative_to(host)):hashfile(p) for p in host.rglob('*') if p.is_file()}
assert actual==i['files']
assert hashfile(host/'selected-view-host-files.json')==i['hostInventorySha256']
assert hashfile(host/'conch-preview.json')==i['previewSha256']
assert hashfile(R/'tmp/conch-selected-view-attempt3/reviewed-build-pin.json')==i['buildPinSha256']
for p,h in i['buildPin']['files'].items(): assert hashfile(R/p)==h,p
pins=load(R/'art/driftwood-isle/approved-conch/selected-native-view/native-pins.json')
for p,v in pins.items(): assert hashfile(R/p)==v['sha256'],p
src=R/'art/driftwood-isle/approved-conch/selected-geometry-admission/conch-study.glb'
assert hashfile(src)=='21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a'
assert hashfile(host/('selected-source-'+hashfile(src)+'.glb'))==hashfile(src)
g=load(Q/'actual-runtime-geometry.json');n=load(R/'art/driftwood-isle/approved-conch/selected-native-normals/native/conch-character-pass-native.json')
attrs={};arrays={}
for channel,key in {'position':'positions','normal':'normals','color':'colorsLinear','skinIndex':'skinIndices','skinWeight':'skinWeights','furLen':'furLen'}.items():
 a=np.array([x for p in n['parts'] for x in p[key]],dtype=np.uint16 if channel=='skinIndex' else np.float32).astype(float)
 b=np.array([x for p in g['geometry'] for x in p['attributes'][channel]['values']]);d=abs(a-b)
 attrs[channel]={'components':len(a),'changed':int((d!=0).sum()),'maxAbs':float(d.max())};arrays[channel]=(a,b)
 assert attrs[channel]==r['attributeComparison'][channel]
a,b=[x.reshape(-1,3) for x in arrays['normal']]
angle=np.degrees(np.arccos(np.clip((a*b).sum(1)/(np.linalg.norm(a,axis=1)*np.linalg.norm(b,axis=1)),-1,1)))
views=[]
for p in r['pairs']:
 v=p['view'];o=load(Q/(v+'-observation.json'))
 assert all(o[k]==p[k] for k in o)
 assert p['root']==p['sourceRoot']==p['nativeRoot']
 assert p['lightState']['native']==p['lightState']['source']==p['lightState']['after']
 assert len(p['bones'])==15 and all(b['rotation']==[0,0,0] and b['scale']==[1,1,1] for b in p['bones'].values())
 c=p['camera'];assert c['fov']==95
 assert all(lo<=x<=hi for x,lo,hi in zip(c['position'],c['room']['cameraMin'],c['room']['cameraMax']))
 assert all(abs(x)<=1 for corner in c['projectedCorners'] for x in corner)
 ims=[]
 for variant in ['native','source']:
  f=Q/p['images'][variant]['file'];assert hashfile(f)==p['images'][variant]['sha256']; im=np.asarray(Image.open(f).convert('RGB')).astype(float);assert im.shape==(874,402,3);ims.append(im)
 a,b=ims;delta=abs(a-b);warm=lambda x:(x[:,:,0]>x[:,:,2]*1.1)&(x[:,:,0]>x[:,:,1]*.95)&(x[:,:,0]>50)
 mask=warm(a)|warm(b); yy,xx=np.where(mask);bbox=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
 x0,y0,x1,y1=bbox;roi=delta[y0:y1,x0:x1]
 views.append({'view':v,'camera':c['position'],'quaternion':c['quaternion'],'root':p['root'],'warm_union_bbox':bbox,'bbox_rgb_mae_255':float(roi.mean()),'warm_union_rgb_mae_255':float(delta[mask].mean()),'warm_union_pixels_delta_gt8_percent':float((delta.max(2)[mask]>8).mean()*100),'whole_frame_changed_pixels':int((delta.max(2)>0).sum()),'before_light_equals_rendered':p['lightState']['before']==p['lightState']['native']})
prior={}
for attempt in [1,2]:
 folder=R/f'tmp/conch-selected-view-qa/attempt{attempt}';prior[str(attempt)]={str(p.relative_to(folder)):hashfile(p) for p in folder.rglob('*') if p.is_file()}
result={'verified':True,'source_sha256':hashfile(src),'host_inventory_sha256':i['hostInventorySha256'],'build_pin_sha256':i['buildPinSha256'],'approved_original_sha256':hashfile(R/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp'),'attributes':attrs,'normal_angles':{'vertices_gt1degree':int((angle>1).sum()),'triangles_any_vertex_gt1degree':int((angle.reshape(-1,3)>1).any(1).sum()),'max_degrees':float(angle.max())},'views':views,'preserved_attempt_files':prior,'metric_caveat':'Warm-color union is a heuristic, not a perfect silhouette mask or quality score. Bbox includes background. No resizing or image modification.'}
print(json.dumps(result,indent=2))
