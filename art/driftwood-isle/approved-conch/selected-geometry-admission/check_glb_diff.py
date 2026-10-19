"""Exact decoded GLB attribute/index/material preservation and capture closure."""
import collections,json,sys
from pathlib import Path
import export_native as bridge
p=Path(__file__).resolve().parent
baseline=p.parent/'complete-pass2/conch-complete-pass2-study.glb'
corrected=p/'conch-study.glb'
def read(file):
 d,b=bridge.parse_glb(file.read_bytes());result={}
 for mesh in d['meshes']:
  result[mesh['name']]=[{'positions':bridge.accessor(d,b,x['attributes']['POSITION']),'normals':bridge.accessor(d,b,x['attributes']['NORMAL']),'indices':bridge.accessor(d,b,x['indices']),'material':d['materials'][x['material']]} for x in mesh['primitives']]
 return result
A,B=read(baseline),read(corrected)
assert list(A)==list(B)
rows=[]
for name in A:
 diffs=[]
 for i,(a,b) in enumerate(zip(A[name],B[name])):
  for field in a:
   if a[field]!=b[field]:
    if field=='material':raise AssertionError('Material changed: '+name)
    diffs.append({'primitive':i,'field':field,'changedIndices':[j for j,(x,y) in enumerate(zip(a[field],b[field])) if x!=y],'beforeCount':len(a[field]),'afterCount':len(b[field])})
 rows.append({'mesh':name,'unchanged':not diffs,'differences':diffs})
allowed={'Raised breast carapace -1','Raised breast carapace 1','Swept shoulder armor -1','Swept shoulder armor 1'}
assert {x['mesh'] for x in rows if not x['unchanged']}==allowed
# Blender may reorder deduplicated attribute vertices after their normals change.
# Resolve every exported point back to its authoritative source vertex index.
raw={m['mesh']:m for m in json.loads((p/'baseline-source-indexed.json').read_text())}
source_changes={m['mesh']:m['changes'] for m in json.loads((p/'indexed-diff.json').read_text())['meshes']}
for name in allowed:
 original=[[-v[0],v[1],v[2]] for v in raw[name]['vertices']]
 revised=[v.copy() for v in original]
 for change in source_changes[name]['positions']:revised[change['index']]=change['after']
 def source_tris(primitive,vertices):
  points=[(v[0],v[2],-v[1]) for v in vertices]
  remap=[]
  for point in primitive['positions']:
   match=[i for i,v in enumerate(points) if max(abs(a-b) for a,b in zip(point,v))<1e-7]
   assert len(match)==1,(name,point,match)
   remap.append(match[0])
  ids=[remap[x[0]] for x in primitive['indices']]
  return collections.Counter(min(t,t[1:]+t[:1],t[2:]+t[:2]) for t in [tuple(ids[j:j+3]) for j in range(0,len(ids),3)])
 for a,b in zip(A[name],B[name]):assert source_tris(a,original)==source_tris(b,revised),'Source-index triangle changed: '+name
report={'baselineSha256':bridge.sha(baseline.read_bytes()),'correctedSha256':bridge.sha(corrected.read_bytes()),'exactUnchangedMeshes':sum(r['unchanged'] for r in rows),'allMaterialsExact':True,'sourceIndexedOrientedTrianglesExact':True,'exportedIndexArraysExactForUntouchedMeshes':True,'note':'Four changed meshes have exporter vertex/index reorderings. Resolved oriented triangles correspond exactly to original source indices.','meshes':rows,'passed':True}
for variant,expected in [('baseline',A),('corrected',B)]:
 file=p/'captures'/variant/'conch-study.glb'
 if file.exists():
  captured=read(file);assert captured==expected,'Capture GLB differs from frozen '+variant
  report[variant+'CaptureClosure']={'sha256':bridge.sha(file.read_bytes()),'decodedAttributesIndicesMaterialsExact':True}
(p/'glb-indexed-diff.json').write_text(json.dumps(report,indent=2));print('Exact 47 untouched meshes and all materials; four changes preserve source-indexed oriented triangles, with exporter index reorderings recorded.')
