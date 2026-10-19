"""Explicit hull-boundary to orbital-aperture replacement, with seated hood planes.

Blender mathutils is used only for constrained triangulation. The original eye
assemblies remain separate and immutable. This replaces old support shells and
brow solids; it never adds a face-covering overlay.
"""
import math
from collections import Counter,defaultdict
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

def component_faces(faces):
    uses=defaultdict(list)
    for i,f in enumerate(faces):
        for a,b in zip(f,f[1:]+f[:1]):uses[tuple(sorted((a,b)))].append(i)
    adjacent=defaultdict(set)
    for fs in uses.values():
        for i in fs:adjacent[i].update(fs)
    remaining=set(range(len(faces)));components=[]
    while remaining:
        first=remaining.pop();todo=[first];component={first}
        while todo:
            for nxt in adjacent[todo.pop()]:
                if nxt in remaining:remaining.remove(nxt);component.add(nxt);todo.append(nxt)
        components.append(component)
    return sorted(components,key=len,reverse=True)

def normal(points,f):
    a,b,c=[Vector(points[i])for i in f]
    return (b-a).cross(c-a).normalized()

def perimeter(faces):
    edges=Counter(tuple(sorted((a,b)))for f in faces for a,b in zip(f,f[1:]+f[:1]))
    boundary={e for e,n in edges.items()if n==1};neighbors=defaultdict(list)
    for a,b in boundary:neighbors[a].append(b);neighbors[b].append(a)
    if not boundary or any(len(v)!=2 for v in neighbors.values()):raise RuntimeError('Orbital patch boundary branches')
    first=min(neighbors);loop=[first];previous=None;current=first
    while True:
        nxt=next(i for i in neighbors[current]if i!=previous)
        if nxt==first:break
        if nxt in loop:raise RuntimeError('Orbital boundary self-repeats')
        loop.append(nxt);previous,current=current,nxt
    if len(loop)!=len(boundary):raise RuntimeError('Orbital patch has multiple boundaries')
    return loop

def inside_polygon(x,z,polygon):
    inside=False
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if (a[2]>z)!=(b[2]>z) and x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0]:inside=not inside
    return inside

def replace_orbits(points,faces):
    points=list(points);faces=[tuple(f)for f in faces];components=component_faces(faces)
    core=set(components[0]);shells=[c for c in components if len(c)==192]
    if len(shells)!=2:raise RuntimeError('Expected exactly two inherited socket shells')
    remove=set().union(*shells);added=[];receipts=[]
    for sign in (-1,1):
        selected=[]
        for fi in core:
            f=faces[fi];c=sum((Vector(points[i])for i in f),Vector())/3
            ny=normal(points,f).y
            lower=ny>.15 and ((c.x-sign*.34)/.18)**2+((c.z-.91)/.15)**2<1
            upper=ny>.01 and .17<sign*c.x<.49 and .96<c.z<1.12
            if c.y>.20 and (lower or upper):selected.append(fi)
        loop=perimeter([faces[i]for i in selected]);outer=[points[i]for i in loop]
        # Same near-circular lower aperture, clipped by the existing descending
        # inward lower hood line. The eye centers and depth are never changed.
        aperture=[]
        for k in range(16):
            angle=2*math.pi*k/16;x=sign*.34+.108*math.cos(angle)
            z=.90+.077*math.sin(angle)*(1.18 if math.sin(angle)<0 else 1)
            hood=.8944+(abs(x)-.19)*(.0636/.27)
            z=min(z,hood-.003)
            aperture.append((x,.743,z))
        if not all(inside_polygon(p[0],p[2],outer)for p in aperture):raise RuntimeError('Preserved aperture does not fit actual hull patch')
        local=outer+aperture;n=len(outer);constraints=[]
        for begin,count in ((0,n),(n,16)):
            constraints.extend((begin+k,begin+(k+1)%count)for k in range(count))
        # Broad upper/front hood plane seated into the actual outer boundary.
        # All new ridge points remain inside the original brow envelope.
        ridges=[(sign*.235,.760,.980),(sign*.425,.699,1.024),
                (sign*.245,.735,1.006),(sign*.410,.665,1.041)]
        for p in ridges:
            if not inside_polygon(p[0],p[2],outer)or inside_polygon(p[0],p[2],aperture):raise RuntimeError('Hood control outside facial patch')
            local.append(p)
        uv=[Vector((p[0],p[2]))for p in local]
        verts,_,triangles,orig,_,_=delaunay_2d_cdt(uv,constraints,[],0,1e-9,True)
        if any(len(ids)!=1 for ids in orig):raise RuntimeError('Orbital CDT merged or inserted protected vertices')
        remap={};newlocal=[]
        for index,ids in enumerate(orig):
            old=ids[0];newlocal.append(local[old])
            if old<n:remap[index]=loop[old]
            else:remap[index]=len(points);points.append(local[old])
        inverse={ids[0]:i for i,ids in enumerate(orig)};surface=[]
        for f in triangles:
            center=sum((Vector(newlocal[i])for i in f),Vector())/3
            if inside_polygon(center.x,center.z,outer)and not inside_polygon(center.x,center.z,aperture):
                triangle=tuple(remap[i]for i in reversed(f))
                if normal(points,triangle).y<=0:raise RuntimeError('Orbital surface faces backward')
                surface.append(triangle)
        counts=Counter(tuple(sorted((a,b)))for f in surface for a,b in zip(f,f[1:]+f[:1]))
        boundary={e for e,c in counts.items()if c==1}
        rim=[remap[inverse[n+k]]for k in range(16)]
        expected={tuple(sorted(e))for cycle in (loop,rim)for e in zip(cycle,cycle[1:]+cycle[:1])}
        if boundary!=expected:raise RuntimeError('Orbital surface boundary is not exact')
        # Recessed cavity closes behind the unchanged amber/pupil assembly.
        back=[]
        for p in aperture:back.append(len(points));points.append((p[0],.675,p[2]))
        for k in range(16):
            j=(k+1)%16;surface.extend([(rim[k],rim[j],back[j]),(rim[k],back[j],back[k])])
        center=len(points);points.append((sign*.34,.675,.895))
        for k in range(16):surface.append((back[k],back[(k+1)%16],center))
        # Orient all new faces consistently against the retained hull boundary.
        retained_edge={}
        for fi in core-set(selected):
            f=faces[fi]
            for a,b in zip(f,f[1:]+f[:1]):retained_edge[(a,b)]=True
        edge_to_faces=defaultdict(list)
        for i,f in enumerate(surface):
            for a,b in zip(f,f[1:]+f[:1]):edge_to_faces[tuple(sorted((a,b)))].append(i)
        fixed=set();queue=[]
        for i,f in enumerate(surface):
            for a,b in zip(f,f[1:]+f[:1]):
                if (a,b)in retained_edge or (b,a)in retained_edge:
                    if (a,b)in retained_edge:surface[i]=tuple(reversed(surface[i]))
                    fixed.add(i);queue.append(i);break
        while queue:
            i=queue.pop();f=surface[i]
            for a,b in zip(f,f[1:]+f[:1]):
                for j in edge_to_faces[tuple(sorted((a,b)))]:
                    if j in fixed:continue
                    other=surface[j]
                    if (a,b)in list(zip(other,other[1:]+other[:1])):surface[j]=tuple(reversed(other))
                    fixed.add(j);queue.append(j)
        if len(fixed)!=len(surface):raise RuntimeError('Unoriented disconnected orbital surface')
        remove.update(selected);added.extend(surface)
        receipts.append({'sign':sign,'oldHullFaceIds':selected,'fixedBoundaryVertices':loop,'newSurfaceTriangles':len(surface),'aperture':aperture,'upperRidge':ridges})
    return points,[f for i,f in enumerate(faces)if i not in remove]+added,receipts
