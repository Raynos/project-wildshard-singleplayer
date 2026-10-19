import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
out=Path(__file__).parent
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a=root/'art/driftwood-isle/lowpoly-bellback'
checks=[];files={}
def check(label,ok):checks.append({'check':label,'pass':bool(ok)})
def record(p):files[str(p.relative_to(root))]={'sha256':h(p),'bytes':p.stat().st_size};return h(p)
ref=root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp';record(ref)
receipts={}
for v in [2,3]:
 for mode in ['hero','nine']:
  folder=root/f'tmp/bellback-complete-pass{v}/{mode}'
  p=folder/f'capture-{mode}.json';record(p);d=json.loads(p.read_text());receipts[v,mode]=d
  check(f'pass{v}/{mode} source',record(root/d['source'])==d['source_sha256'])
  check(f'pass{v}/{mode} capture script',record(a/f'complete-pass{v}/capture_review.py')==d['capture_script_sha256'])
  check(f'pass{v}/{mode} packaged receipt',p.read_bytes()==(a/f'complete-pass{v}/capture-{mode}.json').read_bytes())
  for s in d['shots']:
   im=folder/(s['name']+'.png');check(f'pass{v}/{mode}/{s["name"]} PNG',record(im)==s['image_sha256'] and im.stat().st_size==s['image_bytes'])
  check(f'pass{v}/{mode} GLB',record(folder/f'bellback-complete-pass{v}.glb')==record(a/f'complete-pass{v}/bellback-complete-pass{v}.glb'))
for mode in ['hero','nine']:
 x,y=receipts[2,mode],receipts[3,mode]
 check(f'{mode} lighting parity',x['lights']==y['lights'])
 for sx,sy in zip(x['shots'],y['shots']):
  check(f'{mode}/{sx["name"]} camera parity',all(sx[k]==sy[k] for k in ['name','camera','target','ortho_scale']))
check('capture script byte parity',(a/'complete-pass2/capture_review.py').read_bytes()==(a/'complete-pass3/capture_review.py').read_bytes())
for item in json.loads((a/'complete-pass3/closure.json').read_text())['files']:
 p=root/item['path'];check('package '+item['path'],record(p)==item['sha256'] and p.stat().st_size==item['bytes'])
record(a/'complete-pass3/closure.json')
report={'all_checks_pass':all(c['pass'] for c in checks),'checks':checks,'files':files,'limits':'Read-only receipt/source/hash verification, no rerender or independent GLB regeneration. Capture executes generator and renders scene directly; GLB export was not independently reimported. Static likeness only.'}
(out/'hash-closure.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'all_checks_pass':report['all_checks_pass'],'checks':len(checks),'files':len(files),'failures':[c for c in checks if not c['pass']]},indent=2))
