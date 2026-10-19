"""Closed shallow mouth collar seated into the unchanged baselinehood body."""
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from puffer_surface_topology import validate_closed_surface
from puffer_surface_clearance import classify_surface_point

def build_seated_mouth(body_points,body_faces):
    tree=BVHTree.FromPolygons(body_points,body_faces,all_triangles=True)
    inner=[(-.20,.845,.705),(-.135,.875,.830),(0,.895,.925),(.135,.875,.830),(.20,.845,.705),(.10,.862,.691),(0,.866,.688),(-.10,.862,.691)]
    outer=[(-.208,.845,.690),(-.18275,.765,.885),(0,.850,.975),(.18275,.765,.885),(.208,.845,.690),(.105,.851,.662),(0,.855,.654),(-.105,.851,.662)]
    roots=[]
    for x,y,z in outer:
        hit=tree.ray_cast(Vector((x,2,z)),Vector((0,-1,0)))
        if hit[0] is None:raise RuntimeError('Mouth root misses actual body')
        roots.append((x,min(y-.025,float(hit[0].y)-.025),z))
    inner_back=[(x,y-.045,z)for x,y,z in inner]
    points=outer+inner+inner_back+roots;faces=[]
    # Four closed ring strips: visible band, inner return, rear band, outer return.
    for first,second in[(0,8),(8,16),(16,24),(24,0)]:
        for k in range(8):
            j=(k+1)%8;a,b,c,d=first+k,first+j,second+j,second+k
            faces.extend([(a,b,d),(b,c,d)] if first==16 else [(a,b,c),(a,c,d)])
    volume=sum(Vector(points[a]).dot(Vector(points[b]).cross(Vector(points[c])))/6 for a,b,c in faces)
    if volume<0:faces=[tuple(reversed(f))for f in faces];volume=-volume
    if volume<=1e-6:raise RuntimeError('Mouth unit has no positive volume')
    validate_closed_surface(points,faces)
    minimum_area=min((Vector(points[b])-Vector(points[a])).cross(Vector(points[c])-Vector(points[a])).length*.5 for a,b,c in faces)
    if minimum_area<1e-8:raise RuntimeError('Degenerate mouth triangle')
    from mathutils.geometry import intersect_ray_tri
    for i,f in enumerate(faces):
        for g in faces[i+1:]:
            if set(f)&set(g):continue
            for triangle,edgeface in[(f,g),(g,f)]:
                a,b,c=[Vector(points[j])for j in triangle]
                for j,k in zip(edgeface,edgeface[1:]+edgeface[:1]):
                    start,end=Vector(points[j]),Vector(points[k]);delta=end-start
                    hit=intersect_ray_tri(a,b,c,delta,start,True)
                    if hit is not None:
                        t=(hit-start).dot(delta)/delta.length_squared
                        if 1e-7<t<1-1e-7:raise RuntimeError('Mouth unit has crossing nonadjacent triangles')
    rows=[]
    samples=roots+[tuple((roots[i][k]+roots[(i+1)%8][k])*.5 for k in range(3))for i in range(8)]
    for i,p in enumerate(samples):
        nearest=tree.find_nearest(Vector(p));r=classify_surface_point(p,body_points,body_faces,nearest[3]);rows.append({'sample':i,'point':p,'clearance':r})
        if r['signedEuclideanDistance']>-.003:raise RuntimeError('Mouth outer attachment is not buried by3mm: '+str(rows[-1]))
    return points,faces,{'status':'unaccepted closed seated mouth unit','innerGape':inner,'outerVisibleRing':outer,'buriedOuterRing':roots,'attachmentSamples':rows,'volume':volume,'minimumTriangleArea':minimum_area,'bodyGeometryUnchanged':True,'construction':'paired rings; no radial body-patch fan'}
