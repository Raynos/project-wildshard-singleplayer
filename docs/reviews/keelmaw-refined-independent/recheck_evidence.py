"""Read-only package audits, redirecting all audit products into this review folder."""
from pathlib import Path
from contextlib import redirect_stdout
import hashlib, io, json, runpy, sys
from PIL import Image
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
PACKAGE=ROOT/'art/driftwood-isle/approved-keelmaw/complete-character-refined'
RAW=ROOT/'tmp/keelmaw-complete-refined'
sys.dont_write_bytecode=True

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def snapshot(): return {str(p.relative_to(ROOT)):sha(p) for d in [PACKAGE,RAW/'final',RAW/'baseline'] for p in d.rglob('*') if p.is_file()}
before=snapshot()
original_write=Path.write_text
redirected=[]
def run_audit(script, folder=None, filename=None):
    source=PACKAGE/script
    target=(folder/filename if folder else PACKAGE/'verification.json').resolve()
    dest=OUT/(('candidate-' if folder==RAW/'final' else 'baseline-')+filename if folder else 'delivery-verification.json')
    def safe_write(p,data,*args,**kwargs):
        if p.resolve()!=target: raise AssertionError('Unexpected write: '+str(p))
        redirected.append({'script':script,'original':str(p.relative_to(ROOT)),'output':dest.name})
        return original_write(dest,data,*args,**kwargs)
    Path.write_text=safe_write
    argv=sys.argv
    sys.argv=[str(source)]+([str(folder)] if folder else [])
    capture=io.StringIO()
    try:
        with redirect_stdout(capture): runpy.run_path(str(source),run_name='__main__')
    finally:
        Path.write_text=original_write
        sys.argv=argv
    return json.loads(dest.read_text())
framing={}
for role,folder in [('candidate',RAW/'final'),('baseline',RAW/'baseline')]:
    result=run_audit('audit_framing.py',folder,'verified-framing.json')
    assert result==json.loads((folder/'verified-framing.json').read_text())
    framing[role]={'freshRecomputationMatchesSaved':True,'minimumMarginPixels':min(v['minimumMarginPixels'] for v in result['views']),'allVerticesInside':all(v['allVerticesInside'] for v in result['views'])}
audit=run_audit('audit_source.py',RAW/'final','source-audit.json')
assert audit==json.loads((RAW/'final/source-audit.json').read_text())
verification=run_audit('verify_delivery.py')
receipt=json.loads((PACKAGE/'review/capture-receipt.json').read_text())
a=json.loads((RAW/'final/cameras.json').read_text());b=json.loads((RAW/'baseline/cameras.json').read_text())
strip=lambda rows:[{k:v for k,v in row.items() if k!='framingNDC'} for row in rows]
assert strip(a)==strip(b)
assert len(receipt['rawPins'])==20
for p in receipt['rawPins']:
    path=ROOT/p['path'];assert sha(path)==p['sha256']
    with Image.open(path) as im: assert list(im.size)==p['dimensions']==[600,720]
for p in receipt['referencePins']:assert sha(ROOT/p['path'])==p['sha256']
assert before==snapshot(),'Source/evidence mutated during checks'
report={'status':'PASS','frozenInputsUnchanged':True,'rawImagePinsMatched':20,'referencePinsMatched':len(receipt['referencePins']),'rawResolution':[600,720],'pairedCameraSettingsExactlyEqualExceptGeometryBounds':True,'framing':framing,'candidateSourceAuditFreshAndExact':True,'verifyDeliveryPassed':True,'auditScripts':{s:sha(PACKAGE/s) for s in ['audit_framing.py','audit_source.py','verify_delivery.py']},'redirectedWrites':redirected,'limits':['No Blender rerender or geometry regeneration performed by this reviewer.','verify_delivery.py verifies producer/model/capture pins and contracts, not a fresh renderer reproducibility trial.','The existing focused runtime consumer test was not rerun; the delivery verifier records an earlier pass.','All-vertex framing is recomputed from native positions and the recorded camera rig, not recovered from PNG pixels.','Historical numerical review scores were not read. The delivery verifier hashes a prior report without displaying its content.']}
(OUT/'evidence-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
