"""Read-only independent evidence checks; outputs only into this review directory."""
import collections,hashlib,json,math,struct,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
P=ROOT/'art/driftwood-isle/approved-conch/selected-geometry-admission'
OUT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
freeze=json.loads((P/'freeze.json').read_text())
checks=[]
for group,base in [('inputs',ROOT),('files',P)]:
 for name,row in freeze[group].items():
  f=base/name;assert sha(f)==row['sha256'] and f.stat().st_size==row['bytes'],name
  checks.append(name)
# Original and corrected hero camera/light/sample code is byte-identical.
a=(P.parent/'complete-pass2/build_conch_complete_pass2.py').read_text();b=(P/'build_selected_conch.py').read_text()
marker='if A.render:'
assert a[a.index(marker):]==b[b.index(marker):]
assert (P/'captures/baseline/cameras-complete-pass2.json').read_bytes()==(P/'captures/corrected/cameras-complete-pass2.json').read_bytes()
# Reconstruct pre-mirror source points from frozen original points and exact indexed edits.
original={x['mesh']:x for x in json.loads((P/'baseline-source-indexed.json').read_text())}
edits={x['mesh']:x['changes'] for x in json.loads((P/'indexed-diff.json').read_text())['meshes']}
sub=lambda a,b:tuple(x-y for x,y in zip(a,b))
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
unit=lambda v:tuple(x/math.sqrt(dot(v,v)) for x in v)
results={}
for variant in ('baseline','corrected'):
 rows=[]
 for sweep in json.loads((P/'source-sweep-check.json').read_text())['meshes']:
  name=sweep['mesh'];points=[v[:] for v in original[name]['vertices']]
  if variant=='corrected':
   for edit in edits[name].get('positions',[]):
    x,y,z=edit['after'];points[edit['index']]=[-x,y,z]
  if name.startswith('Swept shoulder armor'):
   points=[[x,y,1.33+(z-1.33)/.86] for x,y,z in points]
  if name.startswith('Bent armored thigh'):
   cx=sum(v[0] for v in points)/len(points);points=[[cx+(x-cx)/.87,y,z] for x,y,z in points]
  profile=sweep['profile'];n=len(points)//len(profile);minimum=1;bad=0;fold=0
  for j in range(len(profile)-1):
   for i in range(n):
    k=(i+1)%n;q,r,t,u=[points[ix] for ix in (j*n+i,j*n+k,(j+1)*n+i,(j+1)*n+k)];norms=[]
    for h,tri in enumerate(((q,r,u),(q,u,t))):
     aa,bb,cc=tri;norm=unit(cross(sub(bb,aa),sub(cc,aa)));center=tuple(((2-h)*x+(1+h)*y)/3 for x,y in zip(profile[j][0],profile[j+1][0]));centroid=tuple(sum(v[c] for v in tri)/3 for c in range(3));cos=dot(norm,unit(sub(centroid,center)));minimum=min(minimum,cos);bad+=cos<=0;norms.append(norm)
    fold+=dot(*norms)<=0
  rows.append({'mesh':name,'minimumRadialCosine':minimum,'opposed':bad,'foldedPairs':fold})
 results[variant]=rows
assert all(x['opposed']==0 and x['foldedPairs']==0 for x in results['corrected'])
assert {x['mesh'] for x in results['baseline'] if x['opposed'] or x['foldedPairs']}=={'Raised breast carapace -1','Raised breast carapace 1','Swept shoulder armor -1','Swept shoulder armor 1'}
# Execute existing decode/correspondence checks with only report output redirected.
sys.path.insert(0,str(P));sys.dont_write_bytecode=True
code=(P/'check_glb_diff.py').read_text().replace("(p/'glb-indexed-diff.json').write_text", "(Path("+repr(str(OUT/'decoded-glb-verification.json'))+")).write_text")
exec(compile(code,'read_only_glb_check','exec'),{'__file__':str(P/'check_glb_diff.py'),'__name__':'review_check'})
import export_native as bridge
doc,blob=bridge.parse_glb((P/'conch-study.glb').read_bytes())
native=json.loads((P/'native/conch-character-pass-native.json').read_text());mapping=json.loads((P/'native/mesh-map.json').read_text());parts={x['name']:x for x in native['parts']};triangles=0
for row in mapping:
 node=doc['nodes'][row['node']];mesh=doc['meshes'][node['mesh']];part=parts[row['joint']];translation=node.get('translation',[0,0,0])
 for primitive,entry in zip(mesh['primitives'],row['primitives']):
  pp=bridge.accessor(doc,blob,primitive['attributes']['POSITION']);ids=[i[0] for i in bridge.accessor(doc,blob,primitive['indices'])];expected=[v+translation[k] for i in ids for k,v in enumerate(pp[i])];start=entry['vertexStart']*3
  assert part['positions'][start:start+len(expected)]==expected
  factor=doc['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
  assert part['colorsLinear'][start:start+len(expected)]==factor*len(ids)
  triangles+=len(ids)//3
assert triangles==2190
runs=[]
for test in ('test_source_gate.py','test_export_native.py'):
 result=subprocess.run([sys.executable,'-B',str(P/test),'-v'],capture_output=True,text=True,cwd=ROOT);assert result.returncode==0,result.stderr;runs.append({'test':test,'output':result.stderr})
actual={'meshes':len(doc['meshes']),'primitives':sum(len(x['primitives']) for x in doc['meshes'])}
report={'hashFilesVerified':len(checks),'approvedOriginalSha256':sha(ROOT/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp'),'cameraReceiptsIdentical':True,'heroLightingCameraSamplesIdentical':True,'sourceSweepRecomputedFromIndexedCoordinates':results,'nativeTrianglePositionsAndLinearColorsExact':triangles,'actualGLBCounts':actual,'nativeClosureClaim':{k:json.loads((P/'native/closure.json').read_text())[k] for k in ('sourceMeshes','sourcePrimitives')},'tests':runs,'limits':['No fresh Blender generation or render','Crossing report hash verified; triangle crossing scan not independently rerun','Camera/light provenance is source/receipt consistency, not a signed renderer attestation']}
(OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ('sourceSweepRecomputedFromIndexedCoordinates','tests')},indent=2))
