"""Explicit checkpoint only; does not grant runtime, collider or visual acceptance."""
from pathlib import Path
import hashlib,json
here=Path(__file__).resolve().parent;root=here.parents[2]
paths=[here/'build_pitcher_v2.py',here/'audit_source_v2.py',here/'make_review_v2.py']+[here/'v2'/x for x in ['native-source.json','metadata.json','payload.bin','brine-pitcher-v1.glb','construction.json','source-audit.json','cameras.json','review-captures.json']]+[root/p for p in ['src/shards/driftwood-isle/generators/brinePitcherNativeClips.ts','src/shards/driftwood-isle/generators/brinePitcherCombat.ts','src/shards/driftwood-isle/generators/brinePitcherNativePreview.ts','src/shards/driftwood-isle/behaviour/brine-pitcher.as']]
receipt={'schema':'wildshard.brine-pitcher.source-admission.v1','candidate':'brine-pitcher-native-v2','visualAcceptance':False,'runtimeAcceptance':False,'colliderAcceptance':False,'rootFlinch':'authored-pose','files':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(here/'v2/admission.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
