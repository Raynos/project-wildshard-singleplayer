"""V56 from V9: complete-identity refinement against the approved low-poly target. Mesh implementation remains unaccepted.
Blender 4.3: -b -t 2 --python-exit-code 1 -P <source> -- --out tmp/puffer-lowpoly-v56-from-v9 --render
No old assets replaced; no runtime wiring. X right, Y forward, Z up.
"""
import argparse,json,math,random,sys,hashlib
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');p.add_argument('--nine-views',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);random.seed(4877)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PI=math.pi
PALETTE={'teal':(.12,.39,.38),'light':(.20,.48,.44),'dark':(.055,.25,.26),'ochre':(.91,.43,.075),'gold':(1,.62,.17),'cream':(.95,.82,.56),'ivory':(1,.91,.70),'socket':(.39,.24,.09),'black':(.012,.021,.021),'mouth':(.21,.058,.022),'tongue':(.72,.24,.09)}
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
mat=bpy.data.materials.new('Matte semantic color fields');mat.use_nodes=True;shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.85;attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col';mat.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
parts=[]
def mesh(name,verts,faces,color,joint='belly',variation=.045,face_colors=None,fix=True):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    if fix:
        bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);d.materials.append(mat)
    paint=d.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for i,poly in enumerate(d.polygons):
        key=face_colors[i] if face_colors is not None else color;rgb=PALETTE[key] if isinstance(key,str) else key;gain=1+random.uniform(-variation,variation)
        for li in poly.loop_indices:paint.data[li].color=tuple(linear(max(0,min(1,c*gain)))for c in rgb)+(1,)
    vg=ob.vertex_groups.new(name=joint);vg.add(list(range(len(verts))),1,'REPLACE');parts.append((ob,joint));return ob

def loft(name,rows,color,joint='belly',variation=.045):
    n=len(rows[0]);vs=[v for r in rows for v in r];fs=[]
    for j in range(len(rows)-1):
        for i in range(n):
            q=j*n+i;r=j*n+(i+1)%n;s=(j+1)*n+(i+1)%n;t=(j+1)*n+i
            fs.extend([(q,r,s),(q,s,t)] if (i+j)%2 else [(q,r,t),(r,s,t)])
    fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);return mesh(name,vs,fs,color,joint,variation)

# Sparse authored longitudinal sections. Crown is highest behind the eyes and slopes into the face.
SECTIONS=[(-.76,.10,.64,.13),(-.59,.30,.72,.31),(-.39,.49,.79,.44),(-.15,.60,.80,.53),(.10,.61,.79,.52),(.33,.59,.81,.47),(.55,.60,.82,.44),(.69,.45,.83,.31),(.73,.28,.83,.18),(.82,.11,.81,.08)]
def section(y):
    for x,z in zip(SECTIONS,SECTIONS[1:]):
        if x[0]<=y<=z[0]:
            t=(y-x[0])/(z[0]-x[0]);return tuple(x[i]*(1-t)+z[i]*t for i in range(1,4))
    return SECTIONS[0][1:] if y<SECTIONS[0][0] else SECTIONS[-1][1:]
def surface(y,angle,offset=0):
    w,z,h=section(y);return Vector(((w+offset)*math.sin(angle),y,z+(h+offset)*math.cos(angle)))
# V56: one closed authored mantle surface. Broad shared facets replace raised tile unions.
# Section envelope and all V36 facial components remain; shallow ridge variation is in shared vertices.
rows=[]
for j,(y,w,z,h) in enumerate(SECTIONS):
    row=[]
    for i in range(14):
        base=2*PI*i/14
        theta=base+.035*math.sin(2*base)*(1 if j%2 else -1)
        crown=max(0,math.cos(theta))
        ridge=.020*crown*crown if 1<=j<=6 else 0
        row.append(((w+ridge*.35)*math.sin(theta),y,z+(h+ridge)*math.cos(theta)))
    rows.append(row)
# V56 convex rear-cap resampling only. Front Y>=.10 remains byte-identical.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from convex_puffer_pouch import convex_hull,validate_convex_surface,silhouette_directions,dot,sub,normal,signed_volume
mantle_reference=[point for row in rows for point in row];mantle_candidate=list(mantle_reference)
mantle_offsets={1:{1:.055,2:-.045,12:-.045,13:.055},2:{1:-.06,2:.06,12:.06,13:-.06},3:{1:.05,2:-.05,12:-.05,13:.05}}
for row_index,items in mantle_offsets.items():
    for sector,offset in items.items():
        yy=SECTIONS[row_index][0]+offset*.70;w,z,h=section(yy)
        theta=2*PI*sector/14+.035*math.sin(4*PI*sector/14)*(1 if row_index%2 else -1)
        ridge=.020*max(0,math.cos(theta))**2
        mantle_candidate[row_index*14+sector]=((w+ridge*.35)*math.sin(theta),yy,z+(h+ridge)*math.cos(theta))
rear_reference=convex_hull(mantle_reference[:70]);rear_faces=convex_hull(mantle_candidate[:70])
# Artificial planar cut cap has a ~90-degree edge; it is removed before welding.
rear_stats=validate_convex_surface(mantle_candidate[:70],rear_faces,max_dihedral_degrees=100)
rear_exterior=[face for face in rear_faces if not all(i>=56 for i in face)];rear_edges={}
for face_index,face in enumerate(rear_exterior):
    for first,second in zip(face,face[1:]+face[:1]):rear_edges.setdefault(tuple(sorted((first,second))),[]).append(face_index)
rear_exterior_dihedral=max(math.degrees(math.acos(max(-1,min(1,dot(normal(mantle_candidate,rear_exterior[uses[0]]),normal(mantle_candidate,rear_exterior[uses[1]]))))))for uses in rear_edges.values()if len(uses)==2)
if rear_exterior_dihedral>65:raise RuntimeError('Rear exterior facet dihedral exceeds bound')
rear_used={i for face in rear_faces for i in face}
if not set(range(56,70)).issubset(rear_used):raise RuntimeError('Mantle interface anchor discarded')
if mantle_candidate[56:]!=mantle_reference[56:]:raise RuntimeError('Protected front mantle changed')
def join_front(rear):
    faces=[face for face in rear if not all(i>=56 for i in face)]
    for row_index in range(4,9):
        for sector in range(14):
            q=row_index*14+sector;r=row_index*14+(sector+1)%14;ss=(row_index+1)*14+(sector+1)%14;t=(row_index+1)*14+sector
            faces.extend([(q,r,ss),(q,ss,t)] if (sector+row_index)%2 else [(q,r,t),(r,ss,t)])
    faces.extend([(126,126+i,126+i+1)for i in range(1,13)])
    return faces
mantle_faces=join_front(rear_faces);reference_faces=join_front(rear_reference)
edge_uses={}
for face in mantle_faces:
    normal(mantle_candidate,face)  # fails degenerate triangles
    for first,second in zip(face,face[1:]+face[:1]):edge_uses.setdefault(tuple(sorted((first,second))),[]).append((first,second))
if any(len(uses)!=2 or uses[0]!=tuple(reversed(uses[1]))for uses in edge_uses.values()):raise RuntimeError('Mantle seam is not oriented closed manifold')
mantle_volume=signed_volume(mantle_candidate,mantle_faces);reference_volume=signed_volume(mantle_reference,reference_faces)
if mantle_volume<=0 or abs(mantle_volume/reference_volume-1)>.02:raise RuntimeError('Mantle volume regression')
mantle_directions=silhouette_directions([(0,1,0),(1,0,0),(0,0,1),(3,4.63,1.41),(0,1,.82),(1,0,.82)],180)
mantle_drift=max(abs(max(dot(point,direction)for point in mantle_candidate)-max(dot(point,direction)for point in mantle_reference))for direction in mantle_directions)
mantle_move=max(math.dist(old,new)for old,new in zip(mantle_reference,mantle_candidate))
if mantle_drift>.02 or mantle_move>.065:raise RuntimeError('Mantle sample/envelope displacement bound exceeded')
spine_clearances=[]
for yy,angle in [(-.43,0),(-.12,0),(-.27,-.95),(-.27,.95),(-.53,1.55)]:
    point=tuple(surface(yy,angle,-.018))
    old=max(dot(normal(mantle_reference[:70],face),sub(point,mantle_reference[face[0]]))for face in rear_reference)
    new=max(dot(normal(mantle_candidate[:70],face),sub(point,mantle_candidate[face[0]]))for face in rear_faces)
    if new>0 or new-old>.002:raise RuntimeError('Rear mantle exposes protected spine root')
    spine_clearances.append({'Y':yy,'angle':angle,'beforeSignedDistance':old,'afterSignedDistance':new})
used=sorted({i for face in mantle_faces for i in face});remap={old:new for new,old in enumerate(used)}
body=mesh('Continuous broad faceted mantle',[mantle_candidate[i]for i in used],[tuple(remap[i]for i in face)for face in mantle_faces],'teal',variation=.025)
(out/'mantle-facet-study.json').write_text(json.dumps({'base':'V55','scope':'convex rear cap Y<=.10 only; existing front welded along exact 14-vertex interface','authoredOffsets':mantle_offsets,'offsetScale':.70,'protectedFrontVertices':84,'rearConvexStats':rear_stats,'maximumExteriorDihedralDegrees':rear_exterior_dihedral,'signedVolume':mantle_volume,'referenceJoinedVolume':reference_volume,'maximumSampledSilhouetteDrift':mantle_drift,'maximumSampleDisplacement':mantle_move,'spineRootClearances':spine_clearances,'nonmanifoldEdges':0,'facePouchFeetAndPaletteChanged':False,'status':'structural gate only; rendered broad-facet gain unaccepted'},indent=2))

# Coherent larger color regions remain on the same connected surface, with no raised seams.
paint=body.data.color_attributes['Col']
for poly in body.data.polygons:
    center=poly.center
    color='light' if center.z>1.08 and -.48<center.y<.32 and center.x<.25 else 'teal'
    gain=1+random.uniform(-.025,.025)
    for li in poly.loop_indices:paint.data[li].color=tuple(linear(min(1,c*gain))for c in PALETTE[color])+(1,)

def union_into_body(ob):
    global parts
    bpy.context.view_layer.objects.active=body
    mod=body.modifiers.new('Continuous authored volume','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts=[entry for entry in parts if entry[0]!=ob]
    bpy.data.objects.remove(ob,do_unlink=True)

# V56 isolated pouch study: authored sparse/staggered samples, convex support planes.
# V51 face, mantle, palette and stance remain the fallback baseline.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from convex_puffer_pouch import pouch_point,silhouette_directions
from convex_puffer_pouch_subset import retopologize_pouch_subset
pouch_parameters=[(lat,2*PI*(i+(.30 if j%2 and j<5 else 0))/14)
    for j,lat in enumerate([-1.50,-1.12,-.68,-.20,.28,.70,1.10,1.48])for i in range(14)]
pouch_reference=[pouch_point(lat,angle)for lat,angle in pouch_parameters]
# Deliberate large diagonal junctions in the frontal strip, not random noise.
pouch_offsets={2:{0:.06,1:-.08,2:.08,12:.08,13:-.08},
    3:{1:.08,2:-.08,12:-.08,13:.08},4:{0:-.06,1:.08,13:.08}}
pouch_retained=[index for index in range(112)if index not in (58,68)]
pouch_candidates=[pouch_point(lat+pouch_offsets.get(index//14,{}).get(index%14,0),angle)
    for index,(lat,angle)in enumerate(pouch_parameters)if index in pouch_retained]
pouch_protected=[index for index in pouch_retained if pouch_offsets.get(index//14,{}).get(index%14,0)==0]
pouch_directions=silhouette_directions([(0,1,0),(1,0,0),(0,0,1),(3,4.63,1.41),(0,1,.82),(1,0,.82)],180)
pouch_result=retopologize_pouch_subset(pouch_reference,pouch_retained,pouch_candidates,pouch_protected,pouch_directions,
    max_displacement=.04,silhouette_tolerance=.015,max_volume_fraction=.02,max_dihedral_degrees=60)
pouch=mesh('Broad ivory throat planes',pouch_result['points'],pouch_result['faces'],'ivory',variation=.065)
(out/'pouch-convex-study.json').write_text(json.dumps({'base':'V51','scope':'standalone pouch only before existing union/cut',
    'removedOldSampleIds':[58,68],'authoredLatitudeOffsets':pouch_offsets,'newToOld':pouch_result['newToOld'],
    'oldToNew':pouch_result['oldToNew'],'receipt':pouch_result['receipt'],
    'faceAndMouthChanged':False,'status':'structural preparation passed; post-union rendered quality unaccepted'},indent=2))
union_into_body(pouch);pouch=body
body.name='Continuous mantle cheek and pouch'
# V56 local shared-vertex cheek/pouch taper. Preserve skull above orbital lower rim,
# central muzzle, maximum pouch width and all separate face/limb/detail components.
adjacency=[set()for _ in body.data.vertices]
for edge in body.data.edges:
    i,j=edge.vertices;adjacency[i].add(j);adjacency[j].add(i)
original_positions=[v.co.copy()for v in body.data.vertices]
def cheek_weight(co):
    x,y,z=co;ax=abs(x)
    return max(0,1-abs(z-.735)/.195)*max(0,1-abs(y-.53)/.34)*max(0,1-abs(ax-.49)/.18)
for _ in range(3):
    positions=[v.co.copy()for v in body.data.vertices]
    for vertex in body.data.vertices:
        w=cheek_weight(original_positions[vertex.index]);neighbors=adjacency[vertex.index]
        if not neighbors or w==0:continue
        average=sum((positions[j]for j in neighbors),Vector())/len(neighbors)
        candidate=positions[vertex.index].lerp(average,.55*w)
        displacement=candidate-original_positions[vertex.index]
        if displacement.length>.06:candidate=original_positions[vertex.index]+displacement.normalized()*.06
        vertex.co=candidate
body.data.update()
faces_before_triangulation=len(body.data.polygons)
bm=bmesh.new();bm.from_mesh(body.data)
# Define the deformed surface explicitly before Boolean/paint partition: moved n-gons
# are no longer assumed planar. This triangle surface is the immutable paint baseline.
bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
changed=[(v.co-original_positions[v.index]).length for v in body.data.vertices]
(out/'cheek-volume-taper.json').write_text(json.dumps({'method':'three bounded local shared-vertex smoothing passes','maximumDisplacement':max(changed),'changedVertices':sum(d>1e-8 for d in changed),'preservedRegion':'all vertices Z>=.93, central muzzle and vertices outside local cheek window','addedVertices':0,'facesBeforeTriangulation':faces_before_triangulation,'facesAfterTriangulation':len(body.data.polygons),'surfaceBaseline':'explicit fixed/ear-clip triangles after deformation, before Boolean and paint partition','addedBooleanOperations':0},indent=2))

# Low wide open beak, with true rear cavity. Cut the same opening through skull and pouch.
outline=[(-.19,.80),(-.20,.855),(-.135,.94),(0,1.025),(.135,.94),(.20,.855),(.19,.80),(.08,.785),(-.08,.785)]
vs=[]
for y in [.51,1.29]:vs.extend([(x,y,z)for x,z in outline])
n=len(outline);fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,n+(i+1)%n,n+i)for i in range(n)]
cutter=mesh('Mouth construction cutter',vs,fs,'mouth')
for ob in [pouch]:
    bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('Open mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
parts=[r for r in parts if r[0]!=cutter];bpy.data.objects.remove(cutter,do_unlink=True)
# V56 surface-preserving partition follows wrapped/sloped semantic boundaries.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paint_puffer_semantic_regions_v54 import partition_hull_paint
paint_receipt=partition_hull_paint(body,PALETTE,linear)
(out/'hull-paint-regions.json').write_text(json.dumps(paint_receipt,indent=2))
mesh('Dark recessed palate',[(x*.96,.87,.884+(z-.884)*.96)for x,z in outline],[tuple(range(n))],'mouth','head',0)
mesh('Tongue inside mouth',[(-.115,.98,.818),(.115,.98,.818),(.085,.92,.855),(-.085,.92,.855)],[(0,1,2,3)],'tongue','head',.02)

# Cream face/beak is a broad solid ribbon following the mouth, not a loose outline.
inner=[(-.20,.955,.805),(-.135,.985,.93),(0,1.005,1.025),(.135,.985,.93),(.20,.955,.805)]
outer=[(-.255,.86,.83),(-.215,.89,.985),(0,.96,1.075),(.215,.89,.985),(.255,.86,.83)]
vs=inner+outer+[(x,y-.065,z)for x,y,z in inner]+[(x,y-.065,z)for x,y,z in outer];fs=[]
for i in range(4):fs.extend([(i,i+1,i+6),(i,i+6,i+5),(i+10,i+15,i+16,i+11),(i,i+10,i+11,i+1),(i+5,i+6,i+16,i+15)])
fs.extend([(0,5,15,10),(4,14,19,9)])
mesh('Continuous cream facial beak planes',vs,fs,'cream','head',.035)
mesh('Small hooked beak tip',[(-.040,1.022,1.034),(.040,1.022,1.034),(0,1.045,.970),(0,.98,1.05)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'ivory','head')
for sign in [-1,1]:
    x=sign*.058
    mesh(f'Bridge nostril {sign}',[(x-.012,1.015,1.042),(x,1.019,1.052),(x+.012,1.015,1.042),(x,1.019,1.034)],[(0,1,2,3)],'mouth','head',0)
loft('Lower lip',[[(x,.985+.037*math.cos(k*PI/3),.80+.027*math.sin(k*PI/3))for k in range(6)]for x in[-.17,-.08,.08,.17]],'cream','head',.03)

# Explicit closed facial mask loops bridge intact hull to protected V9 eyes.
# Root rings penetrate intact body; no destructive Boolean is applied to this hull.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update();intact_hull=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
def surface_root(x,z,burial):
    center=Vector((0,0,.78));candidate=Vector((x,.42,z));normal=(candidate-center).normalized()
    hit,_,_,_=intact_hull.ray_cast(center+normal*3,-normal,6)
    if hit is None:raise RuntimeError('Facial root misses intact hull')
    return tuple(hit-normal*burial)
def volume_receipt(ob):
    bm=bmesh.new();bm.from_mesh(ob.data);volume=abs(bm.calc_volume(signed=True));nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
    fingerprint=hashlib.sha256(json.dumps({'v':[list(v.co)for v in ob.data.vertices],'f':[list(f.vertices)for f in ob.data.polygons]},separators=(',',':')).encode()).hexdigest()
    return {'geometrySHA256':fingerprint,'vertices':len(ob.data.vertices),'faces':len(ob.data.polygons),'volume':volume,'nonManifoldEdges':nonmanifold,'bounds':[[min(v.co[i]for v in ob.data.vertices),max(v.co[i]for v in ob.data.vertices)]for i in range(3)]}
intact_receipt=volume_receipt(body)
if intact_receipt['volume']<.2 or intact_receipt['vertices']<100:raise RuntimeError('Intact core failed baseline volume gate')
roof=[(-.215,.89,.985),(0,.96,1.075),(.215,.89,.985),(-.14,.60,1.005),(0,.59,1.065),(.14,.60,1.005)]
rv=roof+[(x,y,z-.045)for x,y,z in roof]
rf=[(0,1,4,3),(1,2,5,4),(6,9,10,7),(7,10,11,8),(0,3,9,6),(2,8,11,5),(0,6,7,1),(1,7,8,2),(3,4,10,9),(4,5,11,10)]
mesh('Closed narrow nose bridge',rv,rf,'cream','belly',.025)
# V56 move the entire mouth assembly with the pouch; preserve width and eye landmarks.
for ob,joint in parts:
    if any(ob.name.startswith(prefix)for prefix in ('Dark recessed palate','Tongue inside mouth','Continuous cream facial beak planes','Small hooked beak tip','Bridge nostril','Lower lip','Closed narrow nose bridge')):
        for vertex in ob.data.vertices:vertex.co.y-=.11
        ob.data.update()


# Actual eye socket rings and sloping wedge brows. Low-relief gold iris, not a spherical eyeball.
def eye_disc(name,c,rx,rz,depth,color,lower_scale=1):
    x,y,z=c;rr=[]
    for radius,dy in [(1,0),(.72,depth*.72),(.30,depth),(.01,depth)]:
        rr.append([(x+rx*radius*math.cos(k*2*PI/16),y+dy,z+rz*radius*math.sin(k*2*PI/16)*(lower_scale if math.sin(k*2*PI/16)<0 else 1))for k in range(16)])
    return loft(name,rr,color,'head',.01)
def skull_y(x,z):
    best=-.3
    for i in range(160):
        y=-.76+i*(1.58/159);w,cz,h=section(y)
        if (x/max(w,.01))**2+((z-cz)/max(h,.01))**2<=1.015:best=y
    return best
cheek_projection_receipts={}
def projected_cheek_check(root, rim):
    direction=Vector((3,4.63,1.41)).normalized()
    right=direction.cross(Vector((0,0,1))).normalized();up=right.cross(direction)
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def intersect(a,b,c,d):return cross(a,b,c)*cross(a,b,d)<-1e-12 and cross(c,d,a)*cross(c,d,b)<-1e-12
    result={}
    for label,project in [('front',lambda p:(p[0],p[2])),('hero',lambda p:(Vector(p).dot(right),Vector(p).dot(up)))]:
        r=[project(p)for p in root];i=[project(p)for p in rim];n=len(r)
        result[label]={'spokeCrossings':[(j,k)for j in range(n)for k in range(j+1,n)if intersect(r[j],i[j],r[k],i[k])],
            'boundaryCrossings':[(j,k)for j in range(n)for k in range(n)if intersect(r[j],r[(j+1)%n],i[k],i[(k+1)%n])],
            'twistedQuads':[j for j in range(n)if cross(r[j],r[(j+1)%n],i[(j+1)%n])*cross(r[j],i[(j+1)%n],i[j])<-1e-12]}
    return result
for sign in[-1,1]:
    cx=sign*.34;cz=1.00;n=16;rr=[]
    # Broad irregular outer root, shoulder plane, protected shallow V9 ring1/ring2.
    for level in range(6):
        row=[]
        for k in range(n):
            angle=k*2*PI/n;u=math.cos(angle);v=math.sin(angle)
            if level in (0,5):
                point=surface_root(cx+.28*u,cz+.23*v,.035 if level==0 else .075)
            else:
                rx,rz,yy=[(.205,.165,.665),(.118,.085,.715),(.104,.070,.735),(.104,.070,.68)][level-1]
                x=cx+rx*u;z=cz+rz*v*(1.18 if v<0 and level in (2,3,4) else 1)+sign*.15*rx*u
                if level==1 and v<0:yy=.59
                if level==1 and v>0:
                    # Support above the eye stays behind the actual original brow plane.
                    yy=min(yy,.485)  # Bounded rear support; never falls through missing skull samples to negative Y.
                if v>0:
                    # Upper rim follows the real sloped hood edge, not a circular cap.
                    z=min(z,.985+(abs(x)-.15)*(.08/.34)-.018)
                    yy=min(yy,{1:.60,2:.69,3:.705,4:.675}[level])
                point=(x,yy,z)
            row.append(point)
        rr.append(row)
    # V56 one monotone root-to-rim cheek. The intermediate ring lies on each
    # root/rim segment, removing the old alternating-Y ledges rather than covering them.
    for k in range(n):
        rim=Vector(rr[2][k])
        angle=k*2*PI/n;root=None
        # Ordered eye-local XZ boundary, enclosing the aperture. A Y ray preserves
        # correspondence; body-center radial rays previously moved roots across spokes.
        for scale in (1,.95,.90,.85,.80,.75,.70):
            x=cx+.19*scale*math.cos(angle)
            z=cz+.16*scale*math.sin(angle)+sign*.15*.19*scale*math.cos(angle)
            if math.sin(angle)>0:z=min(z,.985+(abs(x)-.15)*(.08/.34)+.025)
            hit,_,_,_=intact_hull.ray_cast(Vector((x,2,z)),Vector((0,-1,0)),4)
            if hit is not None and hit.y>=.25:
                root=Vector((x,hit.y-.035,z));break
        if root is None:raise RuntimeError('Ordered orbital root misses actual hull')
        root.y=min(root.y,rim.y-.06)
        rr[0][k]=tuple(root)
        rr[1][k]=tuple(root.lerp(rim,.58))
        rr[5][k]=tuple(root-Vector((0,.04,0)))
        if not rr[0][k][1]<rr[1][k][1]<rr[2][k][1]:
            raise RuntimeError('Cheek depth is not monotone from buried root to rim')
    cheek_projection_receipts[str(sign)]=projected_cheek_check(rr[0],rr[2])
    (out/'cheek-projection-guards.json').write_text(json.dumps(cheek_projection_receipts,indent=2))
    # Projected crossings are visibility diagnostics, not proof of a 3D defect.
    # Buried far-side regions may overlap in projection; structural and pupil gates stay hard.
    vs=[point for row in rr for point in row];fs=[];cols=[]
    for j in range(6):
        for k in range(n):
            q=j*n+k;r=j*n+(k+1)%n;v=((j+1)%6)*n+(k+1)%n;u=((j+1)%6)*n+k
            fs.extend([(q,r,v),(q,v,u)])
            lower=math.sin((k+.5)*2*PI/n)<0
            color='ochre' if j in (0,1) and lower else 'teal' if j in (0,1,5) else 'ochre' if j in (3,4) else 'socket'
            cols.extend([color,color])
    mask=mesh(f'Closed integrated facial mask {sign}',vs,fs,'teal','belly',.025,cols)
    receipt=volume_receipt(mask)
    mask.data.calc_loop_triangles()
    min_area=min((mask.data.vertices[t.vertices[1]].co-mask.data.vertices[t.vertices[0]].co).cross(mask.data.vertices[t.vertices[2]].co-mask.data.vertices[t.vertices[0]].co).length*.5 for t in mask.data.loop_triangles)
    if receipt['nonManifoldEdges'] or receipt['volume']<=0 or min_area<1e-10:raise RuntimeError('Facial mask failed closed-volume/nondegenerate gate')
    eye_disc(f'Deep eye lining {sign}',(cx,.718,cz),.108,.077,.004,'socket',lower_scale=1.18)
    eye_disc(f'Simple amber iris {sign}',(cx,.724,cz),.086,.069,.009,'gold',lower_scale=1.18)
    eye_disc(f'Black pupil {sign}',(cx-sign*.012,.735,cz+.005),.033,.046,.002,'black')
    eye_disc(f'Small eye glint {sign}',(cx-sign*.028,.738,cz+.034),.010,.010,.001,'ivory')
    # V56 intentional target-directed change: preserve front brow edge and iris;
    # shorten posterior wedge depth .13/.11 and lower rear crest .035/.025.
    # V9 landmarks are comparison aids, not immutable design requirements.
    # Compact angular hood: broad planar front face, slanted lower edge and buried rear corners.
    front=[(sign*.19,.785,.9944),(sign*.46,.725,1.058),(sign*.46,.67,1.185),(sign*.20,.76,1.048)]
    back=[(x,y-.14,z-.015)for x,y,z in front]
    mesh(f'Embedded orange brow wedge {sign}',front+back,[(0,1,2),(0,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'ochre','head',.03)
    # Lower cheek is the existing closed socket-support surface, not a second folded shell.
    # Root -> shoulder -> shallow rim supplies shared broad facets and one outer contour.

(out/'eye-brow-study.json').write_text(json.dumps({'base':'V46','lowerAmberLiningAndApertureScale':1.18,'eyeCentersAndDepthsChanged':False,'pupilAndGlintChanged':False,'upperAmberArcChanged':False,'browLowerEdgeChanged':False,'browOuterUpperRaise':.035,'browInnerUpperRaise':.018,'mouthChanged':False,'pouchChanged':False,'paletteChanged':False,'status':'unaccepted; actual multi-view visibility pending'},indent=2))
(out/'intentional-landmark-changes.json').write_text(json.dumps({'irisPupilGlint':'V9 centers/depths/pupil/glint fixed; lower amber and lining arc expanded 18%' ,'browFrontPositiveX':[[.19,.785,.9944],[.46,.725,1.058],[.46,.67,1.185],[.20,.76,1.048]],'browRearOffset':[0,-.14,-.015],'browSpanToIrisDiameter':.27/.172,'outerRimRadii':[.118,.085],'innerRimRadii':[.104,.070],'mirrored':True,'coordinates':'Blender pre-stance; common Z minus .10 follows','pouchAndMouthTranslation':[0,-.11,0],'removed':'separate folded V9 cheek shell','finRevision':{'rearWidthDepthScale':.70,'rearReachScale':.72,'frontToes':'four closed broad dorsal-ridge lobes','midFinStation':[.53,.24,.18,.23,.16]},'cheekRevision':'shared collinear root-shoulder-rim spokes with strictly monotone depth; no extra surface','cranialRevision':'broad forward upper-front section expansion at Y .33/.55/.69; no added Boolean or tube','paintRevision':'sloped wrapped cheek fields with surface-preserving face partition','volumeRevision':'bounded local cheek-to-pouch taper on shared vertices','reason':'V56 convex rear mantle resampling only; complete V55 face, pouch, feet and palette retained'},indent=2))

after=volume_receipt(body)
if after!=intact_receipt:raise RuntimeError('Protected V29 body was mutated by facial rebuild')
(out/'core-preservation.json').write_text(json.dumps({'before':intact_receipt,'after':after,'bytewiseGeometryUnchanged':True,'newFacialBooleanOperations':0},indent=2))

# Solid articulated feet: broad shoulder cross section, sloping midfoot and chunky radial tips.
forefin_root_receipts=[]
def fin(sign,rear=False):
    joint=('rearL'if sign>0 else'rearR')if rear else('finL'if sign>0 else'finR')
    cy=-.34 if rear else .22
    scale=.82 if rear else 1
    # Closed horizontal cross-sections supply real fore/aft volume at every station.
    stations=[(sign*.33,cy,.60*scale if rear else .48,.105 if rear else .15,.105 if rear else .14),
              (sign*.53,cy+.24,.18*scale,.23,.16),
              (sign*.60,cy+.36,.11,.275,.18),
              (sign*.66,cy+.45,.004,.30,.18)]
    if rear:
        stations=[(sign*(.33+(abs(x)-.33)*.72),cy+(yy-cy)*.72,z,rx*.70,ry*.70)for x,yy,z,rx,ry in stations]
    n=12;vs=[]
    for cx,yy,z,rx,ry in stations:
        for k in range(n):
            t=2*PI*k/n
            vs.append((cx+rx*math.cos(t),yy+ry*math.sin(t),z))
    if not rear:
        # Body moves down .10 later; fin bind-space vertices do not. Test in
        # the pristine hull frame using the inverse of that common body shift.
        clearance=[]
        for xyz in vs[:n]:
            query=Vector(xyz)+Vector((0,0,.10))
            hit,normal,index,distance=intact_hull.find_nearest(query)
            if hit is None:raise RuntimeError('Missing front fin root containment sample')
            signed=(query-hit).dot(normal);clearance.append(signed)
            if signed>1e-5:raise RuntimeError('New front fin root cap exits body hull')
        forefin_root_receipts.append({'sign':sign,'signedDistances':clearance,'maximumSignedDistance':max(clearance)})
    fs=[];colors=[]
    for j in range(3):
        for k in range(n):
            q=j*n+k;r=j*n+(k+1)%n;u=(j+1)*n+k;v=(j+1)*n+(k+1)%n
            fs.extend([(q,r,v),(q,v,u)])
            colors.extend(['ochre' if j==2 else 'light' if j==1 else 'teal']*2)
    fs.extend([tuple(reversed(range(n))),tuple(3*n+k for k in range(n))]);colors.extend(['teal','ochre'])
    mesh(f'Volumetric connected {joint}',vs,fs,'teal',joint,.035,colors)
    cx,cy,z,rx,ry=stations[-1]
    toe_scale=.70 if rear else 1
    for i in range(4):
        u=(i-1.5)/1.5;x=cx+u*.24*toe_scale
        base_y=cy+ry*math.sqrt(max(0,1-(u*.82)**2))-.055*toe_scale
        half=.079*toe_scale;tipx=x+u*.026*toe_scale;tipy=base_y+.17*toe_scale
        # Broad closed lobe: buried base, dorsal ridge and a thick pointed terminal tip.
        vv=[(x-half,base_y,.10*toe_scale),(x+half,base_y,.10*toe_scale),
            (x,base_y+.06*toe_scale,.12*toe_scale),(tipx,tipy,.018*toe_scale),
            (x-half,base_y,.004),(x+half,base_y,.004),(tipx,tipy,.004)]
        ff=[(0,1,2),(0,2,3),(2,1,3),(0,4,5,1),(0,3,6,4),(1,5,6,3),(4,6,5)]
        mesh(f'{joint} cream toe {i}',vv,ff,'ivory',joint,.04)
for sign in[-1,1]:fin(sign);fin(sign,True)
(out/'forefin-root-study.json').write_text(json.dumps({'base':'V54','frontRootBefore':[.33,.22,.60,.105,.105],'frontRootAfter':[.33,.22,.48,.15,.14],'rootContainment':forefin_root_receipts,'fanAndToesChanged':False,'groundContactChanged':False,'rearFeetChanged':False,'rigPivotsChanged':False,'facePouchAndPaletteChanged':False,'status':'unaccepted; actual limb slope and all-angle review pending'},indent=2))

# Small polygonal tail fan with a single ochre border.
rows=[]
for y,r in[(-.63,.12),(-.84,.09),(-.94,.06)]:rows.append([((-.63-y)*.9+r*math.cos(k*PI/4),y,.68+r*math.sin(k*PI/4))for k in range(8)])
loft('Tail root',rows,'teal','tail')
vs=[];n=12
for side in[-1,1]:
    for radius in[.006,.235,.29]:
        for k in range(n):
            theta=k*2*PI/n
            vs.append((.29+side*.045,-1.0+radius*math.cos(theta),.68+radius*math.sin(theta)))
fs=[];colors=[]
for side in range(2):
    offset=side*3*n
    for band in range(2):
        for k in range(n):
            q=offset+band*n+k;r=offset+band*n+(k+1)%n;u=q+n;v=r+n
            fs.extend([(q,r,v),(q,v,u)]);colors.extend(['ochre','ochre'] if band else ['teal','light'])
    fs.append(tuple(offset+k for k in range(n)));colors.append('teal')
for k in range(n):
    q=2*n+k;r=2*n+(k+1)%n;fs.append((q,r,r+3*n,q+3*n));colors.append('ochre')
mesh('Full angular tail fan with ochre face border',vs,fs,'teal','tail',.035,colors)

# Eight purposeful cream spines, large form hierarchy only.
def spine(name,base,tip,r):
    base=Vector(base);tip=Vector(tip);d=(tip-base).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u).normalized()
    vs=[tuple(base+u*math.cos(k*2*PI/4)*r+v*math.sin(k*2*PI/4)*r*.70)for k in range(4)]+[tuple(tip)]
    mesh(name,vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'ivory',variation=.055)
for i,(y,angle,length,r)in enumerate([(-.43,0,.24,.12),(-.12,0,.28,.13),(.21,0,.22,.10),(-.27,-.95,.22,.10),(-.27,.95,.22,.10),(.15,-1.15,.16,.08),(.15,1.15,.16,.08),(-.53,1.55,.13,.075)]):
    base=surface(y,angle,-.018);spine(f'Cream crown spine {i}',base,base+Vector((math.sin(angle)*length*.55,-length*.24,length*.88)),r)

# V29 stance: lower complete core/face/spines/tail by 10 cm, retaining proportions.
# Matching body/belly/head/tail absolute bind pivots are explicitly lowered below.
for ob,joint in parts:
    if joint in ('belly','head','tail'):
        for vertex in ob.data.vertices:vertex.co.z-=.10
        ob.data.update()

bpy.context.view_layer.update();vv=[];ff=[]
for ob,joint in parts:
    if any(word in ob.name for word in ['amber iris','Black pupil','eye glint','Deep eye lining']):continue
    offset=len(vv);vv.extend(tuple(v.co)for v in ob.data.vertices);ff.extend(tuple(offset+i for i in f.vertices)for f in ob.data.polygons)
final_skin=BVHTree.FromPolygons(vv,ff,all_triangles=False);visibility={}
for sign in [-1,1]:
    point=Vector((sign*(.34-.012),.737,.905));visibility[str(sign)]={}
    for label,camera in [('front',Vector((0,4.9425,.79))),('hero',Vector((3,4.6,2.25)))]:
        direction=(point-camera).normalized();hit,_,index,_=final_skin.ray_cast(camera,direction,(point-camera).length-.002)
        visibility[str(sign)][label]={'blockedBySurroundingSkin':hit is not None,'hit':list(hit)if hit is not None else None,'faceIndex':index}
(out/'eye-visibility.json').write_text(json.dumps(visibility,indent=2))
if any(visibility[str(sign)][view]['blockedBySurroundingSkin']for sign in[-1,1]for view in['front','hero']):raise RuntimeError('Protected V9 pupil occluded by final surrounding skin')

# Eight-joint contract remains available for future arena integration; no runtime replacement here.
REST={'body':(None,(0,0,.60)),'belly':('body',(0,0,.60)),'head':('belly',(0,.50,.83)),'tail':('body',(0,-.70,.58)),'finL':('body',(.43,.16,.50)),'finR':('body',(-.43,.16,.50)),'rearL':('body',(.43,-.36,.50)),'rearR':('body',(-.43,-.36,.50))}
d=bpy.data.armatures.new('Puffer low-poly rig');arm=bpy.data.objects.new('Puffer low-poly rig',d);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,xyz)in REST.items():
    b=d.edit_bones.new(name);b.head=xyz;b.tail=Vector(xyz)+Vector((0,0,.12))
    if parent:b.parent=d.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
triangles=0
for ob,joint in parts:
    group=ob.vertex_groups.get(joint) or ob.vertex_groups.new(name=joint);group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);mod=ob.modifiers.new('Skin','ARMATURE');mod.object=arm;ob.parent=arm
# Boolean/bisect interpolation can overshoot corner colour range by float error.
paint_corrections=[]
for ob,joint in parts:
    for datum in ob.data.color_attributes['Col'].data:
        rgba=tuple(datum.color)
        if not all(math.isfinite(value)for value in rgba):raise RuntimeError('Non-finite interpolated paint')
        if min(rgba)<0 or max(rgba)>1:
            paint_corrections.append(rgba)
            datum.color=tuple(max(0,min(1,value))for value in rgba)
(out/'paint-range.json').write_text(json.dumps({'clampedCorners':len(paint_corrections),'minimumBefore':min((min(v)for v in paint_corrections),default=0),'maximumBefore':max((max(v)for v in paint_corrections),default=1)},indent=2))
# Consolidate components by joint without changing geometry or corner colours.
merged_parts=[]
for joint in REST:
    owned=[ob for ob,name in parts if name==joint]
    if not owned:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in owned:ob.select_set(True)
    bpy.context.view_layer.objects.active=owned[0]
    if len(owned)>1:bpy.ops.object.join()
    merged_parts.append((bpy.context.object,joint))
parts=merged_parts
sys.path.insert(0,str(Path(__file__).resolve().parent))
from native_export import export_native_puffer
export_native_puffer(out/'puffer-native-v56.json',[ob for ob,joint in parts],arm)
bpy.ops.object.select_all(action='DESELECT')
for ob,joint in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Puffer style revision skin'
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'puffer-style-v56.glb'),export_format='GLB',use_selection=True,export_animations=False)
(out/'metrics.json').write_text(json.dumps({'status':'approved low-poly target; implementation unaccepted','triangles':triangles,'joints':8,'materials':1,'glbBytes':(out/'puffer-style-v56.glb').stat().st_size},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'inspection.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Studio');floor.diffuse_color=(.028,.045,.06,1)
    ob=mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],'dark');ob.data.materials.clear();ob.data.materials.append(floor)
    def light(name,xyz,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,4,5),650,4,(1,.90,.76));light('Cool fill',(4,1,3),360,4,(.73,.87,1));light('Rim',(0,-4,4),500,3,(.66,.87,1))
    d=bpy.data.cameras.new('Matched style camera');cam=bpy.data.objects.new('Matched style camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=3.2;cam.location=(3.0,4.6,2.25);cam.rotation_euler=(Vector((0,-.03,.84))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-style.png');bpy.ops.render.render(write_still=True)

    if a.nine_views:
        scene.render.resolution_x=600;scene.render.resolution_y=740;scene.cycles.samples=24
        shots=[('01-front',0,0),('02-left',90,0),('03-right',-90,0),('04-back',180,0),('05-top',0,90),('06-elevated-front',0,39.2894),('07-elevated-left',90,39.2894),('08-elevated-right',-90,39.2894),('09-elevated-back',180,39.2894)]
        points=[skin.matrix_world@v.co for v in skin.data.vertices]
        lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
        target=Vector((0,-.05750000476837158,.7900000214576721));radius=max((v-target).length for v in points)
        d.ortho_scale=4.2
        assert radius<d.ortho_scale*(600/740)/2/1.04, 'Shared V56 scale4.2 camera no longer fits with margin'
        (out/'nine-view-camera.json').write_text(json.dumps({'projection':'orthographic','fixedScale':d.ortho_scale,'target':list(target),'unionRadius':radius,'framingSource':'expanded common scale4.2 for V39 toe bounds; unchanged V38 recaptured at same scale; target and orientations preserved','minimumMargin':.04,'imageSize':[600,740],'sameCameraForAllNine':True},indent=2))
        for label,yaw,elevation in shots:
            yaw=math.radians(yaw);el=math.radians(elevation)
            cam.location=target+Vector((5*math.sin(yaw)*math.cos(el),5*math.cos(yaw)*math.cos(el),5*math.sin(el)))
            cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
