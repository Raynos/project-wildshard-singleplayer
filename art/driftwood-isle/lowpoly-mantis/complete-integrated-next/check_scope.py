"""Record complete-model changes and preserve all pre-existing pinned evidence."""
from pathlib import Path
import hashlib,json,math
H=Path(__file__).resolve().parent;ROOT=H.parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for p,d in json.loads((H/'input-pins.json').read_text()).items():assert sha(ROOT/p)==d,p
b=json.loads((H.parent/'complete-proportion-study/mantis-mesh-complete-proportion-study.json').read_text())
c=json.loads((H/'mantis-mesh-complete-integrated-next.json').read_text())
bp={p['name']:p for p in b['parts']};cp={p['name']:p for p in c['parts']}
changes=[]
for n,p in cp.items():
 old=bp.get(n)
 if old is None:changes.append(dict(name=n,newPart=True));continue
 changes.append(dict(name=n,changedVertices=p['vertices']!=old['vertices'],changedPalette=p['colors']!=old['colors'],changedFaces=p['faces']!=old['faces']))
assert set(bp)<=set(cp)
assert sum(bool(p.get('changedVertices')) for p in changes)>60
for part in c['parts']:
 assert all(math.isfinite(x) for v in part['vertices'] for x in v)
 assert all(len(f)==3 for f in part['faces'])
refs=ROOT.parent/'wildshard-review-site-current/source-evidence/approved-nine-qa/originals'
originals={name:dict(sha256=sha(refs/name),bytes=(refs/name).stat().st_size) for name in ['mantisExplorerGen.png','mantisWorldGen.png','corrections/mantisWorldCorrectedGen-v2.png']}
report=dict(status='PASS_COMPLETE_SOURCE_SCOPE',baselineParts=len(bp),candidateParts=len(cp),changedVertexParts=sum(bool(p.get('changedVertices')) for p in changes),newParts=sorted(set(cp)-set(bp)),changes=changes,approvedContextOriginals=originals,predecessorPinsVerified=True,sourceOnly=True,gameRuntimeChanges=False,score=None,limitations='Original hero authoritative. AI context hidden angles are approximate, not measured anatomy. No native animation/contact acceptance.')
(H/'scope-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['changes','approvedContextOriginals']},indent=2))
