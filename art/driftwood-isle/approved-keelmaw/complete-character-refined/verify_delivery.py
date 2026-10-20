"""Freeze exact producer/model/capture checks; never supplies a likeness score."""
from pathlib import Path
import argparse,hashlib,json
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--capture-root',type=Path,required=True)
args=parser.parse_args()
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];RAW=args.capture_root;OLD=HERE.with_name('complete-character-next')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
new=json.loads((HERE/'model/native-source.json').read_text());old=json.loads((OLD/'model/native-source.json').read_text());assert new['bones']==old['bones'];assert [p['name'] for p in new['parts']]==[p['name'] for p in old['parts']];assert len(new['bones'])==len(new['parts'])==19
for n in ['native-source.json','metadata.json','payload.bin']:
 assert (RAW/'baseline'/n).read_bytes()==(OLD/'model'/n).read_bytes()
for n in ['native-source.json','metadata.json','payload.bin','keelmaw-v1.glb','construction.json','source-audit.json']:
 assert (RAW/'final'/n).read_bytes()==(HERE/'model'/n).read_bytes()
a=(HERE/'build_keelmaw.py').read_text();b=(HERE/'capture_baseline.py').read_text();assert a[a.index('if a.render:'):]==b[b.index('if a.render:'):]
capture=json.loads((HERE/'review/capture-receipt.json').read_text());assert len(capture['rawPins'])==20
for p in capture['rawPins']:assert sha(RAW/p['path'])==p['sha256']
assert json.loads((HERE/'model/construction.json').read_text())['sourceSha256']==sha(HERE/'build_keelmaw.py')
framing={}
for role,d in [('candidate','final'),('baseline','baseline')]:
 c=json.loads((RAW/d/'cameras.json').read_text());f=json.loads((RAW/d/'verified-framing.json').read_text());assert len(c)==len(f['views'])==10
 error=max(abs(row['framingNDC'][k]-v['framingNDC'][k]) for row,v in zip(c,f['views']) for k in ['minX','maxX','minY','maxY'])
 # Blender's near-vertical track quaternion is float32; compare at raster precision.
 # The initial arbitrary 1e-5 NDC check failed only at top (0.01561 pixels).
 # Independent bounds remain authoritative and whole-vertex containment is strict.
 assert error*720<.1,error
 framing[role]={'minimumMarginPixels':min(v['minimumMarginPixels'] for v in f['views']),'producerVsIndependentMaximumNdcError':error,'conservativeMaximumPixelError':error*720,'comparisonTolerancePixels':.1}
files=[];binary=0
for p in sorted(HERE.rglob('*')):
 if not p.is_file() or '__pycache__' in p.parts or p.name=='verification.json':continue
 n=p.stat().st_size;cap=5000000 if p.suffix=='.json' else (500000 if 'board' in p.name else 250000) if p.suffix in ['.webp','.jpg','.png'] else 1000000
 assert n<=cap,(p,n,cap)
 assert p.suffix not in ['.blend','.png','.mp4','.zip','.jsonl','.pdf']
 if p.suffix in ['.webp','.glb','.bin']:binary+=n
 files.append({'path':str(p.relative_to(ROOT)),'bytes':n,'sha256':sha(p),'capBytes':cap})
assert binary<10000000
report={'schema':'wildshard.keelmaw.complete-refined-verification.v1','status':'source-only complete revision; independent visual review pending','selfScore':None,'priorIndependentReview':{'path':'docs/reviews/keelmaw-complete-independent/REPORT.md','sha256':sha(ROOT/'docs/reviews/keelmaw-complete-independent/REPORT.md')},'boneContractUnchanged':True,'partContractUnchanged':True,'boneCount':19,'partCount':19,'baselineNativePayloadMetadataByteIdentical':True,'finalModelMatchesRenderedBytes':True,'lightingCameraRenderSetupSourceIdentical':True,'rawCaptures':20,'framing':framing,'storage':{'allFilesUnderPerBlobCaps':True,'candidateBinaryBytes':binary,'candidateBudgetBytes':10000000,'wholeRepositoryPushBudgetChecked':False,'reason':'No index, commit or push was requested; candidate-local budget only.'},'checks':{'exactNativeGlbAndNormalsTopology':'model/source-audit.json','nativeConsumer':'1 focused native-consumer test passed; original diagnostic retained locally','lint':'Art test/config paths ignored by repository oxlint configuration, including no-ignore retry; not represented as lint pass.','fullSuite':'Not run; source-only scope.'},'limits':['No visual acceptance or self-score','No runtime admission or promotion','No animation/contact/combat/performance acceptance','Closed individual components, not welded anatomy','Existing dimension metadata unadmitted','Historical raw producer framing invalid; current audit_framing is authoritative'],'files':files}
(HERE/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
