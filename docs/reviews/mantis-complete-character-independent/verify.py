"""Read-only recheck of evidence, with author audit output writes removed via AST."""
import ast,contextlib,hashlib,io,json,pathlib,sys
sys.dont_write_bytecode=True
R=pathlib.Path(__file__).resolve().parents[3]
H=R/'art/driftwood-isle/lowpoly-mantis/complete-character-pass'
O=pathlib.Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())
e=read(H/'evidence.json');p=read(H/'capture-provenance.json');c=read(H/'cameras.json');pins=read(H/'input-pins.json')
assert all(sha(R/f)==h for f,h in pins.items())
assert all(sha(R/f)==h for f,h in e['files'].items())
assert all(sha(R/f['path'])==f['sha256'] for f in e['rawFrames'])
for role,suffix in [('baseline','complete-proportion-study'),('candidate','complete-character-pass')]:
 d=p[role];folder=H.parent/suffix;raw=R/'tmp/mantis-complete-character-pass'/role
 assert sha(R/d['sourcePath'])==d['sourceSha256']
 assert sha(folder/f'mantis-study-{suffix}.glb')==d['frozenGlbSha256']==sha(raw/f'mantis-study-{suffix}.glb')==d['rebuiltGlbSha256']
 for stem in ['mantis-mesh-','metrics-']:assert read(folder/f'{stem}{suffix}.json')==read(raw/f'{stem}{suffix}.json')
 for view,receipt in d['capturedViews'].items():
  assert receipt['camera']==c['cameras'][view] and receipt['settings']==c['settings']
  assert receipt['sha256']==sha(raw/f'{view}.png')
class NoWrites(ast.NodeTransformer):
 def visit_Expr(self,n):
  if isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and n.value.func.attr=='write_text':return ast.Pass()
  return self.generic_visit(n)
summary={'hashPins':len(pins),'evidenceFileHashes':len(e['files']),'rawHashes':len(e['rawFrames']),'pairedCameraSettings':True,'rebuiltFrozenGlbByteEquality':True,'rebuiltMeshMetricsEquality':True}
for file in ['check_geometry.py','check_scope.py','check_intersections.py']:
 tree=NoWrites().visit(ast.parse((H/file).read_text()));ast.fix_missing_locations(tree)
 ns={'__file__':str(H/file),'__name__':'independent_recheck'}
 with contextlib.redirect_stdout(io.StringIO()):exec(compile(tree,str(H/file),'exec'),ns)
 result=ns['result'];target={'check_geometry.py':'geometry-audit.json','check_scope.py':'scope-audit.json','check_intersections.py':'intersection-audit.json'}[file]
 assert result==read(H/target),(file,'audit mismatch')
 summary[file]='Recomputed result exactly matches stored audit; no source writes'
(O/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
