"""Explicit anatomical cage construction, independent of Blender.

Front facial patches share vertices with the outer hull. Socket and mouth walls
replace patches and close inward; no whole-body Booleans or overlapping masks.
Blockout eyes are shallow inset surfaces. This is a shape study, not final detail.
"""
import math


def make_cage(spec, columns):
    vertices=[]; faces=[]; colors=[]; landmarks={}
    def vertex(p):
        vertices.append(tuple(p)); return len(vertices)-1
    def face(ids,color):
        faces.append(tuple(ids));colors.append(color)
    for contour in ('crown','hoodAndNose','orbitalCheek','convexPouch','lowerArc'):
        for point in spec['namedContours'][contour]:vertex(point)
    def grid(r,c):return r*7+c
    skipped={(1,1),(1,4),(2,2),(2,3)}
    for r in range(4):
        for c in range(6):
            if (r,c) in skipped:continue
            ids=(grid(r,c),grid(r,c+1),grid(r+1,c+1),grid(r+1,c))
            color='teal' if r<2 else 'ivory'
            if r==1:color='ivory' if c in (2,3) else 'teal'
            face(ids,color)
    # Entire front perimeter is reused by a broad shoulder and posterior cage.
    boundary=[grid(0,c) for c in range(7)]+[grid(r,6)for r in range(1,5)]+[grid(4,c)for c in range(5,-1,-1)]+[grid(r,0)for r in range(3,0,-1)]
    rear=[]
    for i in boundary:
        x,y,z=vertices[i]
        rear_y=spec['rearY']+.20*((z-.78)/.65)**2+.12*(x/.65)**2
        rear.append(vertex((x*spec['rearWidthScale'],rear_y,.78+(z-.78)*spec['rearHeightScale'])))
    n=len(boundary)
    for i in range(n):
        j=(i+1)%n
        face((boundary[j],boundary[i],rear[i],rear[j]),'teal' if (vertices[boundary[i]][2]+vertices[boundary[j]][2])*.5>.62 else 'ivory')
    center=vertex((0,spec['rearY']-.14,.78))
    for i in range(n):face((rear[(i+1)%n],rear[i],center),'teal')
    eyes=[]
    for sign,c in ((-1,1),(1,4)):
        outer=[grid(1,c),grid(1,c+1),grid(2,c+1),grid(2,c)]
        pts=[vertices[i]for i in outer]
        def add(a,b):return tuple(x+y for x,y in zip(a,b))
        def sub(a,b):return tuple(x-y for x,y in zip(a,b))
        def mul(a,s):return tuple(x*s for x in a)
        def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
        def unit(a):return mul(a,1/math.sqrt(sum(x*x for x in a)))
        center=tuple(sum(p[a]for p in pts)/4 for a in range(3))
        tangent=unit(sub(pts[1],pts[0]))
        normal=unit(cross(tangent,sub(pts[3],pts[0])))
        up=unit(cross(tangent,normal))
        center=add(center,mul(normal,.012))
        cx,cy,cz=center
        rx=math.dist(pts[0],pts[1])*.40;rz=.105
        ring=[]
        for angle in (135,90,45,0,-45,-90,-135,-180):
            t=math.radians(angle);xx=rx*math.cos(t);zz=rz*math.sin(t)
            zz=min(zz,rz*.61+sign*xx*.25)
            ring.append(vertex(add(add(center,mul(tangent,xx)),mul(up,zz))))
        # Map each outer corner to the corresponding diagonal of the octagon.
        for k in range(4):
            a,b=outer[k],outer[(k+1)%4];i0=ring[2*k];i1=ring[(2*k+1)%8];i2=ring[(2*k+2)%8]
            color='orange' if k in (0,1,3) else 'ivory'
            face((a,b,i1),color);face((b,i2,i1),color);face((a,i1,i0),color)
        back=[vertex(sub(vertices[i],mul(normal,.11)))for i in ring]
        for i in range(8):face((ring[i],ring[(i+1)%8],back[(i+1)%8],back[i]),'socket')
        face(tuple(reversed(back)),'socket')
        landmarks[f'eye-{sign}']=[cx,cy,cz]
        eyes.append(dict(center=add(sub(center,mul(normal,.035)),mul(up,-.012)),rx=rx*.91,rz=rz*.91,sign=sign,tangent=tangent,up=up,normal=normal))
    outer=[grid(2,2),grid(2,3),grid(2,4),grid(3,4),grid(3,3),grid(3,2)]
    my=.775;mz=.845
    shape=[(-.17,mz), (0,mz+.07),(.17,mz),(.14,mz-.115),(0,mz-.15),(-.14,mz-.115)]
    ring=[vertex((x,my,z))for x,z in shape]
    for i in range(6):
        j=(i+1)%6;face((outer[i],outer[j],ring[j],ring[i]),'ivory')
    back=[vertex((vertices[i][0]*.85,my-.16,vertices[i][2]))for i in ring]
    for i in range(6):face((ring[i],ring[(i+1)%6],back[(i+1)%6],back[i]),'mouth')
    face(tuple(reversed(back)),'mouth')
    landmarks['mouth']=[0,my,mz-.04]
    # Remove only unused lattice samples inside the mouth patch.
    used=sorted({i for f in faces for i in f});remap={old:new for new,old in enumerate(used)}
    return dict(vertices=[vertices[i]for i in used],faces=[tuple(remap[i]for i in f)for f in faces],colors=colors,landmarks=landmarks,eyes=eyes)


def make_fin(root,fan,width,depth,sign):
    """A sloping four-sided shoulder expands into a closed six-point fan."""
    rx,ry,rz=root;fx,fy,fz=fan
    root=[(sign*(rx+x),ry+y,rz+z)for x,y,z in ((-.085,-.07,0),(.085,-.07,0),(.085,.07,0),(-.085,.07,0))]
    outline=[(-width,-depth*.35),(-width*.7,depth*.5),(-width*.25,depth), (width*.25,depth*.95),(width*.8,depth*.52),(width,-depth*.4)]
    top=[(sign*(fx+x),fy+y,fz+.04*(1-abs(x)/width))for x,y in outline]
    bottom=[(x,y,.008)for x,y,z in top]
    verts=root+top+bottom
    faces=[(3,2,1,0),(0,1,9),(1,2,8,9),(2,3,5,6,7,8),(3,0,4,5),(0,9,4)]
    faces.extend((4+i,4+(i+1)%6,10+(i+1)%6,10+i)for i in range(6))
    faces.append(tuple(reversed(range(10,16))))
    return verts,faces
