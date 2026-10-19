"""Build complete-pass1 and complete-pass2 then render both through identical union-bounds cameras."""
import argparse,json,runpy,sys,math,shutil
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--height',type=int,default=900);p.add_argument('--samples',type=int,default=20)
p.add_argument('--reuse-baseline',type=Path);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
here=Path(__file__).resolve().parent
sources={'baseline':here.parent/'complete-pass1/build_mantis_complete.py','candidate':here/'build_mantis_complete.py'}
allpoints=[];blends={}
for label,source in sources.items():
 dest=out/label;sys.argv=['build','--','--out',str(dest)];g=runpy.run_path(str(source))
 allpoints.extend([Vector(v.co) for o in g['objects'] for v in o.data.vertices])
 blends[label]=next(dest.glob('*.blend'))
center=Vector(tuple((min(p[i] for p in allpoints)+max(p[i] for p in allpoints))/2 for i in range(3)))
views={'front':(0,-10,0),'left':(-10,0,0),'right':(10,0,0),'back':(0,10,0),'top':(0,-.001,10),'diag-front':(0,-10,8),'diag-left':(-10,0,8),'diag-right':(10,0,8),'diag-back':(0,10,8),'hero':(-5.5,-8,3.4)}
cameras={};aspect=780/1100
for label,offset in views.items():
 location=Vector(offset) if label=='hero' else center+Vector(offset)
 rotation=(center-location).to_track_quat('-Z','Y');local=[rotation.inverted()@(p-location) for p in allpoints]
 xmin,xmax=min(p.x for p in local),max(p.x for p in local);ymin,ymax=min(p.y for p in local),max(p.y for p in local)
 location+=rotation@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
 cameras[label]={'location':list(location),'rotation':list(rotation.to_euler()),'orthoScale':max(ymax-ymin,(xmax-xmin)/aspect)*1.12}
common=max(d['orthoScale'] for k,d in cameras.items() if k!='hero')
for k,d in cameras.items():
 if k!='hero':d['orthoScale']=common
(out/'cameras.json').write_text(json.dumps({'method':'Identical paired transforms; common nine-view union-bounds scale; hero union-bounds scale','cameras':cameras},indent=2))
if a.reuse_baseline:
 prior=json.loads((a.reuse_baseline/'cameras.json').read_text())['cameras']
 assert prior==cameras,'Baseline camera receipt differs; refusing reuse'
 baseline=out/'baseline/mantis-study-complete-pass1.glb'
 assert baseline.read_bytes()==(a.reuse_baseline/'baseline'/baseline.name).read_bytes(),'Baseline GLB differs'
 for image in (a.reuse_baseline/'baseline').glob('*.png'):shutil.copyfile(image,out/'baseline'/image.name)
for label,blend in blends.items():
 if a.reuse_baseline and label=='baseline':continue
 bpy.ops.wm.open_mainfile(filepath=str(blend));scene=bpy.context.scene
 scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=False
 scene.render.resolution_x=round(a.height*aspect);scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
 scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.00209,.00286,.00350,1)
 bpy.ops.mesh.primitive_plane_add(size=100);bpy.context.object.data.materials.append(mat)
 for name,pos,power,size in [('Key',(-3,-4,7),700,4),('Fill',(4,-2,4),400,4),('Rim',(0,5,5),850,3)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Matched');cam=bpy.data.objects.new('Matched',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
 for view,data in cameras.items():
  cam.location=data['location'];cam.rotation_euler=data['rotation'];d.ortho_scale=data['orthoScale']
  scene.render.filepath=str(out/label/(view+'.png'));bpy.ops.render.render(write_still=True)
