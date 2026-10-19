"""Bounded static topology/storage/source checks, explicitly not an art score."""
import hashlib,json
from pathlib import Path
here=Path(__file__).resolve().parent;root=here.parents[3];scratch=root/'tmp/bellback-complete-face-character/final'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
hero=json.loads((here/'capture-hero.json').read_text());nine=json.loads((here/'capture-nine.json').read_text())
pair=json.loads((here/'paired-captures.json').read_text())
assert hero['source_sha256']==nine['source_sha256']==sha(here/'build_bellback_complete.py')
assert hero['capture_script_sha256']==nine['capture_script_sha256']==sha(here/'capture_review.py')
assert hero['topology']==nine['topology']
assert all(x['nonmanifold_edges']==x['zero_area_faces']==0 for x in hero['topology'])
assert hero['bounds']['min'][2]==0
assert len(pair['pairs'])==10
assert sha(here/'bellback-complete-face-character.glb')==sha(scratch/'hero/bellback-complete-face-character.glb')==sha(scratch/'nine/bellback-complete-face-character.glb')
assert (here/'bellback-complete-face-character.glb').stat().st_size<=1000000
for p in here.glob('*.webp'):assert p.stat().st_size <= (500000 if 'board' in p.name else 250000),p
report={'status':'Passed bounded static construction checks; no art score or physics acceptance','source_sha256':hero['source_sha256'],'glb_sha256':sha(here/'bellback-complete-face-character.glb'),'byte_identical_hero_nine_exports':True,'meshes':len(hero['topology']),'nonmanifold_edges':0,'zero_area_faces':0,'ground_z_min':0,'matched_pairs':10,'all_images_within_storage_limits':True,'raw_capture_directory':'tmp/bellback-complete-face-character','builder_visual_inspection':'Actual hero and nine actual full frames inspected; independent review required','render_logs':[{'path':str(p.relative_to(root)),'sha256':sha(p)} for p in sorted(scratch.glob('*.log'))]}
(here/'structural-audit.json').write_text(json.dumps(report,indent=2)+'\n')
paths=[p for p in here.rglob('*') if p.is_file() and p!=here/'closure.json' and '__pycache__' not in p.parts]
(here/'closure.json').write_text(json.dumps({'status':'Complete static evidence; independent review pending','files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(paths)]},indent=2)+'\n')
print(json.dumps(report,indent=2))
