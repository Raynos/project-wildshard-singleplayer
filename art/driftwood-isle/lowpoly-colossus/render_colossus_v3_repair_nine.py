"""Actual fixed-world-light nine-view evidence. No model edits or acceptance claim."""
import argparse, json, runpy, sys, math, hashlib
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
source=Path(__file__).with_name('build_colossus_v3_repair.py');sys.argv=[str(source),'--','--out',str(out)]
g=runpy.run_path(str(source),run_name='__main__');parts=g['parts'];scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=525;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='Standard'
points=[ob.matrix_world @ Vector(c) for ob in parts for c in ob.bound_box];lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);center=(lo+hi)*.5
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08));floor=bpy.context.object;m=bpy.data.materials.new('Review floor');m.diffuse_color=(.025,.04,.055,1);floor.data.materials.append(m)
def aim(ob,point):ob.rotation_euler=(point-ob.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size in [('Key',(-4,-6,9),1500,5),('Fill',(5,-3,5),850,4),('Rim',(0,4,7),1800,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.name=name;ob.data.energy=energy;ob.data.shape='DISK';ob.data.size=size;aim(ob,Vector((0,0,3)))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
views=[('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('back',(0,1,0)),('top',(0,-.001,1)),('diag-front',(0,-1,.65)),('diag-left',(-1,-1,.65)),('diag-right',(1,-1,.65)),('diag-back',(1,1,.65))]
scales=[]
for name,direction in views:
 cam.location=center+Vector(direction).normalized()*18;aim(cam,center);q=cam.rotation_euler.to_quaternion();inv=q.inverted();ps=[inv@(v-center) for v in points];scales.append(max(max(v.y for v in ps)-min(v.y for v in ps),(max(v.x for v in ps)-min(v.x for v in ps))/.75)*1.12)
cam.data.ortho_scale=max(scales);records=[]
for name,direction in views:
 cam.location=center+Vector(direction).normalized()*18;aim(cam,center);scene.render.filepath=str(out/('color-v3-repair-'+name+'.png'));bpy.ops.render.render(write_still=True);records.append({'name':name,'position':list(cam.location),'target':list(center),'orthoScale':cam.data.ortho_scale})
(out/'cameras-v3-repair.json').write_text(json.dumps({'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'front':'-Y','fixedWorldLights':True,'views':records},indent=2)+'\n')
