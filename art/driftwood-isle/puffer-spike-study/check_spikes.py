"""Strict source isolation/topology/attachment tests. No whole-model rating."""
import collections
import hashlib
import json
import numpy as np
from build_spikes import BASE,HERE,PARAMETERS,build,clearance
indexed,native=build();base=json.loads(BASE.read_text())
checks={'bonesExact':native['bones']==base['bones'],'otherPartsExact':native['parts'][1:]==base['parts'][1:]}
a=base['parts'][0];b=native['parts'][0]
checks['allNonpositionArraysExact']=all(b[k]==v for k,v in a.items()if k!='positions')
mutable={j for index in PARAMETERS for j in range((1426+index*6)*9,(1432+index*6)*9)}
checks['protectedPositionsExact']=all(x==y for j,(x,y)in enumerate(zip(a['positions'],b['positions']))if j not in mutable)
body=np.array(a['positions'][:1022*9]).reshape(-1,3,3)
rows=[]
for m in indexed['meshes']:
    v=np.array(m['vertices']);f=np.array(m['triangles']);edges=collections.Counter();directed=collections.Counter()
    for face in f:
        for x,y in zip(face,np.roll(face,-1)):edges[tuple(sorted((int(x),int(y))))]+=1;directed[(int(x),int(y))]+=1
    volume=float(np.einsum('ij,ij->i',v[f[:,0]],np.cross(v[f[:,1]],v[f[:,2]])).sum()/6)
    area=np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)/2
    cap=[face for face in f if m['tipVertexIndex']not in face]
    samples=[(v[face[0]]*i+v[face[1]]*j+v[face[2]]*(4-i-j))/4 for face in cap for i in range(5)for j in range(5-i)]
    cap_clearance=clearance(samples,body)
    c={'sampledCapBuriedOrExactRetention':m['baselineExact']or max(cap_clearance)<=-.002,'finite':bool(np.isfinite(v).all()),'closed':all(n==2 for n in edges.values()),'oriented':all(directed[(y,x)]==1 for x,y in directed),'positiveVolume':volume>0,'nondegenerate':bool(area.min()>1e-10),'modifiedRootCornersBuriedOrExactRetention':m['baselineExact']or max(m['rootClearance'])<=-.002}
    rows.append({'name':m['name'],'checks':c,'volume':volume,'minimumTriangleArea':float(area.min()),'rootClearance':m['rootClearance'],'baselineExact':m['baselineExact'],'rootCapSamples':len(samples),'maximumSampledCapClearance':max(cap_clearance)})
checks['primaryExact']=indexed['meshes'][1]['baselineExact'];checks['inheritedHiddenAccentExact']=indexed['meshes'][7]['baselineExact']
checks['spikeCountExact']=len(indexed['meshes'])==8
report={'status':'static geometry checks only; no visual acceptance, animation or runtime proof','checks':checks,'spikes':rows,'retainedRootCaveat':'Primary has an inherited +6.20 mm exposed corner; hidden rear accent has +34.43 mm. Preserved exactly, not falsely certified buried. Six modified wedges have all root corners at least 2 mm inside the actual main hull.','allPassed':all(checks.values())and all(all(r['checks'].values())for r in rows)}
report['generatedSourcePins']={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in (HERE/'build_spikes.py',HERE/'spikes-indexed.json',HERE/'spike-native-study.json')}
(HERE/'structural-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert report['allPassed']
