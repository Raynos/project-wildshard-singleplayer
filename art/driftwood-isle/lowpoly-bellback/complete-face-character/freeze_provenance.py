"""Freeze all retained actual captures and exact source/camera/light identities."""
import hashlib,json
from pathlib import Path
h=Path(__file__).resolve().parent;root=h.parents[3];tmp=root/'tmp/bellback-complete-face-character';base=root/'tmp/bellback-complete-pass3'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def canonical(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
records=[]
for label,folder in [('failed-initial',tmp),('final',tmp/'final'),('retained-pass3',base)]:
 for kind in ['hero','nine']:
  receipt=folder/kind/f'capture-{kind}.json';r=json.loads(receipt.read_text())
  for s in r['shots']:
   p=folder/kind/(s['name']+'.png');assert sha(p)==s['image_sha256'] and p.stat().st_size==s['image_bytes']
   records.append(dict(set=label,view=s['name'],path=str(p.relative_to(root)),bytes=p.stat().st_size,sha256=sha(p),source_sha256=r['source_sha256'],camera_sha256=canonical({k:s[k] for k in ['camera','target','ortho_scale']}),lights_sha256=canonical(r['lights']),capture_script_sha256=r['capture_script_sha256']))
initial=tmp/'failed-initial/build_bellback_complete.py';final=h/'build_bellback_complete.py'
assert all(r['source_sha256']==sha(initial) for r in records if r['set']=='failed-initial')
assert all(r['source_sha256']==sha(final) for r in records if r['set']=='final')
for view in [r['view'] for r in records if r['set']=='final']:
 pair=[r for r in records if r['view']==view]
 for key in ['camera_sha256','lights_sha256','capture_script_sha256']:assert len({r[key] for r in pair})==1
paths=[p for p in tmp.rglob('*') if p.is_file()]
report=dict(status='PASS: raw bytes preserved; all three sets have identical camera/light/capture-script hashes',raw_capture_count=len(records),captures=records,retained_initial_source_sha256=sha(initial),final_source_sha256=sha(final),final_glb_sha256=sha(h/'bellback-complete-face-character.glb'),original_reference_sha256=sha(root/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp'),owned_scratch_bytes=sum(p.stat().st_size for p in paths),retained_failed_and_render_logs=[dict(path=str(p.relative_to(root)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(tmp.rglob('*.log'))])
(h/'provenance.json').write_text(json.dumps(report,indent=2)+'\n');print(report['status'])
