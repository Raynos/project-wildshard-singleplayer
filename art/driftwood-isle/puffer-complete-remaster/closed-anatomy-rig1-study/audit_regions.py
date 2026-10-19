"""Separate real source semantic regions; no collider or gameplay acceptance."""
import json,hashlib,math,sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
source=ROOT/'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json'
pass2=ROOT/'art/driftwood-isle/puffer-complete-remaster/pass2/pass2-native.json'
provenance=ROOT/'art/driftwood-isle/puffer-complete-remaster/pass2/construction-receipt.json'
s=json.loads(source.read_bytes());p=json.loads(pass2.read_bytes());receipt=json.loads(provenance.read_bytes())
assert s['parts'][0]['positions'][9198:]==p['parts'][0]['positions'][9198:]
positions=s['parts'][0]['positions'];spikes=receipt['spikes']
for spike in spikes:
 start=(1426+spike['index']*6)*9
 expanded=[x for face in spike['faces'] for j in face for x in spike['vertices'][j]]
 assert positions[start:start+54]==expanded
ranges=[('core-continuous-hull',0,1022),('authored-face-brows-beak',1022,1426)]+[('decorative-spike-'+str(i),1426+i*6,1432+i*6) for i in range(8)]
dims=json.loads((ROOT/'art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json').read_bytes())
regions=[];outside=[]
for name,start,end in ranges:
 points=[positions[3*i:3*i+3] for i in range(start*3,end*3)]
 gaps=[math.sqrt(x*x+(y-dims['bodyY'])**2+max(0,abs(z)-dims['bodyHalfLen'])**2)-dims['bodyRadius'] for x,y,z in points]
 misses=[{'vertex':start*3+i,'triangle':start+i//3,'position':pt,'outsideMetres':gap} for i,(pt,gap) in enumerate(zip(points,gaps)) if gap>0]
 regions.append({'region':name,'triangleRangeHalfOpen':[start,end],'vertices':len(points),'maximumSignedOutside':max(gaps),'outsideTriangleVertices':len(misses),'uniqueOutsideCoordinates':len({tuple(row['position']) for row in misses}),'witnesses':misses})
 outside.extend(misses)
assert len(outside)==20
assert all(row['outsideTriangleVertices']==0 for row in regions[:2])
head=s['parts'][1];headpos=next(b['pos'] for b in s['bones'] if b['name']=='head');headgaps=[math.dist(head['positions'][i:i+3],headpos)-dims['headRadius'] for i in range(0,len(head['positions']),3)]
report={'sourceSha256':sha(source),'derivativeSha256':sha(HERE/'closed-anatomy-rig1-native.json'),'semanticProvenance':[{'path':str(path.relative_to(ROOT)),'sha256':sha(path)} for path in [pass2,provenance,ROOT/'art/driftwood-isle/puffer-complete-remaster/pass2/build_candidate.py',ROOT/'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/build_candidate.py']], 'rangeProof':'Selected positions after first1022 triangles exactly equal pass2; each six-triangle spike array exactly reconstructs from pinned producer receipt vertices/faces. Core0..1021, authored face1022..1425, eight spikes1426..1473.','regionsAgainstUnmodifiedPublicRestBodyCapsule':regions,'headAgainstUnmodifiedPublicHeadSphere':{'outsideVertices':sum(g>0 for g in headgaps),'maximumSignedOutside':max(headgaps)},'conclusion':'All20 misses are five unique decorative spike tips (indices1,3,4,5,6), each repeated in four triangle corners. Zero core hull or face-region vertices miss the old rest capsule. This defeats automatic whole-weight radius padding; it does not approve old collision dimensions for living inflated poses, gameplay or physics death.','colliderAcceptance':False,'contactExemptionsAdded':False,'runtimeAdmission':False}
(HERE/'semantic-envelope-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'coreMaxSignedOutside':regions[0]['maximumSignedOutside'],'faceMaxSignedOutside':regions[1]['maximumSignedOutside'],'misses':20,'uniqueTips':5,'headMaxSignedOutside':max(headgaps)}))
