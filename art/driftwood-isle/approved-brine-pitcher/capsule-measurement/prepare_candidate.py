"""Preserve a deliberately rejected, ground-safe metadata alternative and its exact inputs.
No product writes. Run the real numeric-pose Vitest measurement before this file.
"""
from pathlib import Path
import json,hashlib,math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
measurement=json.loads((HERE/'measurement.json').read_text());native=json.loads((HERE.parent/'v3/native-source.json').read_text())
metadata=json.loads((HERE.parent/'v3/metadata.json').read_text());dims=metadata['bodies'][0]['dims'];proposal=measurement['diagnosticHorizontalProposal']
for key in ['bodyY','bodyHalfLen','bodyRadius','capsuleAxis']:dims[key]=proposal[key]
body=next(p for p in native['parts'] if p['name']=='body');points=set(tuple(body['positions'][i:i+3]) for i in range(0,len(body['positions']),3))
outside=[p for p in points if math.sqrt(p[0]**2+(p[1]-.7)**2+max(0,abs(p[2])-dims['bodyHalfLen'])**2)>dims['bodyRadius']+1e-9]
(HERE/'metadata-horizontal-rejected.json').write_text(json.dumps(metadata,indent=2)+'\n')
paths=[HERE/'measurement.json',ROOT/'test/brine-pitcher-capsule-measurement.test.ts',ROOT/'src/shards/driftwood-isle/generators/brinePitcherNativeClips.ts',HERE.parent/'v3/native-source.json',HERE.parent/'v3/metadata.json',HERE/'metadata-horizontal-rejected.json']
receipt={'schema':'wildshard.brine-pitcher.rejected-capsule.v1','accepted':False,'productBuilt':False,'rootLift':0,'sourceGeometryChanged':False,'groundSafeHorizontalCandidateBodyUniqueVertices':len(points),'uncoveredBodyUniqueVertices':len(outside),'uncoveredBodyFraction':len(outside)/len(points),'headRadiusRetainedDiagnostic':dims['headRadius'],'requiredFullHeadRadius':measurement['minimumFullMainHeadSphereRadius'],'reason':'Metadata-only full fit is infeasible under fixed bind and no ground penetration. This horizontal variant fixes the underground body but does not enclose the body; the retained head sphere does not enclose moving canopy. It is explicitly rejected.','files':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(HERE/'candidate-audit.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
