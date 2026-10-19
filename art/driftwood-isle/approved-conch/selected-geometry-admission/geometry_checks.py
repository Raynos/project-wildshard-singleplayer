from mathutils import Vector
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
 return {'mesh':name,'minimumOutwardRadialCosine':minimum,'opposedSideTriangles':opposed,'opposedStripTrianglePairs':folded,'profile':profile}
