"""Canonical model-scale half-dome: four cardinal, top, four elevated diagonals.
Rebuilds the unchanged Conch CHARACTER PASS source and renders actual geometry only. +Y is front.
"""
import argparse,json,runpy,sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--samples',type=int,default=16);p.add_argument('--height',type=int,default=700)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
sys.argv=['build','--','--out',str(out)]
g=runpy.run_path(str(Path(__file__).with_name('build_conch_character_pass.py')))
objects=g['objects'];mat=g['mat'];mesh=g['mesh']
points=[o.matrix_world @ v.co for o in objects for v in o.data.vertices]
center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=False
scene.render.resolution_x=round(a.height*780/1100);scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
ground=mat('Dark studio ground',(.027,.037,.045));mesh('Ground',[(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[(0,1,2,3)],[ground])
for name,pos,power,size in [('Key',(-3,4,7),700,4),('Fill',(4,2,4),400,4),('Rim',(0,-5,5),850,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Half dome');cam=bpy.data.objects.new('Half dome',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
views={'front':(0,10,0),'left':(-10,0,0),'right':(10,0,0),'back':(0,-10,0),'top':(0,.001,10),'diag-front':(0,10,8),'diag-left':(-10,0,8),'diag-right':(10,0,8),'diag-back':(0,-10,8)}
cameras={}
# A common scale across all nine views preserves relative proportions.
scale=0
for label,offset in views.items():
 cam.location=center+Vector(offset);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
 local=[cam.matrix_world.inverted() @ p for p in points];xmin,xmax=min(p.x for p in local),max(p.x for p in local);ymin,ymax=min(p.y for p in local),max(p.y for p in local)
 cam.location+=cam.rotation_euler.to_matrix() @ Vector(((xmin+xmax)/2,(ymin+ymax)/2,0));scale=max(scale,ymax-ymin,(xmax-xmin)*scene.render.resolution_y/scene.render.resolution_x)
 cameras[label]={'location':list(cam.location),'rotation':list(cam.rotation_euler)}
d.ortho_scale=scale*1.10
for label,data in cameras.items():
 cam.location=data['location'];cam.rotation_euler=data['rotation'];data['orthoScale']=d.ortho_scale
 scene.render.filepath=str(out/f'color-character-pass-{label}.png');bpy.ops.render.render(write_still=True)
(out/'cameras-character-pass.json').write_text(json.dumps({'front':'+Y','type':'canonical model-scale half dome','cameras':cameras},indent=2))
