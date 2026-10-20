"""Whole-character change inventory and immutable native rig/original input pins."""
from pathlib import Path
import hashlib,json
H=Path(__file__).resolve().parent;R=H.parents[3];B=H.parent/'complete-integrated-next'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p,d in json.loads((H/'input-pins.json').read_text()).items():assert sha(R/p)==d,p
b={p['name']:p for p in json.loads((B/'mantis-mesh-complete-integrated-next.json').read_text())['parts']}
c={p['name']:p for p in json.loads((H/'mantis-mesh-complete-sculpted-anatomy.json').read_text())['parts']}
assert set(b)<=set(c)
old=json.loads((B/'authored-mapping.json').read_text());new=json.loads((H/'authored-mapping.json').read_text())
assert old['bones']==new['bones']
assert all(p==next(q for q in new['parts'] if q['name']==p['name']) for p in old['parts'])
changes=[dict(name=n,newPart=n not in b,changedVertices=n not in b or b[n]['vertices']!=p['vertices'],changedFaces=n not in b or b[n]['faces']!=p['faces']) for n,p in c.items()]
refs={n:dict(sha256=sha(R/'art/driftwood-isle/concepts/approved-nine-2026-10-19'/n),bytes=(R/'art/driftwood-isle/concepts/approved-nine-2026-10-19'/n).stat().st_size) for n in ['mantisExplorerGen.png','mantisWorldGen.png','corrections/mantisWorldCorrectedGen-v2.png']}
report=dict(status='PASS_COMPLETE_STATIC_SCOPE',baselineParts=len(b),candidateParts=len(c),changedVertexParts=sum(p['changedVertices'] for p in changes),newParts=[n for n in c if n not in b],changes=changes,exactNative22RigPreserved=True,existingPartOwnershipPreserved=True,approvedContextOriginals=refs,originalHeroSha256='601a244962deabc489604604afe2d0911096b95098ced82611cea13cbb3c23cb',inputPinsVerified=True,runtimeChanges=False,score=None,limits='Original hero authoritative; generated hidden surfaces approximate. Exact source rest map does not establish animation, contact or visual acceptance.')
(H/'scope-audit.json').write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items() if k not in ['changes','approvedContextOriginals']})
