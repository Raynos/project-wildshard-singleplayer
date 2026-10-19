"""Focused frozen-candidate evidence checks; never a runtime gate waiver."""
import hashlib,json
from pathlib import Path
H=Path(__file__).resolve().parent;A=H.parents[1]
n=json.loads((H/'pass2-native.json').read_text());b=json.loads((A/'approved-puffer/unaccepted-native-v71.json').read_text());r=json.loads((H/'construction-receipt.json').read_text());t=json.loads((H/'topology-preflight-failure.json').read_text());f=json.loads((H/'fin-root-audit.json').read_text())
checks={
 'candidateHash':hashlib.sha256((H/'pass2-native.json').read_bytes()).hexdigest()==r['candidatePin']['sha256'],
 'eightBonesExact':len(n['bones'])==8 and n['bones']==b['bones'],
 'sevenParts':len(n['parts'])==7,
 'headExact':n['parts'][1]==b['parts'][1],
 'fourFinPartsExact':n['parts'][3:]==b['parts'][3:],
 'browBeakGeometryExact':n['parts'][0]['positions'][1022*9:1426*9]==b['parts'][0]['positions'][1022*9:1426*9],
 'browBeakColorsExact':n['parts'][0]['colorsLinear'][1022*9:1426*9]==b['parts'][0]['colorsLinear'][1022*9:1426*9],
 'mainHullClosedOriented':t['sources']['pass2']['parts'][0]['components'][0]['closedOriented'],
 'meaningfulVolumeChange':.10<r['volumeChangeFraction']<.25,
 'allEightSpikeSamplesBuried':len(r['spikes'])==8 and all(max(s['rootSampleClearance'])<=-.004 for s in r['spikes']),
 'tailSamplesBuried':r['tailRootMaximumSampledDistance']<0,
 'allFourFinSamplesBuried':len(f)==4 and all(s['allSampledInside'] for s in f),
 'inheritedOpenInlaysExplicit':sorted(c['triangles'] for p in t['sources']['pass2']['parts'] for c in p['components'] if not c['closedOriented'])==[2,2,2,7],
 'noSelfScore':r['qualityScore'] is None,
 'notRuntimeAdmitted':r['runtimeAdmitted'] is False}
result={'checks':checks,'passed':sum(checks.values()),'total':len(checks),'runtimeAdmission':False}
(H/'focused-tests.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));assert all(checks.values())
