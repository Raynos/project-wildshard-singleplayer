import json,sys
from pathlib import Path
root=Path.cwd(); base=root/'art/driftwood-isle/approved-conch/complete-character-refinement'; out=root/'docs/reviews/conch-complete-character-refinement-independent'
result={}
for filename in ['build_conch_character_refinement.py','rejected-folded-breast-source.py']:
 text=(base/filename).read_text();text=text[:text.index('# Reference image')]
 sys.argv=['review','--','--out',str(out)]
 scope={'__name__':'__main__','__file__':str(base/filename)}
 exec(compile(text,str(base/filename),'exec'),scope)
 audits=scope['sweep_audit']; bad=[r for r in audits if r['opposedSideTriangles'] or r['opposedStripTrianglePairs']]
 result[filename]={'meshes':len(audits),'minimumOutwardRadialCosine':min(x['minimumOutwardRadialCosine'] for x in audits),'failedMeshes':bad,'matchesStoredReceipt':audits==json.loads((base/'source-sweep-check.json').read_text())['meshes'] if filename.startswith('build') else None}
(out/'source-fold-independent.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
