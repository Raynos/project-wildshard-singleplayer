"""Connected compact nose arch, open mouth and bowed lower pouch transition."""
import math
from collections import Counter,defaultdict
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt
from integrated_orbital_surface_baselinehood import component_faces,perimeter,inside_polygon,normal

def replace_mouth(points,faces,orbital_triangle_count):
    points=list(points);faces=[tuple(f)for f in faces];components=component_faces(faces);core=set(components[0]);protected=set(range(len(faces)-orbital_triangle_count,len(faces)))
    selected=[]
    for fi in core-protected:
        c=sum((Vector(points[i])for i in faces[fi]),Vector())/3
        if c.y>.48 and(c.x/.28)**2+((c.z-.80)/.22)**2<1:selected.append(fi)
    loop=perimeter([faces[i]for i in selected]);outer=[points[i]for i in loop]
    aperture=[(-.20,.845,.705),(-.135,.875,.830),(0,.895,.925),(.135,.875,.830),(.20,.845,.705),(.10,.862,.691),(0,.866,.688),(-.10,.862,.691)]
    if not all(inside_polygon(p[0],p[2],outer)for p in aperture):raise RuntimeError('Mouth aperture does not fit connected facial perimeter')
    local=outer+aperture;n=len(outer);constraints=[]
    for begin,count in((0,n),(n,len(aperture))):constraints.extend((begin+k,begin+(k+1)%count)for k in range(count))
    arch=[(-.215,.805,.758),(-.16,.860,.868),(-.095,.895,.897),(0,.910,.975),(.095,.895,.897),(.16,.860,.868),(.215,.805,.758)]
    lower=[(0,.908,.636)]
    for row in(arch,lower):
        start=len(local)
        for p in row:
            if not inside_polygon(p[0],p[2],outer)or inside_polygon(p[0],p[2],aperture):raise RuntimeError('Mouth ridge outside selected facial surface')
            local.append(p)
        for first,second in zip(row,row[1:]):
            for sample_index in range(101):
                t=sample_index/100;x=first[0]*(1-t)+second[0]*t;z=first[2]*(1-t)+second[2]*t
                if not inside_polygon(x,z,outer)or inside_polygon(x,z,aperture):raise RuntimeError('Mouth ridge segment exits selected facial surface')
        constraints.extend((start+k,start+k+1)for k in range(len(row)-1))
    uv=[Vector((p[0],p[2]))for p in local]
    _,_,triangles,orig,_,_=delaunay_2d_cdt(uv,constraints,[],0,1e-9,True)
    if any(len(ids)!=1 for ids in orig):raise RuntimeError('Mouth CDT merged protected boundary or introduced crossing')
    remap={};newlocal=[]
    for index,ids in enumerate(orig):
        old=ids[0];newlocal.append(local[old])
        if old<n:remap[index]=loop[old]
        else:remap[index]=len(points);points.append(local[old])
    inverse={ids[0]:i for i,ids in enumerate(orig)};surface=[]
    for f in triangles:
        center=sum((Vector(newlocal[i])for i in f),Vector())/3
        if inside_polygon(center.x,center.z,outer)and not inside_polygon(center.x,center.z,aperture):surface.append(tuple(remap[i]for i in reversed(f)))
    rim=[remap[inverse[n+k]]for k in range(len(aperture))]
    boundary={e for e,c in Counter(tuple(sorted((a,b)))for f in surface for a,b in zip(f,f[1:]+f[:1])).items()if c==1}
    expected={tuple(sorted(e))for cycle in(loop,rim)for e in zip(cycle,cycle[1:]+cycle[:1])}
    if boundary!=expected:raise RuntimeError('Mouth surface lost exact perimeter')
    back=[]
    for p in aperture:back.append(len(points));points.append((p[0]*.96,.60,.80+(p[2]-.80)*.96))
    for k in range(len(rim)):
        j=(k+1)%len(rim);surface.extend([(rim[k],rim[j],back[j]),(rim[k],back[j],back[k])])
    center=len(points);points.append((0,.60,.80))
    for k in range(len(rim)):surface.append((back[k],back[(k+1)%len(rim)],center))
    retained_edges=set()
    for fi in core-set(selected):
        f=faces[fi];retained_edges.update(zip(f,f[1:]+f[:1]))
    uses=defaultdict(list)
    for i,f in enumerate(surface):
        for a,b in zip(f,f[1:]+f[:1]):uses[tuple(sorted((a,b)))].append(i)
    fixed=set();queue=[]
    for i,f in enumerate(surface):
        for a,b in zip(f,f[1:]+f[:1]):
            if(a,b)in retained_edges or(b,a)in retained_edges:
                if(a,b)in retained_edges:surface[i]=tuple(reversed(surface[i]))
                fixed.add(i);queue.append(i);break
    while queue:
        f=surface[queue.pop()]
        for a,b in zip(f,f[1:]+f[:1]):
            for j in uses[tuple(sorted((a,b)))]:
                if j in fixed:continue
                other=surface[j]
                if(a,b)in list(zip(other,other[1:]+other[:1])):surface[j]=tuple(reversed(other))
                fixed.add(j);queue.append(j)
    if len(fixed)!=len(surface):raise RuntimeError('Disconnected mouth patch')
    bridges=[c for c in components if len(c)==20]
    if len(bridges)!=1:raise RuntimeError('Expected one old20-triangle nose bridge')
    remove=set(selected)|bridges[0]
    result=[f for i,f in enumerate(faces)if i not in remove]+surface
    return points,result,{'oldHullFaces':selected,'fixedPerimeterVertices':loop,'aperture':aperture,'archRidge':arch,'lowerPouchTransition':lower,'removedOldBridgeTriangles':20,'newSurfaceTriangles':len(surface),'oldOrbitalTrianglesPreserved':orbital_triangle_count}
