"""Pin the complete editable candidate, without copying or changing original inputs."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]; HERE=Path(__file__).resolve().parent
paths=['src/shards/driftwood-isle/generators/bellbackTuckedClips.ts','src/shards/driftwood-isle/generators/bellbackTuckedPreview.ts','src/shards/driftwood-isle/behaviour/bellback.as','src/shards/driftwood-isle/generators/tidalGiantsCombat.ts','scripts/bellback-tucked-admission.mjs','scripts/build-bellback-tucked-preview.mjs','vite/bellback-tucked-preview.config.ts','test/bellback-tucked-preview.test.ts','test/bellback-tucked-envelope.test.ts','test/bellback-tucked-world.test.ts','scripts/qa-bellback-tucked-observer.mjs','scripts/bellback-tucked-admission.test.mjs']
paths += [str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name in ['metadata.json','dimension-measurement.json','checkpoint.py','ANATOMY-CANDIDATE.md','support-endpoint-proof.json']]
base='art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/'
paths += [base+'build_bellback_v6_frame2.py',base+'bellback-study-v6-frame2.glb']+[base+'frame2-native/'+p for p in ['metadata.json','payload.bin','bellback-v6-native.json','mesh-map.json']]
rows=[{'path':p,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),'bytes':(ROOT/p).stat().st_size} for p in sorted(set(paths))]
admission={'schema':'wildshard.bellback.arena-candidate.v1','candidate':'V6-frame2-native8-motion3','visualAcceptance':False,'colliderAcceptance':False,'runtimeAcceptance':False,'rootFlinch':'authored-pose','files':{r['path']:r['sha256'] for r in rows}}
(HERE/'admission.json').write_text(json.dumps(admission,indent=2)+'\n')
p=HERE/'admission.json';rows.append({'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
(HERE/'closure.json').write_text(json.dumps({'schema':'wildshard.source-closure.v1','files':[r for r in rows if '/visual/' not in r['path'] and r['path'] not in ['src/shards/driftwood-isle/behaviour/bellback.as','src/shards/driftwood-isle/generators/tidalGiantsCombat.ts']],'referencedInputs':[r for r in rows if '/visual/' in r['path'] or r['path'] in ['src/shards/driftwood-isle/behaviour/bellback.as','src/shards/driftwood-isle/generators/tidalGiantsCombat.ts']]},indent=2)+'\n')
print('Closure',len(rows),'files',sum(r['bytes'] for r in rows),'bytes',hashlib.sha256((HERE/'closure.json').read_bytes()).hexdigest())
