"""Read-only raw image/camera/source closure and bounded footprint."""
import hashlib,json,struct
from pathlib import Path
p=Path(__file__).resolve().parent
receipt=json.loads((p/'capture-receipts.json').read_text())
for row in receipt['files']:
 b=(p/row['path']).read_bytes();assert len(b)==row['bytes'];assert hashlib.sha256(b).hexdigest()==row['sha256']
views=[]
for variant in ['baseline','corrected']:
 d=p/'captures'/variant;images=list(d.glob('*.png'));assert len(images)==10
 for file in images:
  b=file.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';size=struct.unpack_from('>II',b,16);assert size==((780,960) if file.name=='color-front.png' else (496,700))
  views.append({'path':str(file.relative_to(p)),'dimensions':size,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
a=(p/'captures/baseline/cameras-complete-pass2.json').read_bytes();b=(p/'captures/corrected/cameras-complete-pass2.json').read_bytes();assert a==b
assert json.loads(a)['cameras']==json.loads((p.parent/'complete-pass2/cameras-complete-pass2.json').read_text())['cameras']
files=[f for f in p.rglob('*') if f.is_file()];size=sum(f.stat().st_size for f in files);assert size<=20*1024*1024;assert not list(p.rglob('*.blend'))
r={'passed':True,'rawPNGCount':20,'rawPNGBytesUnmodified':True,'identicalNineViewCameraReceipts':True,'matchesSelectedPass2Cameras':True,'footprintBytesAtVerification':size,'limitBytes':20*1024*1024,'images':views,'limits':'No self-score or runtime promotion. Camera/light/sample blocks reused directly from original sources; geometry closure separately decoded.'}
(p/'capture-verification.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='images'},indent=2))
