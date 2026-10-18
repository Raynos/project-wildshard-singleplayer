"""Partition existing planar hull faces for wrapped paint fields; no surface displacement."""
import math


def clip_polygon(poly, plane, keep_positive):
    result = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        da, db = plane(a[0]), plane(b[0])
        inside_a = da >= -1e-10 if keep_positive else da <= 1e-10
        inside_b = db >= -1e-10 if keep_positive else db <= 1e-10
        if inside_a:
            result.append(a)
        if inside_a != inside_b and abs(da-db) > 1e-12:
            t = da/(da-db)
            result.append((tuple(x+(y-x)*t for x, y in zip(a[0], b[0])),
                           tuple(x+(y-x)*t for x, y in zip(a[1], b[1]))))
    cleaned = []
    for point in result:
        if not cleaned or sum((a-b)**2 for a,b in zip(point[0],cleaned[-1][0])) > 1e-18:
            cleaned.append(point)
    if len(cleaned)>1 and sum((a-b)**2 for a,b in zip(cleaned[0][0],cleaned[-1][0]))<1e-18:
        cleaned.pop()
    return cleaned


def partition_hull_paint(body, palette, linear):
    import bpy
    import bmesh
    from mathutils import Vector
    original = body.data
    def stats(data):
        bm=bmesh.new();bm.from_mesh(data)
        result={'volume':abs(bm.calc_volume(signed=True)), 'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges)}
        bm.free();return result
    before=stats(original)
    original.calc_loop_triangles()
    color=original.color_attributes['Col']
    verts=[];faces=[];colors=[];lookup={};counts={'ochre':0,'ivory':0,'retained':0}
    def append(poly,key):
        if len(poly)<3:return
        points=[Vector(p[0])for p in poly]
        area=sum((points[i]-points[0]).cross(points[i+1]-points[0]).length*.5 for i in range(1,len(points)-1))
        if area<1e-11:return
        ids=[]
        for xyz,_ in poly:
            quantized=tuple(round(v,8)for v in xyz)
            if quantized not in lookup:lookup[quantized]=len(verts);verts.append(xyz)
            ids.append(lookup[quantized])
        if len(set(ids))!=len(ids):raise RuntimeError('Paint partition repeated polygon vertex')
        faces.append(ids);counts[key or 'retained']+=1
        colors.append([tuple(linear(v)for v in palette[key])+(1,)for _ in poly] if key else [p[1]for p in poly])
    for tri in original.loop_triangles:
        poly=[(tuple(original.vertices[original.loops[li].vertex_index].co),tuple(color.data[li].color))for li in tri.loops]
        # Split at symmetry plane first; abs(X) is then linear on each resulting face.
        for sign in (-1,1):
            half=clip_polygon(poly,lambda p:p[0]*sign,True)
            if len(half)<3:continue
            front=lambda p:p[1]+.4825-.55*sign*p[0]-.45*p[2]
            cream=lambda p:p[2]-.96+.25*sign*p[0]-.08*p[1]
            # V54 taper only the lateral/rear cream field. The original boundary
            # remains a ceiling, keeping the central muzzle and forward cream fixed.
            rear_taper=lambda p:p[2]-.83+.40*sign*p[0]-.35*p[1]
            upper=lambda p:p[2]-1.02+.08*sign*p[0]-.08*p[1]
            pieces=[half]
            for plane in (front,cream,rear_taper,upper):
                pieces=[part for old in pieces for part in (clip_polygon(old,plane,True),clip_polygon(old,plane,False))if len(part)>=3]
            for part in pieces:
                center=tuple(sum(v[0][i]for v in part)/len(part)for i in range(3))
                key=None
                if front(center)>1e-9 and original.polygons[tri.polygon_index].normal.y>-.15:
                    if cream(center)<-1e-9 and rear_taper(center)<-1e-9:key='ivory'
                    elif upper(center)<-1e-9:key='ochre'
                append(part,key)
    mesh=bpy.data.meshes.new('Same hull with aligned cheek paint boundaries')
    mesh.from_pydata(verts,[],faces);mesh.update()
    for material in original.materials:mesh.materials.append(material)
    paint=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for poly,rgba in zip(mesh.polygons,colors):
        for li,c in zip(poly.loop_indices,rgba):paint.data[li].color=c
    after=stats(mesh)
    if after['nonManifoldEdges'] or abs(after['volume']-before['volume'])>max(1e-7,before['volume']*1e-6):
        raise RuntimeError('Paint partition changed closed hull volume/topology: '+str((before,after)))
    body.data=mesh
    return {'status':'surface-preserving face partition','originalVertices':len(original.vertices),'partitionVertices':len(mesh.vertices),
            'before':before,'after':after,'faceCounts':counts,'paletteChanged':False,'surfaceDisplacement':0,
            'boundaries':{'front':'Y+.4825-.55*abs(X)-.45*Z=0','cream':'intersection of Z-.96+.25*abs(X)-.08*Y<0 and Z-.83+.40*abs(X)-.35*Y<0','orangeTop':'Z-1.02+.08*abs(X)-.08*Y=0'}}
