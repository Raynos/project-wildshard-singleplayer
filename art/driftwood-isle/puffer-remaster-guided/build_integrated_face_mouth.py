"""Replace a real V71 front/pouch surface patch, retaining the stronger volume.

Constrained triangulation uses the original boundary and authored interior
samples projected onto V71. No arbitrary planar body, whole-body remesh or
Boolean union. Native source stays immutable. Clay views are the first gate.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
from collections import defaultdict,Counter
import bpy,bmesh
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
EXPECTED='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:raise RuntimeError('V71 source pin changed')
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--render',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
args.out.mkdir(parents=True,exist_ok=True)
if (args.out/'inspection.blend').exists():raise RuntimeError('Fresh output directory required')
native=json.loads(SOURCE.read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Unaccepted anatomy clay');mat.use_nodes=True
shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.32,.31,.28,1);shader.inputs['Roughness'].default_value=.85

# Exact positional welding within each native part, preserving original faces.
meshes=[]
for part in native['parts']:
    lookup={};verts=[];faces=[]
    pos=part['positions']
    for i in range(0,len(pos),9):
        face=[]
        for k in (0,6,3):
            game=pos[i+k:i+k+3];point=(game[0],game[2],game[1])
            if point not in lookup:lookup[point]=len(verts);verts.append(point)
            face.append(lookup[point])
        faces.append(tuple(face))
    meshes.append((part,verts,faces))
part,vertices,faces=meshes[0]
uses=defaultdict(list)
for fi,f in enumerate(faces):
    for a,b in zip(f,f[1:]+f[:1]):uses[tuple(sorted((a,b)))].append(fi)
adjacency=defaultdict(set)
for fs in uses.values():
    for a in fs:adjacency[a].update(fs)
unvisited=set(range(len(faces)));components=[]
while unvisited:
    seed=unvisited.pop();component={seed};todo=[seed]
    while todo:
        for n in adjacency[todo.pop()]:
            if n in unvisited:unvisited.remove(n);component.add(n);todo.append(n)
    components.append(component)
core=max(components,key=len)
if len(core)!=1022:raise RuntimeError('Frozen V71 main hull component changed: '+str(len(core)))

def normal(f,points=vertices):
    a,b,c=[Vector(points[i])for i in f];return (b-a).cross(c-a).normalized()
patch={i for i in core if normal(faces[i]).y>.20 and all(.16<vertices[j][2]<1.14 and vertices[j][1]>.12 for j in faces[i])}
# The original mouth back cap is a separate-depth surface at Blender Y=.51.
# Preserve its original faces; it cannot share an X/Z parameter domain with
# the exterior rim above it. This is the measured frozen V71 cavity plane.
preserved_mouth_cap={i for i in patch if all(abs(vertices[j][1]-.51)<1e-6 for j in faces[i])}
patch-=preserved_mouth_cap
# Preserve one full face-adjacency collar around inherited folds/overhangs.
# Their measured geometry is not flattened or filled to fit the projection.
fold_faces={i for i in core if normal(faces[i]).y<=.20 and all(.16<vertices[j][2]<1.14 and vertices[j][1]>.12 for j in faces[i])}
protected_collar=fold_faces|{j for i in fold_faces for j in adjacency[i]}
patch-=protected_collar
pending=set(patch);patch_components=[]
while pending:
    seed=pending.pop();component={seed};queue=[seed]
    while queue:
        for neighbor in adjacency[queue.pop()]:
            if neighbor in pending:pending.remove(neighbor);component.add(neighbor);queue.append(neighbor)
    patch_components.append(component)
small_islands=set().union(*(component for component in patch_components if len(component)<8))
patch-=small_islands
# Keep only connected front components substantial enough to form one patch.
# All selected components are retained; each boundary is constrained separately.
if len(patch)<30:raise RuntimeError('No meaningful front region selected')
patch_edges=Counter(tuple(sorted((a,b)))for i in patch for a,b in zip(faces[i],faces[i][1:]+faces[i][:1]))
boundary={e for e,n in patch_edges.items()if n==1};boundary_ids=sorted({i for e in boundary for i in e})

# Project X/Z onto the actual outward-facing V71 patch, not an analytic sphere.
def sample(x,z):
    hits=[]
    for fi in patch:
        f=faces[fi];a,b,c=[vertices[i]for i in f]
        den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(den)<1e-14:continue
        u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
        v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
        w=1-u-v
        if min(u,v,w)>=-1e-8:hits.append((u*a[1]+v*b[1]+w*c[1],fi))
    if not hits:return None
    y,fi=max(hits);return (x,y,z),fi

points=[vertices[i]for i in boundary_ids];old_to_input={old:i for i,old in enumerate(boundary_ids)}
constraints=[(old_to_input[a],old_to_input[b])for a,b in boundary]
# Staggered anatomical sampling: upper cheek, full pouch below mouth, lower turn.
# No complete horizontal sample ring or arbitrary old lattice preservation.
authored=[(-.49,.78),(-.32,.75),(-.13,.71),(.13,.71),(.32,.75),(.49,.78),
          (-.46,.59),(-.24,.54),(0,.60),(.24,.54),(.46,.59),
          (-.36,.39),(-.12,.34),(.12,.34),(.36,.39),
          (-.50,.95),(-.28,1.03),(.28,1.03),(.50,.95)]
# Measured V71 bulge/eye-bridge landmarks: prevent the new long chords from
# cutting 22–45 mm into the successful anatomy. These are sparse spatial
# supports, not a reinstated complete latitude lattice.
authored += [(-.3825453818,.3273493052),(-.1774084121,.4025381505),
             (.3162730634,.4025381505),(.0759243965,.3646387160),
             (0,.3759972453),(-.2062675953,1.0055156946),(.2062675953,1.0055156946),
             (-.4372447729,.7945222855),(.4372446537,.7945227623),
             (-.3611912727,.9149006605),(.3611912727,.9149006605)]
def boundary_distance(x,z):
    distances=[]
    for a,b in boundary:
        pa,pb=vertices[a],vertices[b]
        dx,dz=pb[0]-pa[0],pb[2]-pa[2]
        length=dx*dx+dz*dz
        t=max(0,min(1,((x-pa[0])*dx+(z-pa[2])*dz)/length)) if length else 0
        distances.append(math.hypot(x-pa[0]-t*dx,z-pa[2]-t*dz))
    return min(distances)
accepted=[]
for x,z in authored:
    hit=sample(x,z)
    if hit and boundary_distance(x,z)>.005 and min(math.dist(hit[0],p)for p in points)>.025:
        accepted.append({'point':hit[0],'sourceFace':hit[1]});points.append(hit[0])
if len(accepted)<6:raise RuntimeError('Too few useful anatomical interior samples')
uv=[Vector((p[0],p[2]))for p in points]
cdt_vertices,cdt_edges,cdt_faces,orig_vertices,_,_=delaunay_2d_cdt(uv,constraints,[],0,1e-9,True)
new_points=[];input_to_output={}
for index,(uvpoint,orig)in enumerate(zip(cdt_vertices,orig_vertices)):
    if len(orig)!=1:raise RuntimeError('CDT moved/merged a protected sample or generated intersection')
    source_index=orig[0];input_to_output[source_index]=index;new_points.append(points[source_index])
if len(input_to_output)!=len(points):raise RuntimeError('CDT dropped sample')
new_faces=[];source_faces=[]
for face in cdt_faces:
    if len(face)!=3:raise RuntimeError('Expected triangular constrained output')
    center=[sum(new_points[i][k]for i in face)/3 for k in range(3)]
    hit=sample(center[0],center[2])
    if hit:
        new_faces.append(tuple(reversed(face)));source_faces.append(hit[1])
new_edges=Counter(tuple(sorted((a,b)))for f in new_faces for a,b in zip(f,f[1:]+f[:1]))
expected_boundary={tuple(sorted((input_to_output[a],input_to_output[b])))for a,b in constraints}
if {e for e,n in new_edges.items()if n==1}!=expected_boundary:raise RuntimeError('Exact patch boundary was not preserved')
if any(n>2 for n in new_edges.values()):raise RuntimeError('Patch overlap/nonmanifold')
# Reuse protected original vertex IDs on the perimeter; only new interior IDs added.
new_to_global={input_to_output[i]:old for i,old in enumerate(boundary_ids)}
for i,point in enumerate(new_points):
    if i not in new_to_global:new_to_global[i]=len(vertices);vertices.append(point)
replacement=[tuple(new_to_global[i]for i in f)for f in new_faces]
result=[f for i,f in enumerate(faces)if i not in patch]+replacement
for f in replacement:
    if normal(f).y<=.10:raise RuntimeError('Replacement inverted or folds behind frontal parameterization')

def audit(points,fs):
    data=bpy.data.meshes.new('Audit temporary');data.from_pydata(points,[],fs);data.update()
    bm=bmesh.new();bm.from_mesh(data)
    if any(not e.is_manifold for e in bm.edges):raise RuntimeError('Closed hull lost manifold boundary')
    if any(f.calc_area()<1e-12 for f in bm.faces):raise RuntimeError('Degenerate surface')
    volume=bm.calc_volume(signed=True)
    if volume<=0:raise RuntimeError('Nonpositive signed volume')
    bm.free();bpy.data.meshes.remove(data);return volume
def concave_hinge(fs):
    uses=defaultdict(list)
    for face_index,face in enumerate(fs):
        for a,b in zip(face,face[1:]+face[:1]):uses[tuple(sorted((a,b)))].append(face_index)
    maximum=0.0
    for edge,neighbors in uses.items():
        if len(neighbors)!=2:continue
        for first,second in (neighbors,neighbors[::-1]):
            face,other=fs[first],fs[second]
            opposite=next(i for i in other if i not in edge)
            maximum=max(maximum,normal(face).dot(Vector(vertices[opposite])-Vector(vertices[face[0]])))
    return maximum
old_hinge=concave_hinge([faces[i]for i in core])
new_hinge=concave_hinge([f for i,f in enumerate(faces)if i in core and i not in patch]+replacement)
if new_hinge>old_hinge+.001:raise RuntimeError('New concave hinge exceeds inherited baseline plus1mm')
before_volume=audit(vertices,[faces[i]for i in core])
after_core=[f for i,f in enumerate(faces)if i in core and i not in patch]+replacement
after_volume=audit(vertices,after_core)
if abs(after_volume/before_volume-1)>.02:raise RuntimeError('Core volume drift exceeds2percent')
# Surface depth loss is measured at original interior samples, not just new vertices.
maximum_depth_loss=0
for old in {i for fi in patch for i in faces[fi]}:
    point=vertices[old]
    for f in replacement:
        a,b,c=[vertices[i]for i in f]
        den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
        if abs(den)<1e-14:continue
        u=((b[2]-c[2])*(point[0]-c[0])+(c[0]-b[0])*(point[2]-c[2]))/den
        v=((c[2]-a[2])*(point[0]-c[0])+(a[0]-c[0])*(point[2]-c[2]))/den
        if min(u,v,1-u-v)>=-1e-8:maximum_depth_loss=max(maximum_depth_loss,abs(point[1]-(u*a[1]+v*b[1]+(1-u-v)*c[1])))
if maximum_depth_loss>.02:raise RuntimeError('Retopology changed source depth by over2cm: '+str(maximum_depth_loss))
# Retain the established signed Euclidean attachment and silhouette gates.
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(ROOT/'art/driftwood-isle/approved-puffer'))
from puffer_surface_clearance import classify_surface_point
from puffer_surface_topology import validate_closed_surface
from convex_puffer_pouch import silhouette_directions
base_core=[faces[i]for i in core]
validate_closed_surface(vertices,base_core);validate_closed_surface(vertices,after_core)
old_tree=BVHTree.FromPolygons(vertices,base_core,all_triangles=True)
new_tree=BVHTree.FromPolygons(vertices,after_core,all_triangles=True)
queries=[]
for item,vs,fs in meshes[1:]:
    if not any(word in item['name'].lower() for word in ('fin','rear')):continue
    for index,point in enumerate(vs):
        nearest=old_tree.find_nearest(Vector(point))
        old=classify_surface_point(point,vertices,base_core,nearest[3])
        if old['signedEuclideanDistance']<-.001:queries.append((item['name'],index,point))
for component in components:
    if len(component)!=6:continue
    ids={i for fi in component for i in faces[fi]}
    if len(ids)!=5:continue
    highest=max(ids,key=lambda i:vertices[i][2])
    queries.extend(('inherited spine cap',i,vertices[i])for i in ids if i!=highest)
attachment_rows=[]
for name,index,point in queries:
    old_hit=old_tree.find_nearest(Vector(point));new_hit=new_tree.find_nearest(Vector(point))
    old=classify_surface_point(point,vertices,base_core,old_hit[3]);new=classify_surface_point(point,vertices,after_core,new_hit[3])
    row={'part':name,'vertex':index,'point':point,'before':old,'after':new};attachment_rows.append(row)
    if new['signedEuclideanDistance']>old['signedEuclideanDistance']+.001:raise RuntimeError('Attachment clearance worsened beyond1mm: '+str(row))
    if old['signedEuclideanDistance']<-.001 and new['signedEuclideanDistance']>=0:raise RuntimeError('Previously buried attachment exposed')
old_ids={i for face in base_core for i in face};new_ids={i for face in after_core for i in face}
directions=silhouette_directions([(0,1,0),(1,0,0),(0,0,1),(3,4.63,1.41),(0,1,.82),(1,0,.82)],180)
def support(indices,d):return max(sum(vertices[i][k]*d[k]for k in range(3))for i in indices)
support_drift=max(abs(support(old_ids,d)-support(new_ids,d))for d in directions)
minimum_extent=min(max(vertices[i][k]for i in old_ids)-min(vertices[i][k]for i in old_ids)for k in range(3))
if support_drift>minimum_extent*.01:raise RuntimeError('Projected core support changed over1percent')
(args.out/'attachment-clearance.json').write_text(json.dumps({'queries':attachment_rows,'inheritedSpineCaveat':'Inherited exposed corners are compared, not claimed buried','supportDrift':support_drift,'minimumExtent':minimum_extent},indent=2)+'\n')
receipt={'status':'unaccepted V71-guided surface replacement','sourceNativeSha256':EXPECTED,'sourceCoreTriangles':len(core),'protectedFoldFaceIds':sorted(fold_faces),'protectedCollarFaceIds':sorted(protected_collar),'smallIslandsRetainedExact':sorted(small_islands),'preservedMouthBackTriangles':len(preserved_mouth_cap),'removedPatchTriangles':len(patch),'newPatchTriangles':len(replacement),'boundaryVerticesExact':len(boundary_ids),'authoredSamples':accepted,'oldMaximumConcaveHinge':old_hinge,'newMaximumConcaveHinge':new_hinge,'oldVolume':before_volume,'newVolume':after_volume,'maximumSourceDepthDeviation':maximum_depth_loss,'outsidePatchTrianglesExact':True,'faceAssembliesAndAppendagesUnchanged':True}
(args.out/'preflight.json').write_text(json.dumps(receipt,indent=2)+'\n')
# Integrated orbital structural study: source-only WIP until its actual gate.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from integrated_orbital_surface_baselinehood import replace_orbits,component_faces
vertices,result,orbital_receipts=replace_orbits(vertices,result)
from puffer_surface_topology import validate_closed_surface
validate_closed_surface(vertices,result)
orbital_volume=audit(vertices,[result[i]for i in component_faces(result)[0]])
if abs(orbital_volume/after_volume-1)>.02:raise RuntimeError('Integrated face core volume drift exceeds2percent')
meshes[0]=(part,vertices,result)
# Remove only the two old named-generator brow components. All eye-disc,
# nostril, tongue and mouth buffers remain exact in this first structural gate.
headpart,headpoints,headfaces=meshes[1]
brows=[c for c in component_faces(headfaces)if len(c)==14]
if len(brows)!=2:raise RuntimeError('Expected two original14-triangle brow solids')
removed=set().union(*brows)
meshes[1]=(headpart,headpoints,[f for i,f in enumerate(headfaces)if i not in removed])
# Coherent connected mouth branch, preserving the selected orbital surfaces.
from integrated_mouth_surface import replace_mouth
vertices,result,mouth_receipt=replace_mouth(vertices,result,sum(row['newSurfaceTriangles']for row in orbital_receipts))
validate_closed_surface(vertices,result)
mouth_volume=audit(vertices,[result[i]for i in component_faces(result)[0]])
if abs(mouth_volume/orbital_volume-1)>.02:raise RuntimeError('Connected mouth volume drift exceeds2percent')
meshes[0]=(part,vertices,result)
headpart,headpoints,headfaces=meshes[1]
old_lips=[c for c in component_faces(headfaces)if len(c)in(36,56,4)]
if sorted(map(len,old_lips))!=[4,36,56]:raise RuntimeError('Original mouth components are ambiguous')
removed=set().union(*old_lips)
meshes[1]=(headpart,headpoints,[f for i,f in enumerate(headfaces)if i not in removed])
mouth_receipt.update(status='unaccepted connected mouth study',oldVolume=orbital_volume,newVolume=mouth_volume,removedOldHeadMouthTriangles=len(removed),eyeTongueNostrilsUnchanged=True)
(args.out/'integrated-mouth-preflight.json').write_text(json.dumps(mouth_receipt,indent=2)+'\n')
(out_receipt:=args.out/'integrated-orbital-preflight.json').write_text(json.dumps({'status':'unaccepted orbital-only structural stage; mouth integration pending','orbitalRegions':orbital_receipts,'removedOriginalBrowTriangles':28,'eyeAndMouthComponentsUnchanged':True,'newCoreVolume':orbital_volume,'guideCoreVolume':after_volume},indent=2)+'\n')
for part,verts,fs in meshes:
    used=sorted({i for face in fs for i in face});remap={old:new for new,old in enumerate(used)}
    data=bpy.data.meshes.new(part['name']);data.from_pydata([verts[i]for i in used],[],[tuple(remap[i]for i in face)for face in fs]);data.update();data.materials.append(mat)
    ob=bpy.data.objects.new(part['name'],data);bpy.context.collection.objects.link(ob)
bpy.ops.wm.save_as_mainfile(filepath=str((args.out/'inspection.blend').resolve()))
if args.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100;scene.world.color=(.18,)*3;scene.view_settings.view_transform='AgX'
    for name,loc,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Fixed guide comparison');cam=bpy.data.objects.new('Fixed guide comparison',data);bpy.context.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.2
    for name,yaw,elevation in [('hero',32.94,14.34),('front',0,0),('side',90,0)]:
        y,e=math.radians(yaw),math.radians(elevation);target=Vector((0,-.03,.84));cam.location=target+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((args.out/('clay-'+name+'.png')).resolve());bpy.ops.render.render(write_still=True)
print(json.dumps(receipt))
