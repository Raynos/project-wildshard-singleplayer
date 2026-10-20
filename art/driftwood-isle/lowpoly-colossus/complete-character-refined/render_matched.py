"""Freshly capture baseline and candidate with identical inherited cameras and lights."""
import argparse,hashlib,json,runpy,sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--candidate-only',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
base=Path(__file__).resolve().parent
views=[('hero',(7,-15,7.4)),('front',(0,-1,0)),('left',(-1,0,0)),('right',(1,0,0)),('back',(0,1,0)),('top',(0,-.001,1)),('diag-front',(0,-1,.65)),('diag-left',(-1,-1,.65)),('diag-right',(1,-1,.65)),('diag-back',(1,1,.65))]
records=[]
for version,source in [('predecessor',base.parent/'complete-character-next/build_colossus_complete.py'),('candidate',base/'build_colossus_complete.py')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.context.scene.world=bpy.data.worlds.new('World')
 dest=out/version;dest.mkdir(exist_ok=True)
 sys.argv=[str(source),'--','--out',str(dest)]
 g=runpy.run_path(str(source),run_name='__main__');scene=bpy.context.scene
 bpy.ops.wm.save_as_mainfile(filepath=str(dest/'editable-source.blend'))
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
 scene.render.resolution_x=525;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='Standard'
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08));floor=bpy.context.object;m=bpy.data.materials.new('Review floor');m.diffuse_color=(.025,.04,.055,1);floor.data.materials.append(m)
 def aim(ob,p):ob.rotation_euler=(p-ob.location).to_track_quat('-Z','Y').to_euler()
 for name,loc,energy,size in [('Key',(-4,-6,9),1500,5),('Fill',(5,-3,5),850,4),('Rim',(0,4,7),1800,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.name=name;ob.data.energy=energy;ob.data.shape='DISK';ob.data.size=size;aim(ob,Vector((0,0,3)))
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=7.7;scene.camera=cam
 target=Vector((0,0,2.90))
 for name,direction in views:
  cam.location=Vector(direction) if name=='hero' else target+Vector(direction).normalized()*18
  aim(cam,target);scene.render.filepath=str(dest/(name+'.png'));bpy.ops.render.render(write_still=True)
  records.append({'version':version,'view':name,'position':list(cam.location),'target':list(target),'orthoScale':7.7,'file':str(dest/(name+'.png'))})
(out/'cameras.json').write_text(json.dumps({'fixedWorldLights':True,'matchedFraming':True,'resolution':[525,700],'samples':16,'views':records},indent=2)+'\n')
