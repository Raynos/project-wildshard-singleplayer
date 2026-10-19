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
    for r in range(5):
        for c,u in enumerate(columns):
            z=spec['rowZ'][r]
            if r==0:z-=.13*u*u
            if r==1:z+=.025*abs(u)
            if r==4:z+=.08*u*u
            y=spec['rowFrontY'][r]-spec['sideSetback'][r]*abs(u)**1.35
            vertex((u*spec['rowWidth'][r],y,z))
    def grid(r,c):return r*7+c
    skipped={(1,1),(1,4),(2,2),(2,3)}
    for r in range(4):
        for c in range(6):
            if (r,c) in skipped:continue
            ids=(grid(r,c),grid(r,c+1),grid(r+1,c+1),grid(r+1,c))
            color='teal' if r<2 else 'ivory'
            if r==1 and c in (0,2,3,5):color='orange'
            face(ids,color)
    # Entire front perimeter is reused by a broad shoulder and posterior cage.
    boundary=[grid(0,c) for c in range(7)]+[grid(r,6)for r in range(1,5)]+[grid(4,c)for c in range(5,-1,-1)]+[grid(r,0)for r in range(3,0,-1)]
    rear=[]
    for i in boundary:
        x,y,z=vertices[i]
        rear.append(vertex((x*spec['rearWidthScale'],spec['rearY'],.78+(z-.78)*spec['rearHeightScale'])))
    n=len(boundary)
    for i in range(n):
        j=(i+1)%n
        face((boundary[j],boundary[i],rear[i],rear[j]),'teal' if (vertices[boundary[i]][2]+vertices[boundary[j]][2])*.5>.62 else 'ivory')
    center=vertex((0,spec['rearY']-.08,.78))
    for i in range(n):face((rear[(i+1)%n],rear[i],center),'teal')
    eyes=[]
    for sign,c in ((-1,1),(1,4)):
        outer=[grid(1,c),grid(1,c+1),grid(2,c+1),grid(2,c)]
        pts=[vertices[i]for i in outer]
        cx=sum(p[0]for p in pts)/4;cz=sum(p[2]for p in pts)/4
        cy=sum(p[1]for p in pts)/4+.025
        rx=(pts[1][0]-pts[0][0])*.48;rz=(pts[0][2]-pts[3][2])*.44
        # Clockwise from upper-left, with a sloped hood clipping the upper arc.
        ring=[]
        for angle in (135,90,45,0,-45,-90,-135,-180):
            t=math.radians(angle);x=cx+rx*math.cos(t);z=cz+rz*math.sin(t)
            z=min(z,cz+rz*.63+sign*(x-cx)*.26)
            ring.append(vertex((x,cy,z)))
        # Map each outer corner to the corresponding diagonal of the octagon.
        for k in range(4):
            a,b=outer[k],outer[(k+1)%4];i0=ring[2*k];i1=ring[(2*k+1)%8];i2=ring[(2*k+2)%8]
            color='orange' if k in (0,1,3) else 'ivory'
            face((a,b,i1),color);face((b,i2,i1),color);face((a,i1,i0),color)
        back=[vertex((vertices[i][0],vertices[i][1]-.11,vertices[i][2]))for i in ring]
        for i in range(8):face((ring[i],ring[(i+1)%8],back[(i+1)%8],back[i]),'socket')
        face(tuple(reversed(back)),'socket')
        landmarks[f'eye-{sign}']=[cx,cy,cz]
        eyes.append(dict(center=(cx,cy-.035,cz-.012),rx=rx*.91,rz=rz*.91,sign=sign))
    outer=[grid(2,2),grid(2,3),grid(2,4),grid(3,4),grid(3,3),grid(3,2)]
    my=spec['rowFrontY'][2]+.035;mz=spec['rowZ'][2]-.075
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
