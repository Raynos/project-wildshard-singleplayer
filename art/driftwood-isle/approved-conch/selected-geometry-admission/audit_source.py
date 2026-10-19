"""Audit unmodified selected source before mirror/recalculation; no repair."""
import json,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'complete-pass2/build_conch_complete_pass2.py'
sweeps=[]
def inspect(name,profile,rows):
 minimum=1.;opposed=[];folded=[];n=len(rows[0])
 for j in range(len(rows)-1):
  centers=[Vector(profile[j][0]),Vector(profile[j+1][0])]
  for i in range(n):
   k=(i+1)%n;q,r,t,u=map(Vector,(rows[j][i],rows[j][k],rows[j+1][i],rows[j+1][k]));ns=[]
   for h,(pts,center) in enumerate([((q,r,u),(centers[0]*2+centers[1])/3),((q,u,t),(centers[0]+centers[1]*2)/3)]):
    a,b,c=pts;normal=(b-a).cross(c-a).normalized();radial=((a+b+c)/3-center).normalized();dot=normal.dot(radial);minimum=min(minimum,dot);ns.append(normal)
    if dot<=0:opposed.append({'sourcePolygon':2*(j*n+i)+h,'strip':j,'sectionVertex':i,'cosine':dot})
   if ns[0].dot(ns[1])<=0:folded.append({'sourcePolygons':[2*(j*n+i),2*(j*n+i)+1],'cosine':ns[0].dot(ns[1])})
 sweeps.append({'mesh':name,'minimumOutwardRadialCosine':minimum,'opposedSideTriangles':opposed,'opposedStripTrianglePairs':folded,'profile':profile})
source=BASE.read_text();source=source[:source.index('# Reference image')]
source=source.replace('return loft(name,rows,mats,indices=lambda','inspect(name,profile,rows)\n return loft(name,rows,mats,indices=lambda')
sys.argv=['audit','--','--out',str(HERE)]
scope={'__name__':'__main__','__file__':str(BASE),'inspect':inspect};exec(compile(source,str(BASE),'exec'),scope)
meshes=[]
for ob in scope['objects']:
 d=ob.data;d.calc_loop_triangles();bad=[]
 for t in d.loop_triangles:
  p=d.polygons[t.polygon_index]
  cosine=t.normal.dot(p.normal)
  if cosine<.999:bad.append({'polygon':p.index,'triangleVertices':list(t.vertices),'normalFacetCosine':cosine})
 meshes.append({'mesh':ob.name,'vertices':[list(v.co) for v in d.vertices],'polygons':[list(p.vertices) for p in d.polygons],'materialIndices':[p.material_index for p in d.polygons],'materials':[m.name for m in d.materials],'capFacetDeviations':bad})
(HERE/'baseline-source-sweep.json').write_text(json.dumps({'stage':'Before mirroring and normal recalculation','meshes':sweeps},indent=2))
(HERE/'baseline-source-indexed.json').write_text(json.dumps(meshes,separators=(',',':')))
print('Failed sweeps:',[(s['mesh'],s['minimumOutwardRadialCosine'],len(s['opposedSideTriangles']),len(s['opposedStripTrianglePairs'])) for s in sweeps if s['opposedSideTriangles'] or s['opposedStripTrianglePairs']])
print('Cap facet failures:',[(m['mesh'],len(m['capFacetDeviations'])) for m in meshes if m['capFacetDeviations']])
