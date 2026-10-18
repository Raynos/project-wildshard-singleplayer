from pathlib import Path
import math,sys,json
sys.path.insert(0,'art/driftwood-isle/approved-puffer')
from convex_puffer_pouch import convex_hull,normal,dot
source=Path('art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v70_from_v9.py').read_text()
ns=dict(math=math,PI=math.pi,sys=sys,Path=Path,__file__=str(Path('art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v70_from_v9.py').resolve()))
exec(source[source.index('SECTIONS='):source.index('\nedge_uses={}')],ns)
pts=ns['mantle_candidate']; faces=ns['mantle_faces'];results=[]
for sectors in [(0,1,2,3),(11,12,13,0)]:
 ids=[r*14+s for r in range(4,8)for s in sectors];lookup={i:k for k,i in enumerate(ids)}
 old=[f for f in faces if all(i in lookup for i in f)]
 edges={}
 for f in old:
  for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]=edges.get(tuple(sorted((a,b))),0)+1
 boundary={e for e,n in edges.items()if n==1}; oldrails=[e for e in edges if abs(pts[e[0]][1]-pts[e[1]][1])<1e-10 and e not in boundary]
 candidate=[pts[i]for i in ids]
 for r in (5,6):
  for s in sectors[1:3]:
   sg=1 if s in (1,13) else -1; off=.03*sg*(1 if r==5 else -1)
   y=ns['SECTIONS'][r][0]+off;w,z,h=ns['section'](y);theta=2*math.pi*s/14+.035*math.sin(4*math.pi*s/14)*(1 if r%2 else -1);ridge=.020*max(0,math.cos(theta))**2
   candidate[lookup[r*14+s]]=((w+ridge*.35)*math.sin(theta),y,z+(h+ridge)*math.cos(theta))
 hull=convex_hull(candidate);exterior=[]
 for f in hull:
  c=[sum(candidate[i][a]for i in f)/3 for a in range(3)]
  if dot(normal(candidate,f),(c[0],0,c[2]-.8))>0:exterior.append(tuple(ids[i]for i in f))
 newedges={}
 for f in exterior:
  for a,b in zip(f,f[1:]+f[:1]):newedges[tuple(sorted((a,b)))]=newedges.get(tuple(sorted((a,b))),0)+1
 newboundary={e for e,n in newedges.items()if n==1}
 results.append(dict(sectors=sectors,oldTriangles=len(old),oldInteriorEqualYEdges=len(oldrails),oldRailEdges=oldrails,newExteriorTriangles=len(exterior),missingBoundaryEdges=sorted(boundary-newboundary),extraBoundaryEdges=sorted(newboundary-boundary),discardedSamples=sorted(set(ids)-{i for f in exterior for i in f}),survivingOldRails=sorted(set(oldrails)&set(newedges))))
print(json.dumps(results,indent=2))
from convex_puffer_pouch import sub
print('BOUNDARY SUPPORT DISTANCES')
for sectors in [(0,1,2,3),(11,12,13,0)]:
 ids=[r*14+s for r in range(4,8)for s in sectors];lookup={i:k for k,i in enumerate(ids)}
 for mode in ('baseline','candidate'):
  sample=[pts[i]for i in ids]
  if mode=='candidate':
   for r in (5,6):
    for s in sectors[1:3]:
     off=.03*(1 if s in (1,13)else -1)*(1 if r==5 else -1);y=ns['SECTIONS'][r][0]+off;w,z,h=ns['section'](y);theta=2*math.pi*s/14+.035*math.sin(4*math.pi*s/14)*(1 if r%2 else -1);ridge=.020*max(0,math.cos(theta))**2
     sample[lookup[r*14+s]]=((w+ridge*.35)*math.sin(theta),y,z+(h+ridge)*math.cos(theta))
  hull=convex_hull(sample)
  for old in (70,84,5*14+sectors[-1],6*14+sectors[-1]):
   p=sample[lookup[old]];dist=sorted((dot(normal(sample,f),sub(p,sample[f[0]])),f)for f in hull)
   exterior=[f for f in hull if dot(normal(sample,f),(sum(sample[i][0]for i in f)/3,0,sum(sample[i][2]for i in f)/3-.8))>0]
   ext=sorted(dot(normal(sample,f),sub(p,sample[f[0]]))for f in exterior)
   print(sectors,mode,old,'allHullMax',dist[-1][0],'exteriorMax',ext[-1])
