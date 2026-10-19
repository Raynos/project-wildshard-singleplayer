"""Read-only independent checks; writes only this review's closure.json."""
from pathlib import Path
import ast, copy, hashlib, json, math, struct
from PIL import Image
R=Path(__file__).resolve().parents[3]
A=R/'art/driftwood-isle/lowpoly-mantis/complete-pass2'; T=R/'tmp/mantis-complete-pass2'
O=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())
checks={}; failures=[]
def check(name,value):
 checks[name]=value
 if not value:failures.append(name)
for scope in [A,A/'failed-root-gap']:
 e=read(scope/'evidence.json')
 for key in ['files','rawHashes']:
  rows=e.get(key,{})
  check(str(scope.relative_to(R))+'/'+key,all((R/p).is_file() and sha(R/p)==h for p,h in rows.items()))
check('preserved-inputs',all(sha(R/p)==h for p,h in read(A/'preserved-inputs.json').items()))
frames=read(A/'capture-check.json')['frames']
check('all-20-frame-hashes-and-dimensions',len(frames)==20 and all(sha(R/f['path'])==f['sha256'] and list(Image.open(R/f['path']).size)==f['size']==[638,900] for f in frames))
pr=read(A/'capture-source-provenance.json'); fp=read(A/'failed-root-gap/source-provenance.json')
exe=R/fp['exactExecutedSource']; normal=A/'failed-root-gap/build_mantis_complete.py'; source=A/'build_mantis_complete.py'
check('failed-exact-executed-source-hash',sha(exe)==fp['executedSourceSha256']==pr['failedExecutedSourceSha256'])
check('failed-normalized-source-hash',sha(normal)==fp['normalizedSourceSha256']==pr['failedNormalizedSourceSha256'])
check('failed-normalization-is-only-trailing-whitespace',normal.read_text()=='\n'.join(x.rstrip() for x in exe.read_text().splitlines())+'\n')
check('failed-independent-AST-equivalence',ast.dump(ast.parse(exe.read_text()))==ast.dump(ast.parse(normal.read_text())))
check('final-source-hash',sha(source)==pr['executedSourceSha256']==pr['publicSourceSha256'])
check('only-root-correction-in-final-source',source.read_text()==normal.read_text().replace('sh=(s*.14,-.22,1.94)','sh=(s*.12,.10,1.94)'))
for n in ['mantis-mesh-complete-pass2.json','metrics-complete-pass2.json']:
 check(n+'-raw-vs-art-parsed-equality',read(A/n)==read(T/'candidate'/n))
check('candidate-glb-exact',sha(A/'mantis-study-complete-pass2.glb')==sha(T/'candidate/mantis-study-complete-pass2.glb'))
check('camera-raw-art-parsed-equality',read(A/'cameras.json')==read(T/'cameras.json'))
check('failed-final-cameras-equal',read(A/'failed-root-gap/cameras.json')==read(T/'cameras.json'))
def glb(p):
 b=p.read_bytes();magic,version,total=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and total==len(b)
 chunks=[];i=12
 while i<len(b):
  length,kind=struct.unpack_from('<II',b,i);chunks.append((kind,b[i+8:i+8+length]));i+=8+length
 assert i==len(b)
 return json.loads(chunks[0][1]),chunks[1:]
historic=A.parent/'complete-pass1/mantis-study-complete-pass1.glb'; rebuilt=T/'baseline/mantis-study-complete-pass1.glb'
j0,b0=glb(historic);j1,b1=glb(rebuilt);diff=[]
for key in ['materials','meshes']:
 assert len(j0[key])==len(j1[key])
 for i,(x,y) in enumerate(zip(j0[key],j1[key])):
  if x.get('name')!=y.get('name'):diff.append({'section':key,'index':i,'historic':x.get('name'),'rebuilt':y.get('name')})
  assert x.get('name','').removesuffix('.001')==y.get('name','')
  x.pop('name',None);y.pop('name',None)
check('historic-rebuilt-glb-NOT-byte-equal',sha(historic)!=sha(rebuilt))
check('historic-rebuilt-only-material-mesh-name-suffix-difference',bool(diff) and j0==j1 and b0==b1)
for n in ['mantis-mesh-complete-pass1.json','metrics-complete-pass1.json']:
 check('baseline-'+n+'-byte-equal',(A.parent/'complete-pass1'/n).read_bytes()==(T/'baseline'/n).read_bytes())
fits=[]
for role,suffix in [('baseline','complete-pass1'),('candidate','complete-pass2')]:
 pts=[v for p in read(T/role/('mantis-mesh-'+suffix+'.json'))['parts'] for v in p['vertices']]
 for name,c in read(T/'cameras.json')['cameras'].items():
  rx,ry,rz=c['rotation'];cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
  M=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]]
  q=[[sum(M[j][i]*(p[j]-c['location'][j]) for j in range(3)) for i in range(2)] for p in pts]
  x=max(abs(v[0]) for v in q)/(c['orthoScale']*(638/900)/2);y=max(abs(v[1]) for v in q)/(c['orthoScale']/2)
  fits.append({'role':role,'view':name,'maxX':x,'maxY':y});check(role+'-'+name+'-inside-frame',x<1 and y<1)
check('common-nine-view-scale',len(set(c['orthoScale'] for n,c in read(T/'cameras.json')['cameras'].items() if n!='hero'))==1)
out={'status':'PASS' if not failures else 'FAIL','checks':checks,'failures':failures,'frames':frames,'historicGlbSha256':sha(historic),'rebuiltGlbSha256':sha(rebuilt),'baselineNameDifferences':diff,'projectionFits':fits,'sourceSha256':sha(source),'candidateGlbSha256':sha(A/'mantis-study-complete-pass2.glb'),'frozenInitialSha256':sha(O/'frozen-initial-judgment.md'),'limits':['Static read-only verification, no build or render replay.','Final executed-source identity is consistent with preserved provenance and source correction, not independently observed execution.','Historical GLB is not byte-identical: only material/mesh datablock .001 suffix differences; all remaining JSON and all non-JSON chunks exactly equal.','No animation, runtime, intersection-free motion or native admission established.']}
(O/'closure.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':out['status'],'checks':len(checks),'failures':failures,'nameDifferences':len(diff)},indent=2))
