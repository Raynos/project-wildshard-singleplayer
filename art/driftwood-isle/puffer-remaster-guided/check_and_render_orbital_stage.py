"""Final-scene orbital visibility and attachment gate; optional matching clay views."""
import argparse,json,math,sys,hashlib
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--scene',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--render',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);args.out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
sys.path.insert(0,str(Path(__file__).resolve().parent));sys.path.insert(0,str(ROOT/'art/driftwood-isle/approved-puffer'))
from integrated_orbital_surface_upper import component_faces
from puffer_surface_topology import validate_closed_surface
from puffer_surface_clearance import classify_surface_point
native_path=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
expected='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
if hashlib.sha256(native_path.read_bytes()).hexdigest()!=expected:raise RuntimeError('Guide changed')
native=json.loads(native_path.read_text())
def native_mesh(part):
    points=[];faces=[];lookup={}
    for i in range(0,len(part['positions']),9):
        face=[]
        for k in(0,6,3):
            x,y,z=part['positions'][i+k:i+k+3];point=(x,z,y)
            if point not in lookup:lookup[point]=len(points);points.append(point)
            face.append(lookup[point])
        faces.append(tuple(face))
    return points,faces
def mesh_data(ob):
    ob.data.calc_loop_triangles()
    return [tuple(ob.matrix_world@v.co)for v in ob.data.vertices],[tuple(t.vertices)for t in ob.data.loop_triangles]
body=bpy.data.objects['Continuous mantle cheek and pouch'];newpoints,newfaces=mesh_data(body);newcore=[newfaces[i]for i in component_faces(newfaces)[0]]
oldpoints,oldfaces=native_mesh(native['parts'][0]);oldcomponents=component_faces(oldfaces);oldcore=[oldfaces[i]for i in oldcomponents[0]]
validate_closed_surface(oldpoints,oldcore);validate_closed_surface(newpoints,newcore)
oldtree=BVHTree.FromPolygons(oldpoints,oldcore,all_triangles=True);newtree=BVHTree.FromPolygons(newpoints,newcore,all_triangles=True)
queries=[]
for part in native['parts'][3:]:
    ps,_=native_mesh(part)
    for i,point in enumerate(ps):
        d=classify_surface_point(point,oldpoints,oldcore,oldtree.find_nearest(Vector(point))[3])['signedEuclideanDistance']
        if d<-.001:queries.append((part['name'],i,point,d))
for component in oldcomponents:
    if len(component)!=6:continue
    ids=sorted({i for fi in component for i in oldfaces[fi]},key=lambda i:oldpoints[i][2])[:4]
    for i in ids:
        point=oldpoints[i];d=classify_surface_point(point,oldpoints,oldcore,oldtree.find_nearest(Vector(point))[3])['signedEuclideanDistance'];queries.append(('spine-cap',i,point,d))
attachments=[];failures=[]
for name,i,point,old in queries:
    new=classify_surface_point(point,newpoints,newcore,newtree.find_nearest(Vector(point))[3])['signedEuclideanDistance']
    attachments.append({'part':name,'index':i,'before':old,'after':new})
    if new>old+.001:failures.append({'kind':'attachment-clearance','part':name,'index':i,'before':old,'after':new})
# All final nonocular surfaces participate in visibility, including mouth/nose.
blockpoints=[];blockfaces=[]
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    ps,fs=mesh_data(ob)
    if ob.name=='Dark recessed palate':
        ocular=set().union(*(c for c in component_faces(fs)if len(c)==124))
        fs=[f for i,f in enumerate(fs)if i not in ocular]
    offset=len(blockpoints);blockpoints.extend(ps);blockfaces.extend(tuple(i+offset for i in f)for f in fs)
blocker=BVHTree.FromPolygons(blockpoints,blockfaces,all_triangles=True)
visibility=[]
for label,yaw,elevation in [('hero',32.94,14.34),('front',0,0)]:
    y,e=math.radians(yaw),math.radians(elevation);direction=Vector((math.sin(y)*math.cos(e),math.cos(y)*math.cos(e),math.sin(e)))
    for sign in(-1,1):
        targets=[('pupil',(sign*.328,.737,.905))]+[('lower-amber-'+str(k),(sign*.34+.05*math.cos(k*math.pi/4),.732,.9-.052*abs(math.sin(k*math.pi/4))))for k in range(1,4)]
        for kind,point in targets:
            point=Vector(point);origin=point+5*direction;hit,normal,index,distance=blocker.ray_cast(origin,-direction,5)
            clear=hit is None or distance>=4.997
            row={'view':label,'side':sign,'sample':kind,'visible':clear,'hit':list(hit)if hit is not None else None,'distance':distance};visibility.append(row)
            if kind=='pupil'and not clear:failures.append({'kind':'pupil-occlusion',**row})
receipt={'status':'passed'if not failures else'failed','sceneSha256':hashlib.sha256(args.scene.read_bytes()).hexdigest(),'baselineNativeSha256':expected,'attachments':attachments,'visibility':visibility,'failures':failures,'inheritedSpineCaveat':'Existing exposed cap corners retained; no all-buried claim.'}
(args.out/'final-scene-guards.json').write_text(json.dumps(receipt,indent=2)+'\n')
if failures:raise RuntimeError('Final-scene guards failed: '+json.dumps(failures))
if args.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100;scene.world.color=(.18,)*3;scene.view_settings.view_transform='AgX'
    for name,loc,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Fixed guide comparison');cam=bpy.data.objects.new('Fixed guide comparison',data);bpy.context.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.2
    for name,yaw,elevation in [('hero',32.94,14.34),('front',0,0),('side',90,0)]:
        y,e=math.radians(yaw),math.radians(elevation);target=Vector((0,-.03,.84));cam.location=target+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((args.out/('clay-'+name+'.png')).resolve());bpy.ops.render.render(write_still=True)
print(json.dumps({"status":"passed","framesRendered":bool(args.render)}))
