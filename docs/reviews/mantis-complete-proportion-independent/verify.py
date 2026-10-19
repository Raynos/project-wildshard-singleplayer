"""Read-only frozen-evidence verifier. Writes only this review's closure.json.
Geometry math is AST-extracted from inspected diagnostic functions, never imports
or executes their top-level producer code. No Blender, renderer or native adapter.
"""
import ast, hashlib, json, math, struct
from collections import Counter
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE=ROOT/'art/driftwood-isle/lowpoly-mantis'
STUDY=BASE/'complete-proportion-study'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def functions(path,names,env):
 tree=ast.parse(path.read_text())
 nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
 assert len(nodes)==len(names)
 exec(compile(ast.Module(body=nodes,type_ignores=[]),str(path),'exec'),env)
 return env
checks=[]
evidence=read(STUDY/'evidence.json')
for label,records in [('receipt',evidence['files']),('input',read(STUDY/'input-pins.json'))]:
 for p,h in records.items():
  assert sha(ROOT/p)==h,p
  checks.append({'kind':label,'path':p,'sha256':h})
for f in evidence['rawFrames']:
 p=ROOT/f['path'];b=p.read_bytes()
 assert sha(p)==f['sha256'] and len(b)==f['bytes']
 assert b[:8]==b'\x89PNG\r\n\x1a\n' and list(struct.unpack_from('>II',b,16))==f['size']
 checks.append({'kind':'raw','path':f['path'],'sha256':f['sha256']})
assert len(evidence['rawFrames'])==20
provenance=read(STUDY/'capture-provenance.json');cameras=read(STUDY/'cameras.json')
for role,suffix in [('baseline','cervical-frame-repair'),('candidate','complete-proportion-study')]:
 r=provenance[role];folder=BASE/suffix;raw=ROOT/'tmp/mantis-complete-proportion-study'/role
 assert sha(ROOT/r['sourcePath'])==r['sourceSha256']
 for stem,ext in [('mantis-study-','glb'),('mantis-mesh-','json'),('metrics-','json')]:
  name=stem+suffix+'.'+ext
  assert (folder/name).read_bytes()==(raw/name).read_bytes(),name
 assert sha(folder/('mantis-study-'+suffix+'.glb'))==r['frozenGlbSha256']==r['rebuiltGlbSha256']
 assert len(r['capturedViews'])==10
 for view,v in r['capturedViews'].items():
  assert v['camera']==cameras['cameras'][view]
  assert v['settings']==cameras['settings']
  assert sha(raw/(view+'.png'))==v['sha256']
  other=provenance['candidate' if role=='baseline' else 'baseline']['capturedViews'][view]
  assert v['camera']==other['camera'] and v['settings']==other['settings']
# Source/GLB topology, material, stored-normal/source-polygon/facet and intersections.
helper=ROOT/'docs/reviews/mantis-curved-normal-diagnosis/diagnose.py'
genv=functions(helper,['read','sub','dot','cross','norm','unit','facet','game','newell','glb_read','accessor'],dict(json=json,math=math,struct=struct))
g=SimpleNamespace(**{k:v for k,v in genv.items() if callable(v)})
xenv=functions(BASE/'cervical-frame-repair/check_geometry.py',['segment','orient','inside','intersects'],dict(g=g))
x=SimpleNamespace(**{k:v for k,v in xenv.items() if callable(v)})
aenv=functions(STUDY/'check_geometry.py',['audit'],dict(g=g,x=x,Counter=Counter))
audit=read(STUDY/'geometry-audit.json');summaries={}
for role,suffix in [('candidate','complete-proportion-study'),('baseline','cervical-frame-repair')]:
 actual=aenv['audit'](BASE/suffix,suffix)
 assert actual==audit[role],role
 summaries[role]={k:v for k,v in actual.items() if k not in ['parts','facetDeviations','neckIncidentCrossObjectIntersections']}
 summaries[role]['facetDeviationCount']=len(actual['facetDeviations'])
 summaries[role]['selfIntersectionParts']=[p['name'] for p in actual['parts'] if p['nonAdjacentSelfIntersections']]
 summaries[role]['neckCrossObjectTriangleIntersections']=sum(actual['neckIncidentCrossObjectIntersections'].values())
freeze=read(HERE/'frozen-candidate.json')
score=sum(Decimal(freeze['weights'][k])*Decimal(v) for k,v in freeze['candidate_scores'].items())
assert str(score)==freeze['weighted_exact'] and score<4
out={'status':'PASS_STATIC_EVIDENCE_CLOSURE','checkedHashes':checks,'evidenceSha256':sha(STUDY/'evidence.json'),'sourceGlbRawMeshMetricsExact':True,'matchedCameraLightSettingsViews':10,'geometry':summaries,'native':'No exact complete-proportion native payload supplied. Older complete-pass2-native cannot establish this candidate native normal closure.','animation':'Not evaluated; static evidence only.','limits':'Existing source rebuild receipts are byte-verified, not independently rebuilt here. Geometry diagnostic functions reused with top-level writes excluded; no visual points from tests.','verifierDependencies':{str(p.relative_to(ROOT)):sha(p) for p in [helper,BASE/'cervical-frame-repair/check_geometry.py',STUDY/'check_geometry.py']}}
(HERE/'closure.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='checkedHashes'},indent=2))
