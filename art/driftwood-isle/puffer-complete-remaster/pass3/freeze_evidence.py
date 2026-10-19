"""Freeze complete output and real-capture hashes without changing candidates."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image
H=Path(sys.argv[1]).resolve();ROOT=next(p for p in H.parents if (p/'AGENTS.md').exists());R=ROOT/sys.argv[2]
def record(p):return {'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
r=json.loads((R/'capture-receipt.json').read_text());checks={};native=json.loads((H/'construction-receipt.json').read_text());checks['twentyActualCaptures']=len(r['captures'])==20
checks['frozenCandidatePin']=r['nativePins']['pass3']['sha256']==native['candidatePin']['sha256']
for c in r['captures']:
 p=R/c['filename'];checks[c['filename']+' hash']=hashlib.sha256(p.read_bytes()).hexdigest()==c['sha256'];checks[c['filename']+' size']=Image.open(p).size==(600,740)
for view in ['hero']+[f'{i:02d}-'+s for i,s in enumerate(['front','left','right','back','top','elevated-front','elevated-left','elevated-right','elevated-back'],1)]:
 a,b=[c for c in r['captures']if c['view']==view];checks[view+' matched']=all(a[k]==b[k]for k in ['camera','target','scale'])
checks['previewCaps']=all(p.stat().st_size< (500000 if any(s in p.name for s in ['board','sheet'])else 250000)for p in H.glob('*.webp'))
checks['glbCap']=(H/'pass3-study.glb').stat().st_size<1000000
checks['rawPublishedReceiptExact']=(H/'capture-receipt.json').read_bytes()==(R/'capture-receipt.json').read_bytes()
out={'status':'Known construction failure preserved; no quality increment','checks':checks,'passed':sum(checks.values()),'total':len(checks),'outputs':[record(p)for p in sorted(H.iterdir())if p.is_file()and p.name!='output-closure.json'],'raw':[record(p)for p in sorted(R.iterdir())if p.is_file()],'runtimeAdmission':False}
(H/'output-closure.json').write_text(json.dumps(out,indent=2)+'\n');assert all(checks.values());print(out['passed'],out['total'])
