"""Read-only inputs; write verification only beside this independent review."""
import hashlib,json,struct
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
H=ROOT/'art/driftwood-isle/puffer-complete-remaster/next-complete-assembly'
O=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((H/n).read_text())
checks=[]
def check(label,actual,expected):checks.append({'check':label,'passed':actual==expected,'actual':actual,'expected':expected})
c=read('capture-receipt.json'); closure=read('output-closure.json')
for row in closure['sourceFiles']:
 p=H/row['path'];check('closure hash '+row['path'],sha(p),row['sha256']);check('closure bytes '+row['path'],p.stat().st_size,row['bytes'])
for label,row in c['nativePins'].items():check('native '+label,sha(ROOT/row['path']),row['sha256'])
check('current renderer hash',sha(H/'render_matched.py'),c['scriptSha256'])
for r in c['captures']:
 p=ROOT/r['rawPath'];check('raw '+p.name,sha(p),r['rawSha256']);check('raw bytes '+p.name,p.stat().st_size,r['rawBytes'])
 with Image.open(p) as im:check('resolution '+p.name,list(im.size),c['resolution'])
 check('preview '+r['filename'],sha(H/r['filename']),r['sha256'])
for view in {r['view']for r in c['captures']}:
 a,b=[r for r in c['captures']if r['view']==view]
 for k in ['camera','target','scale']:check('matched '+view+' '+k,a[k],b[k])
for r in read('preservation-audit.json')['dependencyPins']:check('dependency '+r['path'],sha(ROOT/r['path']),r['sha256'])
for rel,pin in read('construction-receipt.json')['sourcePins'].items():check('construction source '+rel,sha(ROOT/'art/driftwood-isle'/rel),pin)
for rel,pin in read('geometry-audit.json')['sourcePins'].items():check('geometry source '+rel,sha(H/rel),pin)
n=read('candidate-native.json');pre=read('prepaint-native.json')
check('part count',len(n['parts']),7);check('bone count',len(n['bones']),8);check('native triangles',sum(len(p['positions'])//9 for p in n['parts']),3424)
check('prepaint positions equal',all(a['positions']==b['positions']for a,b in zip(n['parts'],pre['parts'])),True)
raw=(H/'candidate.glb').read_bytes();size=struct.unpack_from('<I',raw,12)[0];glb=json.loads(raw[20:20+size]);check('GLB single-sided',all(not m.get('doubleSided',False)for m in glb['materials']),True)
report={'passed':sum(r['passed']for r in checks),'total':len(checks),'checks':checks,'geometryAuditRecomputed':False,'geometryAuditScope':'Inspected receipts and auditor source; independently recomputed listed simple structural and position equality checks only. No crossing, manifold, cap containment or preservation audit rerun.','initialRendererLimitation':'The first selected hero used a different renderer hash. Its preserved raw hash and recovery receipt match; original renderer bytes are not present in this package, so exact original-vs-resumed code equivalence is not independently verified.'}
(O/'evidence-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(report['passed'],report['total']);print([r for r in checks if not r['passed']])
