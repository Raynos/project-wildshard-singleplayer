"""Read-only evidence verification; writes only this review's report."""
from pathlib import Path
import json,hashlib,struct,math
root=Path(__file__).resolve().parents[3]
h=root/'art/driftwood-isle/lowpoly-bellback/complete-face-character'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text())
p=load(h/'provenance.json');checks=[]
for c in p['captures']:
 f=root/c['path'];assert sha(f)==c['sha256'] and f.stat().st_size==c['bytes'];checks.append(c['path'])
sets=[root/'tmp/bellback-complete-face-character',root/'tmp/bellback-complete-face-character/final',root/'tmp/bellback-complete-pass3']
receipts=[]
for folder in sets:
 receipts.append([load(folder/k/f'capture-{k}.json') for k in ['hero','nine']])
for k in range(2):
 a,b,c=[s[k] for s in receipts]
 assert a['lights']==b['lights']==c['lights']
 assert a['capture_script_sha256']==b['capture_script_sha256']==c['capture_script_sha256']==sha(h/'capture_review.py')
 for shots in zip(a['shots'],b['shots'],c['shots']):
  for key in ['name','camera','target','ortho_scale']:assert shots[0][key]==shots[1][key]==shots[2][key]
for name,source in [(0,h/'failed-initial/build_bellback_complete.py'),(1,h/'build_bellback_complete.py'),(2,h.parent/'complete-pass3/build_bellback_complete.py')]:
 for r in receipts[name]:assert r['source_sha256']==sha(source)
raw=(h/'bellback-complete-face-character.glb').read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2 and length==len(raw)
n=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+n]);buf=raw[28+n:]
assert sha(h/'bellback-complete-face-character.glb')==load(h/'validation.json')['sha256']
def vals(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt='<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*{'VEC3':3,'SCALAR':1}[a['type']];width=struct.calcsize(fmt);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,buf,start+j*v.get('byteStride',width)) for j in range(a['count'])]
tri=0;bad=0
for mesh in d['meshes']:
 for pr in mesh['primitives']:
  pos=vals(pr['attributes']['POSITION']);norm=vals(pr['attributes']['NORMAL']);ix=[v[0] for v in vals(pr['indices'])]
  assert all(math.isfinite(v) for row in pos+norm for v in row) and all(0<=i<len(pos) for i in ix)
  for k in range(0,len(ix),3):
   a,b,c=[pos[ix[k+j]] for j in range(3)];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   bad+=int(sum(x*x for x in cr)<=4e-20 or min(sum(cr[j]*norm[ix[k+i]][j] for j in range(3)) for i in range(3))<=0);tri+=1
assert bad==0
out={'status':'PASS bounded read-only checks','raw_captures_verified':len(checks),'paired_cameras_lights_capture_script':'identical across all three sets','source_hashes_verified':True,'final_source_sha256':sha(h/'build_bellback_complete.py'),'final_glb_sha256':sha(h/'bellback-complete-face-character.glb'),'reference_sha256':sha(root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp'),'triangles':tri,'invalid_area_or_normal_triangles':bad,'skins':len(d.get('skins',[])),'animations':len(d.get('animations',[])),'limitation':'No rerender, runtime, rigging, collision, animation or performance test.'}
Path(__file__).with_name('verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
