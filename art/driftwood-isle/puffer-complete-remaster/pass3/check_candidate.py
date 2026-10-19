"""Focused construction and inherited-defect audit, not a likeness score."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
H=Path(sys.argv[1]).resolve();ROOT=next(p for p in H.parents if (p/'AGENTS.md').exists());A=ROOT/'art/driftwood-isle'
sys.path.insert(0,str(A/'puffer-spike-study'));from build_spikes import clearance
n=json.loads((H/'pass3-native.json').read_text());b=json.loads((A/'puffer-complete-remaster/pass2/pass2-native.json').read_text());r=json.loads((H/'construction-receipt.json').read_text());t=json.loads((H/'topology-preflight-failure.json').read_text());f=json.loads((H/'fin-root-audit.json').read_text())
hull=np.array(n['parts'][0]['positions'][:r['hullTriangles']*9]).reshape(-1,3,3)
v=np.array(n['parts'][2]['positions'][:132*3]).reshape(-1,3);root=np.unique(v[np.isclose(v[:,2],v[:,2].max(),atol=1e-8,rtol=0)],axis=0);samples=np.concatenate([root,(root[:,None]+root[None,:]).reshape(-1,3)/2,root.mean(0)[None]])
ds=clearance(samples,hull)
checks={'hashPinned':hashlib.sha256((H/'pass3-native.json').read_bytes()).hexdigest()==r['candidatePin']['sha256'],'eightExactPivots':n['bones']==b['bones'] and len(n['bones'])==8,'completeSevenParts':len(n['parts'])==7,'headExact':n['parts'][1]==b['parts'][1],'tailExact':n['parts'][2]==b['parts'][2],'finsExact':n['parts'][3:]==b['parts'][3:],'closedOrientedMainHull':t['sources']['pass3']['parts'][0]['components'][0]['closedOriented'],'substantialRemesh':r['newPatchTriangles']>100 and r['retainedOrbitalHullTriangles']<500,'tailSamplesBuried':max(ds)<0,'finSamplesBuried':all(x['allSampledInside']for x in f),'eightSpikeRootsBuried':all(x['maximumSampledDistance']<=-.004 for x in r['spikes']),'inheritedInlaysExplicit':sorted(c['triangles']for p in t['sources']['pass3']['parts']for c in p['components']if not c['closedOriented'])==[2,2,2,7],'noSelfScore':r['qualityScore']is None,'underMillionByteGlb':(H/'pass3-study.glb').stat().st_size<1000000}
(H/'focused-tests.json').write_text(json.dumps({'checks':checks,'passed':sum(checks.values()),'total':len(checks),'tailRootMaxDistance':max(ds),'runtimeAdmission':False},indent=2)+'\n');print(checks);assert all(checks.values())
