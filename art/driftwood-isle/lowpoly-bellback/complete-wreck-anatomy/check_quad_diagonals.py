"""Both quad diagonals agree with actual source polygon normals; never hide a fold via triangulation."""
import json
from pathlib import Path
H=Path(__file__).resolve().parent;T=H.parents[3]/'tmp/bellback-complete-wreck-anatomy';result={}
for role in ['baseline','candidate']:
 meshes=json.loads((T/f'{role}-exact-mesh.json').read_text());bad=[];minimum=float('inf');count=0
 for obj in meshes:
  for i,(f,n) in enumerate(zip(obj['polygons'],obj['polygon_normals'])):
   if len(f)!=4:continue
   vs=[obj['vertices'][k] for k in f]
   for a,b,c in [(0,1,2),(0,2,3),(0,1,3),(1,2,3)]:
    u=[vs[b][k]-vs[a][k] for k in range(3)];v=[vs[c][k]-vs[a][k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];dot=sum(x*y for x,y in zip(cross,n));minimum=min(minimum,dot);count+=1
    if dot<=0:bad.append(dict(name=obj['name'],polygon=i,triangle=[a,b,c],dot=dot))
 result[role]=dict(quad_diagonal_triangles_checked=count,minimum_dot=minimum,failures=bad)
result['status']='PASS' if not result['candidate']['failures'] else 'FAIL';(H/'quad-diagonal-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'],result['candidate'])
