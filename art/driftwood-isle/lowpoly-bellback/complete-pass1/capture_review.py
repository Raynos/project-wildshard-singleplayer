"""Pinned complete-geometry Bellback review. Actual Blender stills, no compositing.
--source build_bellback_v5.py --out tmp/bellback-v5-review --shots hero|nine|orbit
Nine views adapt LOOK-LOOP to a fixed inward-facing orthographic model turntable.
Unseen target anatomy is inferred. No runtime or animation acceptance follows.
"""
import argparse, hashlib, json, math, runpy, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True);p.add_argument('--shots',choices=['hero','nine','orbit'],default='hero');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
here=Path(__file__).resolve().parent;source=here/a.source;out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source_sha=digest(source);sys.argv=[str(source),'--','--out',str(out)]
namespace=runpy.run_path(str(source),run_name='__main__')
model=[obj for obj in bpy.context.scene.objects if obj.type=='MESH'];bpy.context.view_layer.update()
vertices=[o.matrix_world@v.co for o in model for v in o.data.vertices]
bounds={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
topology=[]
for obj in model:
 bm=bmesh.new();bm.from_mesh(obj.data)
 topology.append({'name':obj.name,'vertices':len(bm.verts),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'zero_area_faces':sum(f.calc_area()<1e-10 for f in bm.faces)})
 bm.free()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32 if a.shots=='hero' else 16;scene.cycles.use_denoising=False
scene.render.resolution_x=768 if a.shots=='hero' else 520;scene.render.resolution_y=960 if a.shots=='hero' else 640;scene.render.resolution_percentage=100
scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.20;scene.view_settings.gamma=1
mat=namespace['material']('Review ground sRGB','293D4B');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(mat)
lights=[('Key',(-4,-5,7),450,5),('Fill',(0,-5,3),260,4),('Rim',(0,4,6),600,3)]
for name,loc,power,size in lights:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Fixed review camera');cam=bpy.data.objects.new('Fixed review camera',d);bpy.context.collection.objects.link(cam);d.type='ORTHO';d.ortho_scale=5.65;scene.camera=cam;target=Vector((0,-.05,1.65))
shots=[('hero',None,None)] if a.shots=='hero' else ([('01-front',0,0),('02-left',90,0),('03-right',-90,0),('04-back',180,0),('05-top',0,90),('06-diag-front',0,39.2894069),('07-diag-left',90,39.2894069),('08-diag-right',-90,39.2894069),('09-diag-back',180,39.2894069)] if a.shots=='nine' else [(f'orbit-{i:02}',i*30,12) for i in range(12)])
def eye_visibility():
 result=[];depsgraph=bpy.context.evaluated_depsgraph_get()
 for obj in model:
  if 'amber eye' not in obj.name:continue
  # Measure sight-lines to three front-face vertices inset toward their centroid.
  points=[obj.matrix_world@v.co for v in list(obj.data.vertices)[:3]]
  center=sum(points,Vector())/3
  samples=[center]+[center.lerp(v,.65) for v in points]
  blockers=[]
  for pt in samples:
   direction=(target-cam.location).normalized();origin=pt-direction*20;hit,loc,norm,idx,blocker,_=scene.ray_cast(depsgraph,origin,direction,distance=20.001)
   blockers.append(None if not hit or blocker==obj else blocker.name)
  result.append({'eye':obj.name,'visible_samples':sum(x is None for x in blockers),'samples':len(samples),'blockers':blockers})
 return result
records=[]
for name,yaw,elev in shots:
 if yaw is None:cam.location=(-4.4,-8,2.65)
 else:
  az,el=math.radians(yaw),math.radians(elev);cam.location=target+Vector((9*math.sin(az)*math.cos(el),-9*math.cos(az)*math.cos(el),9*math.sin(el)))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 if name=='05-top':cam.rotation_euler=(0,0,math.pi)  # front (-Y) is image-up
 bpy.context.view_layer.update()
 projection=[world_to_camera_view(scene,cam,v) for v in vertices];screen={'min':[min(v[i] for v in projection) for i in range(2)],'max':[max(v[i] for v in projection) for i in range(2)]}
 if min(screen['min'])<.015 or max(screen['max'])>.985:raise ValueError(f'{name}: clipped or poorly bounded model {screen}')
 image=out/(name+'.png');scene.render.image_settings.file_format='PNG';scene.render.filepath=str(image);bpy.ops.render.render(write_still=True)
 records.append({'name':name,'eye_visibility':eye_visibility(),'camera':list(cam.location),'target':list(target),'ortho_scale':d.ortho_scale,'normalized_bounds':screen,'image_sha256':digest(image),'image_bytes':image.stat().st_size})
receipt={'status':'Actual static geometry review; not game capture or visual acceptance','source':str(source.relative_to(here.parent.parent.parent.parent)),'source_sha256':source_sha,'capture_script_sha256':digest(Path(__file__)),'bounds':bounds,'topology':topology,'lights':lights,'shots':records}
(out/('capture-'+a.shots+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
assert digest(source)==source_sha
print('COMPLETE',a.shots,'source',source_sha)
