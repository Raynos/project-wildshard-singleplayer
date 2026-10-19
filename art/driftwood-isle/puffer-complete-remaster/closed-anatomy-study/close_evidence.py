"""Freeze exact actual captures, matched setup and complete source hashes."""
import hashlib,json
from pathlib import Path
from PIL import Image
H=Path(__file__).resolve().parent;D=H/'captures-final';r=json.loads((D/'capture-receipt.json').read_text());checks={};files=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks['twenty actual captures']=len(r['captures'])==20
checks['renderer hash exact']=r['scriptSha256']==sha(H/'render_matched.py')
for label,path in [('pass2',H.parent/'pass2/pass2-native.json'),('closed-anatomy',H/'closed-anatomy-native.json')]:
 checks[label+' source exact']=r['nativePins'][label]['sha256']==sha(path)
 cs=[c for c in r['captures'] if c['variant']==label];checks[label+' hero and nine']=len(cs)==10 and len({c['view'] for c in cs})==10
 for c in cs:
  wp=D/c['filename'];png=wp.with_suffix('.png')
  checks[label+' '+c['view']+' preview hash']=sha(wp)==c['sha256']
  checks[label+' '+c['view']+' full PNG retained']=png.exists() and Image.open(png).size==(600,740)
  checks[label+' '+c['view']+' preview cap']=wp.stat().st_size<250000 and Image.open(wp).size==(600,740)
  for p in [wp,png]:files.append({'path':str(p.relative_to(H)),'bytes':p.stat().st_size,'sha256':sha(p)})
for view in {c['view'] for c in r['captures']}:
 cs=[c for c in r['captures'] if c['view']==view];checks[view+' matched setup']=len(cs)==2 and all(cs[0][k]==cs[1][k] for k in ['camera','target','scale'])
for name in ['build_candidate.py','closed-anatomy-native.json','closed-anatomy-study.glb','construction-receipt.json','geometry-audit.json','glb-roundtrip-audit.json','export_glb.py','audit_geometry.py','audit_glb_roundtrip.py','render_matched.py','save_preview.py','audit_crossings.py','crossing-audit.json','lossless-png-receipt.json']:
 p=H/name;files.append({'path':name,'bytes':p.stat().st_size,'sha256':sha(p)})
size=sum(p.stat().st_size for p in H.rglob('*') if p.is_file());checks['owned outputs below 15MiB']=size<15*1024**2
out={'checks':checks,'passed':sum(checks.values()),'total':len(checks),'files':files,'ownedBytesBeforeClosure':size,'noScore':True,'runtimeAdmission':False,'rawPNGOriginalBytesRetained':False,'losslessPNGPixelIdentityVerified':True,'byteProvenanceLimitation':'Blender PNGs were losslessly re-encoded with exact decoded pixel, mode and size equality. Original encoded byte copies and pre-encoding byte hashes were not retained. lossless-png-receipt.json preserves pre/post sizes and decoded pixel hashes. No rerender substituted history.','captureConditions':'600x740 Cycles24 no denoising AgX, exact retained pass2 cameras and three area lights; both complete native scenes in same render run'}
(H/'output-closure.json').write_text(json.dumps(out,indent=2)+'\n');print(out['passed'],out['total'],size);assert all(checks.values())
