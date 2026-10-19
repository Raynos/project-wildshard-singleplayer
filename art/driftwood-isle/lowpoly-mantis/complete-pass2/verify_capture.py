"""Verify paired source identity, camera fit, image payloads and adaptation limits."""
from pathlib import Path
import hashlib,json,math,struct,copy
from PIL import Image
here=Path(__file__).resolve().parent;root=here.parents[3];raw=root/'tmp/mantis-complete-pass2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
frames=[]
for role in ['baseline','candidate']:
 for view in ['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']:
  p=raw/role/(view+'.png');im=Image.open(p);im.load()
  assert im.size==(638,900)
  frames.append({'path':str(p.relative_to(root)),'sha256':sha(p),'size':list(im.size)})
# Derive orthographic projection using the exact Blender XYZ Euler rotation.
cameras=json.loads((raw/'cameras.json').read_text())['cameras'];fits=[]
for role,suffix in [('baseline','complete-pass1'),('candidate','complete-pass2')]:
 model=json.loads((raw/role/('mantis-mesh-'+suffix+'.json')).read_text())
 pts=[v for part in model['parts'] for v in part['vertices']]
 for view,c in cameras.items():
  rx,ry,rz=c['rotation'];cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
  r=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]]
  local=[]
  for p in pts:
   q=[p[i]-c['location'][i] for i in range(3)];local.append([sum(r[j][i]*q[j] for j in range(3)) for i in range(3)])
  x=max(abs(v[0]) for v in local)/(c['orthoScale']*(638/900)/2);y=max(abs(v[1]) for v in local)/(c['orthoScale']/2)
  assert x<1 and y<1,(role,view,x,y)
  fits.append({'role':role,'view':view,'maxNormalizedX':x,'maxNormalizedY':y,'geometryInsideFrame':True})
old=here.parent/'complete-pass1'
def glb_semantics(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
 for key in ['materials','meshes']:
  for entry in j[key]:entry.pop('name',None)
 return j,b[28+n:]
def glb_json(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n])
prior=glb_json(old/'mantis-study-complete-pass1.glb');rebuilt=glb_json(raw/'baseline/mantis-study-complete-pass1.glb');namechanges=[]
for key in ['materials','meshes']:
 assert len(prior[key])==len(rebuilt[key])
 for index,(before,after) in enumerate(zip(prior[key],rebuilt[key])):
  assert before['name'].removesuffix('.001')==after['name'],(key,index,before['name'],after['name'])
  if before['name']!=after['name']:namechanges.append({'section':key,'index':index,'historic':before['name'],'rebuilt':after['name']})
(here/'baseline-name-differences.json').write_text(json.dumps({'initialExactByteCheck':'FAILED; retained as a discrepancy, not a source rewrite','permittedDifference':'Only final .001 suffix on material and mesh datablock names','allOtherJsonAndBinaryExactlyEqual':glb_semantics(raw/'baseline/mantis-study-complete-pass1.glb')==glb_semantics(old/'mantis-study-complete-pass1.glb'),'differences':namechanges},indent=2)+'\n')
assert glb_semantics(raw/'baseline/mantis-study-complete-pass1.glb')==glb_semantics(old/'mantis-study-complete-pass1.glb')
for name in ['mantis-mesh-complete-pass1.json','metrics-complete-pass1.json']:
 assert (raw/'baseline'/name).read_bytes()==(old/name).read_bytes()

for name in ['mantis-mesh-complete-pass2.json','mantis-study-complete-pass2.glb','metrics-complete-pass2.json']:
 assert (json.loads((raw/'candidate'/name).read_text())==json.loads((here/name).read_text()) if name.endswith('.json') else sha(raw/'candidate'/name)==sha(here/name))
metric=json.loads((here/'metrics-complete-pass2.json').read_text());mesh=json.loads((here/'mantis-mesh-complete-pass2.json').read_text())
native=json.loads((here.parent/'runtime-admission/v7-rigid1/mantis-v7-native.json').read_text())
missing=set(b['name'] for b in native['bones'])-set(metric['pivots'])
assert missing=={'neck','abdomen'}
maprows=[];unmapped=[]
for p in mesh['parts']:
 joint=p['joint'];name=p['name'];current=joint
 if joint=='body':
  if name.startswith(('Abdomen','Abdominal','Lateral tail')):current='abdomen'
  elif name.startswith(('Rising prothorax','Pale ventral thorax','Imbricated thorax','Rear neck collar','Overlapping dorsal neck')):current='neck'
  elif not name.startswith('Coxal bark shield'):current=None;unmapped.append(name)
 proposed=current if current else 'neck'
 maprows.append({'part':name,'authoredJoint':joint,'oldAdapterSemanticMatch':current,'proposedNativeJoint':proposed})
limits={'status':'NOT NATIVE ADMITTED; mapping proposal only','staticPivotCount':len(metric['pivots']),'nativeJointCount':len(native['bones']),'missingDerivedJoints':sorted(missing),'unmappedByExistingSemanticAdapter':unmapped,'partMap':maprows,'requiredParentChanges':{'head':'body -> neck','raptor-1':'body -> neck','raptor1':'body -> neck'},'proposedDerivedPivotsBlender':{'neck':[0,.36,1.4],'abdomen':[0,.14,1.47]},'limits':['Old adapter pins exact V7 hashes and must refuse this source.','No weights, skeleton, animation or native runtime output generated.','Rebuilt neck, arm pivots and overlapping leaves require fresh articulation/contact tests.','Existing V7 runtime scores and admission cannot transfer.','Static manifold checks do not exclude inter-part or self-intersections.']}
(here/'mapping-limits.json').write_text(json.dumps(limits,indent=2)+'\n')
files=[p for p in here.iterdir() if p.is_file()]
for p in files:
 limit=500000 if 'board' in p.name else 250000 if p.suffix=='.webp' else 5000000 if p.suffix=='.json' else 1000000
 assert p.stat().st_size<=limit,(p.name,p.stat().st_size,limit)
report={'status':'PASS','frames':frames,'historicPass1GlbSha256':sha(old/'mantis-study-complete-pass1.glb'),'matchedRebuiltPass1GlbSha256':sha(raw/'baseline/mantis-study-complete-pass1.glb'),'baselineGlbDifference':'Only material/mesh datablock name .001 suffixes; binary chunk and all other JSON identical; portable mesh and metrics byte-identical','candidateGlbSha256':sha(here/'mantis-study-complete-pass2.glb'),'candidateSourceSha256':sha(here/'build_mantis_complete.py'),'executedSourceSha256':json.loads((here/'capture-source-provenance.json').read_text())['executedSourceSha256'],'resolution':[638,900],'projectionFits':fits,'baselineGeometryPreserved':True,'storageCapsPass':True,'jsonArtifactNormalization':'One terminal LF added to copied mesh/metrics/camera JSON; parsed values equal raw outputs. GLB untouched.','independentLikenessReview':'pending; no builder score'}
(here/'capture-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='frames'},indent=2))
