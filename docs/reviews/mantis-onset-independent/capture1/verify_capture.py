import json,hashlib
from pathlib import Path
out=Path(__file__).parent
base=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate5');tmp=Path('tmp/mantis-onset-capture1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(root,files):
 return [str(root/p) for p,v in files.items() if not (root/p).is_file() or sha(root/p)!=v['sha256'] or (root/p).stat().st_size!=v['bytes']]
c=json.loads((base/'capture-closure.json').read_text()); result={'captureClosureSha256':sha(base/'capture-closure.json'),'captureFileCount':len(c['files']),'captureMismatches':verify(Path('.'),c['files']),'inventories':{}}
for kind,folder in [('host','dist'),('native','native')]:
 before=json.loads((tmp/f'{kind}-inventory-before.json').read_text());after=json.loads((tmp/f'{kind}-inventory-after.json').read_text());result['inventories'][kind]={'count':len(before),'beforeEqualsAfter':before==after,'currentMismatches':verify(tmp/folder,after)}
p=json.loads((base/'evidence/provenance.json').read_text()); result['provenanceMismatches']=[]
for name,v in p.items():
 original=Path(v['original']);expected=v.get('originalSha256',v.get('sha256'))
 if sha(original)!=expected:result['provenanceMismatches'].append(name)
v=p['original-video'];result['video']={'sha256':sha(Path(v['original'])),'bytes':Path(v['original']).stat().st_size}
t=json.loads((tmp/'qa/render-trace.json').read_text());r=json.loads((tmp/'qa/report.json').read_text());result['harnessChecks']=r['checks'];result['observedOnsets']=[]
for i in [70,94]:
 row=t[i];result['observedOnsets'].append({k:row[k] for k in ['frame','gameTime','posePhase','poseClock','strike','stage','bones']})
result['defenseHealthValues']=sorted(set(s['playerHealth']['health'] for s in t if s['phase']=='approach-defense'))
result['detailFrames']={'368':'HUD74 actual-active but observed windup','369':'HUD75 first observed active clock0','433':'HUD98 actual-active but observed windup','434':'HUD99 first observed active clock0','1235':'HUD390 early-death penetration, hit flash masks contact','1693':'HUD581 Retry','3805':'HUD1325 final Retry','4065':'reload reentry'}
result['visualSheetHashes']={p.name:sha(p) for p in Path('tmp/mantis-onset-independent-visual').glob('*sheet*.jpg')}
result['visualSheetHashes'].update({p.name:sha(p) for p in Path('tmp/mantis-onset-independent-visual').glob('all-*.jpg')})
(out/'capture-verification.json').write_text(json.dumps(result,indent=2)+'\n');print({k:v for k,v in result.items() if k not in ['observedOnsets','visualSheetHashes']})
