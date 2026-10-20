"""Verify frozen complete-model delivery without scoring or promoting it."""
from pathlib import Path
import hashlib,json
H=Path(__file__).resolve().parent;R=H.parents[3];RAW=R/'tmp/mantis-complete-sculpted-anatomy'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
e=json.loads((H/'evidence.json').read_text());c=json.loads((H/'closure.json').read_text())
for p,d in json.loads((H/'input-pins.json').read_text()).items():assert sha(R/p)==d,p
for p,d in e['files'].items():assert sha(R/p)==d,p
for f in e['rawFrames']:assert sha(R/f['path'])==f['sha256'],f['path']
for n,row in c['files'].items():assert sha(H/n)==row['sha256'],n
assert e['frameCount']==20 and e['pairedCamerasAndSettings']
assert all(f['pixelBounds'][0]>0 and f['pixelBounds'][1]>0 and f['pixelBounds'][2]<638 and f['pixelBounds'][3]<900 for f in e['projectionFits'])
g=json.loads((H/'geometry-audit.json').read_text())['candidate'];n=json.loads((H/'normal-audit.json').read_text())
assert not g['facetDeviations'] and not g['opposedTriangles']
assert all(not p['nonAdjacentSelfIntersections'] for p in g['parts'])
assert not json.loads((H/'intersection-audit.json').read_text())['candidate']['nonAdjacentWithinPartIntersections']
assert not n['facetNormalDeviations'] and not n['opposedTriangles'] and n['minimumNormalCosine']>.999999
scope=json.loads((H/'scope-audit.json').read_text());assert scope['exactNative22RigPreserved'] and scope['existingPartOwnershipPreserved']
logs=json.loads((H/'pre-render-test-receipts.json').read_text())
for name,row in logs.items():
 if isinstance(row,dict):assert sha(R/row['path'])==row['sha256'],name
assert 'Tests  4 passed (4)' in (RAW/'native-consumer-focused-test.log').read_text()
assert 'Ran 7 tests' in (RAW/'native-python-test.log').read_text() and '\nOK\n' in (RAW/'native-python-test.log').read_text()
files=[p for p in H.rglob('*') if p.is_file() and '__pycache__' not in p.parts]
binary=[p for p in files if p.suffix in ['.glb','.bin','.webp','.jpg','.png']]
for p in files:
 if p.suffix=='.json':assert p.stat().st_size<=5_000_000,p
 elif p.suffix in ['.glb','.bin']:assert p.stat().st_size<=1_000_000,p
 elif p.suffix in ['.webp','.jpg','.png']:assert p.stat().st_size<=(500000 if 'board' in p.name else 250000),p
assert sum(p.stat().st_size for p in binary)<=2*1024*1024
raw_bytes=sum(p.stat().st_size for p in RAW.rglob('*') if p.is_file())
assert raw_bytes<=30*1024*1024
result=dict(status='PASS_FINAL_STATIC_DELIVERY',sourceParts=g['meshObjects'],triangles=g['triangles'],nativeBones=c['stats']['bones'],captures=20,geometryClosure=True,exactNativeConsumer=True,exactRetainedRigAndExistingOwnership=True,inputPinsVerified=True,newBinaryBytes=sum(p.stat().st_size for p in binary),rawBytes=raw_bytes,producerSha256=sha(H/'build_mantis_complete.py'),glbSha256=sha(H/'mantis-study-complete-sculpted-anatomy.glb'),nativeSha256=sha(H/'mantis-native.json'),visualScore=None,animationAcceptance=False,runtimePromotion=False,lint='Repository ignores art-folder sources; no lint acceptance claim')
(H/'final-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
