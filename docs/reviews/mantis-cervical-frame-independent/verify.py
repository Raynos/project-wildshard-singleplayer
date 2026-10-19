"""Read-only independent checks; writes only this review's receipt, no rendering."""
import copy, hashlib, json, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
V=ROOT/'art/driftwood-isle/lowpoly-mantis/cervical-frame-visual'
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def glb(p):
 b=p.read_bytes(); magic,version,total=struct.unpack_from('<III',b)
 assert magic==0x46546c67 and version==2 and total==len(b)
 chunks=[];i=12
 while i<len(b):
  size,kind=struct.unpack_from('<II',b,i);chunks.append((kind,b[i+8:i+8+size]));i+=8+size
 assert chunks[0][0]==0x4e4f534a
 return json.loads(chunks[0][1]),chunks[1:]
pins=read(V/'input-pins.json');pinchecks={p:sha(ROOT/p)==h for p,h in pins.items()}
assert all(pinchecks.values())
prov=read(V/'capture-provenance.json');cams=read(V/'cameras.json');ev=read(V/'evidence.json')
frames=[]
for f in ev['rawFrames']:
 p=ROOT/f['path']; b=p.read_bytes(); role=p.parent.name;view=p.stem;r=prov[role]['capturedViews'][view]
 assert sha(p)==f['sha256']==r['sha256']
 assert len(b)==f['bytes'] and list(struct.unpack('>II',b[16:24]))==f['size']==[638,900]
 assert r['camera']==cams['cameras'][view] and r['settings']==cams['settings']
 frames.append({'path':f['path'],'sha256':sha(p),'hash_size_camera_settings_match':True})
assert len(frames)==20
roles={}
for role,suffix in [('baseline','complete-pass2'),('candidate','cervical-frame-repair')]:
 frozen=V.parent/suffix;rebuilt=ROOT/'tmp/mantis-cervical-frame-visual'/role
 name='mantis-study-'+suffix+'.glb';fp=frozen/name;rp=rebuilt/name
 assert sha(fp)==prov[role]['frozenGlbSha256'] and sha(rp)==prov[role]['rebuiltGlbSha256']
 assert sha(ROOT/prov[role]['sourcePath'])==prov[role]['sourceSha256']
 a,ab=glb(fp);b,bb=glb(rp);diff=[]
 for section in ['materials','meshes']:
  assert len(a[section])==len(b[section])
  for i,(x,y) in enumerate(zip(a[section],b[section])):
   if x.get('name')!=y.get('name'):diff.append({'section':section,'index':i,'frozen':x['name'],'rebuilt':y['name']})
   x.pop('name',None);y.pop('name',None)
 assert a==b and ab==bb
 if role=='baseline':
  assert diff==read(V/'baseline-name-differences.json')['differences']
  assert all(d['frozen']==d['rebuilt']+'.001' for d in diff)
 else: assert sha(fp)==sha(rp) and not diff
 for prefix in ['mantis-mesh-','metrics-']:
  assert read(frozen/(prefix+suffix+'.json'))==read(rebuilt/(prefix+suffix+'.json'))
 roles[role]={'source_sha256':prov[role]['sourceSha256'],'frozen_glb_sha256':sha(fp),'rebuilt_glb_sha256':sha(rp),'byte_exact':sha(fp)==sha(rp),'all_other_json_and_binary_exact':True,'name_suffix_difference_count':len(diff),'mesh_and_metrics_equal':True}
receipt={'all_pins_match':pinchecks,'roles':roles,'frames':frames,'paired_camera_lighting_parity':True,'settings':cams['settings'],'scope':'Verified present frozen/rebuilt artifacts and capture receipts; renderer source inspected, not rerun. Structural/native correspondence reports read, not independently rerun.'}
(HERE/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'pin_count':len(pins),'frame_count':len(frames),'roles':roles,'parity':True},indent=2))
