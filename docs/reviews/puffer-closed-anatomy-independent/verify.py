"""Read-only evidence verification; writes only owned review JSON."""
import hashlib,json
from decimal import Decimal
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
BASE=ROOT/'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study'
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
checks={}
closure=read(BASE/'output-closure.json')
for row in closure['files']:
 p=BASE/row['path'];checks['closure '+row['path']]=sha(p)==row['sha256'] and p.stat().st_size==row['bytes']
receipt=read(BASE/'captures-final/capture-receipt.json')
for label,pin in receipt['nativePins'].items(): checks['native '+label]=sha(ROOT/pin['path'])==pin['sha256']
checks['renderer']=sha(BASE/'render_matched.py')==receipt['scriptSha256']
for pin in read(BASE/'construction-receipt.json')['sourcePins']:checks['construction '+pin['path']]=sha(ROOT/pin['path'])==pin['sha256']
rows=receipt['captures'];checks['20 captures']=len(rows)==20
for row in rows:
 checks['preview '+row['filename']]=sha(BASE/'captures-final'/row['filename'])==row['sha256']
 im=Image.open(BASE/'captures-final'/row['filename'].replace('.webp','.png'))
 checks['resolution '+row['filename']]=list(im.size)==receipt['resolution']
for view in {r['view'] for r in rows}:
 pair=[r for r in rows if r['view']==view]
 checks['matched camera '+view]=len(pair)==2 and all(pair[0][k]==pair[1][k] for k in ['camera','target','scale'])
for row in read(BASE/'lossless-png-receipt.json'):
 im=Image.open(BASE/row['file'])
 checks['decoded '+row['file']]=hashlib.sha256(im.tobytes()).hexdigest()==row['decodedPixelSha256']
for row in read(BASE/'checkpoint-normalization.json')['changes']:
 checks['normalized log '+row['path']]=sha(BASE/row['path'])==row['sha256']
 original=ROOT/'tmp/puffer-closed-checkpoint-originals'/row['path']
 checks['original log '+row['path']]=original.exists() and sha(original)==row['originalSha256']
weights=read(HERE/'rubric.json')['weights']
score=read(HERE/'candidate-frozen.json')['scores']
total=sum(Decimal(score[k])*Decimal(str(weights[k])) for k in weights)
checks['candidate exact arithmetic']=str(total)==read(HERE/'candidate-frozen.json')['weightedExact']
out={'checks':checks,'passed':sum(checks.values()),'total':len(checks),'candidateExact':str(total),'originalPNGBytesRetained':False,'preEncodingPNGByteHashesRetained':False,'provenanceLimit':'Current decoded pixels match retained pixel hashes. Original compressed bytes were not retained; pre/post equivalence cannot be independently reconstructed from those original bytes. No rerender performed.'}
(HERE/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'passed':out['passed'],'total':out['total'],'failed':[k for k,v in checks.items() if not v]},indent=2))
