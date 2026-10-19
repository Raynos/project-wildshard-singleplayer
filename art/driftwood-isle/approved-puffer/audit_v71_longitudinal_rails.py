from pathlib import Path
import math,sys,json
sys.path.insert(0,'art/driftwood-isle/approved-puffer')
from remesh_puffer_flanks_v71 import edge_uses,deficits,maximum_concave_hinge
source=Path('art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v71_topologyaudit.py').read_text()
ns=dict(math=math,PI=math.pi,sys=sys,Path=Path,json=json,out=Path('tmp'),__file__=str(Path('art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v71_topologyaudit.py').resolve()))
exec(source[source.index('SECTIONS='):source.index('\nedge_uses={}')],ns)
p=ns['mantle_candidate'];f=ns['mantle_faces'];result=[]
for sector in (1,2,3):
 chain=[]
 for row in range(4,7):
  a,b=row*14+sector,(row+1)*14+sector
  if tuple(sorted((a,b))) not in edge_uses(f):continue
  slope=math.degrees(math.atan2(p[b][2]-p[a][2],p[b][1]-p[a][1]))
  chain.append(dict(edge=[a,b],sideProjectedSlopeDegrees=slope,projectedLength=math.hypot(p[b][2]-p[a][2],p[b][1]-p[a][1])))
 result.append(dict(sector=sector,chain=chain))
print(json.dumps(result,indent=2))
