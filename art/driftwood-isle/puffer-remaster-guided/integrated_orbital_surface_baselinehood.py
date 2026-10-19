"""Explicit hull-boundary to orbital-aperture replacement, with seated hood planes.

Blender mathutils is used only for constrained triangulation. The original eye
assemblies remain separate and immutable. This replaces old support shells and
brow solids; it never adds a face-covering overlay.
"""
import math,json,hashlib
from pathlib import Path
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

def original_lower_hood(sign):
    path=Path(__file__).resolve().parents[3]/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
    if hashlib.sha256(path.read_bytes()).hexdigest()!='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338':raise RuntimeError('Guide changed')
    part=json.loads(path.read_text())['parts'][1];flat=part['positions']
    cloud=[(flat[i],flat[i+2],flat[i+1])for i in range(0,len(flat),3)]
    targets=[(sign*.19,.785,.8944),(sign*.46,.725,.958),(sign*.19,.645,.8794),(sign*.46,.585,.943)]
    actual=[]
    for target in targets:
        nearest=min(cloud,key=lambda p:math.dist(p,target))
        if math.dist(nearest,target)>1e-6:raise RuntimeError('Original brow underside anchor missing')
        actual.append(nearest)
    return actual

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
        underside=original_lower_hood(sign)
        inner,outer_front,rear_inner,rear_outer=underside
        slope_z=(outer_front[2]-inner[2])/(abs(outer_front[0])-abs(inner[0]))
        slope_y=(outer_front[1]-inner[1])/(abs(outer_front[0])-abs(inner[0]))
        depth_slope=(rear_inner[2]-inner[2])/(rear_inner[1]-inner[1])
        aperture=[];clipped=[]
        for k in range(16):
            angle=2*math.pi*k/16;x=sign*.34+.108*math.cos(angle)
            z=.90+.077*math.sin(angle)*(1.18 if math.sin(angle)<0 else 1)
            hood=inner[2]+(abs(x)-abs(inner[0]))*slope_z
            hood_y=inner[1]+(abs(x)-abs(inner[0]))*slope_y
            is_clipped=z>hood-.003
            z=min(z,hood-.003)
            aperture.append((x,hood_y if is_clipped else .743,z));clipped.append(is_clipped)
        if not all(inside_polygon(p[0],p[2],outer)for p in aperture):raise RuntimeError('Preserved aperture does not fit actual hull patch')
        local=outer+aperture;n=len(outer);constraints=[]
        for begin,count in ((0,n),(n,16)):
            constraints.extend((begin+k,begin+(k+1)%count)for k in range(count))
        # Broad upper/front hood plane seated into the actual outer boundary.
        # All new ridge points remain inside the original brow envelope.
        ridges=[inner,outer_front,
                (sign*.205,.770,.954),(sign*.435,.714,1.020)]
        for p in ridges:
            if not inside_polygon(p[0],p[2],outer)or inside_polygon(p[0],p[2],aperture):raise RuntimeError('Hood control outside facial patch')
            local.append(p)
        ridge_start=n+16
        constraints.extend((ridge_start+a,ridge_start+b)for a,b in ((0,1),(2,3),(0,2),(1,3)))
        # Retain actual mantle samples above the compact hood. This prevents
        # a long crownward fan from replacing the original shoulder surface.
        restored=[]
        for old in sorted({i for fi in selected for i in faces[fi]}):
            p=points[old]
            if p[2]<=1.025 or not inside_polygon(p[0],p[2],outer):continue
            if min(math.hypot(p[0]-q[0],p[2]-q[2])for q in local)<1e-5:continue
            local.append(p);restored.append(old)
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
        for k,p in enumerate(aperture):
            back.append(len(points))
            back_z=p[2]+depth_slope*(.675-p[1]) if clipped[k] else p[2]
            points.append((p[0],.675,back_z))
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
        receipts.append({'sign':sign,'oldHullFaceIds':selected,'fixedBoundaryVertices':loop,'newSurfaceTriangles':len(surface),'aperture':aperture,'upperRidge':ridges,'restoredMantleVertices':restored,'exactOriginalLowerHoodAnchors':underside,'undersideDepthSlope':depth_slope})
    return points,[f for i,f in enumerate(faces)if i not in remove]+added,receipts
