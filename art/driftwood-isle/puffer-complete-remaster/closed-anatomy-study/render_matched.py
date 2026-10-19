"""Actual immutable native-bind renders, shared V71 nine cameras plus hero.

No animation or runtime claims. Run only after coordinator releases heavy lane.
"""
import argparse,hashlib,json,math,sys,subprocess
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
p=argparse.ArgumentParser();p.add_argument('--candidate',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
a.out.mkdir(parents=True,exist_ok=True)
if list(a.out.glob('*.webp')):raise RuntimeError('Fresh capture directory required')
paths={'pass2':HERE.parent/'pass2/pass2-native.json','closed-anatomy':a.candidate.resolve()}
data={k:json.loads(v.read_text()) for k,v in paths.items()}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.cycles.seed=0
s.render.resolution_x=600;s.render.resolution_y=740;s.render.resolution_percentage=100;s.world.color=(.18,)*3;s.view_settings.view_transform='AgX'
m=bpy.data.materials.new('Actual native linear vertex palette');m.use_nodes=True
shader=m.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.83
attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col';m.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
objects={};target=Vector((0,-.05750000476837158,.7900000214576721))
for label,native in data.items():
 objects[label]=[]
 for part in native['parts']:
  coords=part['positions'];verts=[(coords[i],coords[i+2],coords[i+1]) for i in range(0,len(coords),3)]
  if max((Vector(v)-target).length for v in verts)>=4.2*(600/740)/2/1.04:raise RuntimeError('Fixed nine-view camera clipping risk')
  faces=[(i,i+2,i+1) for i in range(0,len(verts),3)]
  mesh=bpy.data.meshes.new(label+' '+part['name']);mesh.from_pydata(verts,[],faces);mesh.materials.append(m)
  col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
  for i,c in enumerate(col.data):c.color=part['colorsLinear'][i*3:i*3+3]+[1.]
  ob=bpy.data.objects.new(label+' '+part['name'],mesh);bpy.context.collection.objects.link(ob);objects[label].append(ob)
floor=bpy.data.materials.new('Studio ground');floor.diffuse_color=(.028,.045,.06,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));bpy.context.object.data.materials.append(floor)
for name,xyz,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);ob.location=xyz;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Matched fixed cameras');cam=bpy.data.objects.new('Matched fixed cameras',d);bpy.context.collection.objects.link(cam);s.camera=cam;d.type='ORTHO'
shots=[('01-front',0,0),('02-left',90,0),('03-right',-90,0),('04-back',180,0),('05-top',0,90),('06-elevated-front',0,39.2894),('07-elevated-left',90,39.2894),('08-elevated-right',-90,39.2894),('09-elevated-back',180,39.2894)]
receipt={'status':'capture in progress','nativePins':{k:{'path':str(v.relative_to(ROOT)),'sha256':hashlib.sha256(v.read_bytes()).hexdigest()} for k,v in paths.items()},'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'resolution':[600,740],'samples':24,'denoising':False,'viewTransform':'AgX','lighting':'V71 three area lights, unchanged between variants','geometry':'native bind pose, identity transforms, no camera-dependent changes','captures':[],'runtimeValidated':False}
# Hero first for early artistic feedback, followed by the matched nine.
for shot,yaw,elevation in [('hero',None,None)]+shots:
 if shot=='hero':position=Vector((3,4.6,2.25));look=Vector((0,-.03,.84));scale=3.2
 else:
  y,e=math.radians(yaw),math.radians(elevation);look=target;position=look+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)));scale=4.2
 cam.location=position;cam.rotation_euler=(look-position).to_track_quat('-Z','Y').to_euler();d.ortho_scale=scale
 for label in paths:
  for key,obs in objects.items():
   for ob in obs:ob.hide_render=key!=label
  raw=a.out/f'{label}-{shot}.png';s.render.filepath=str(raw.resolve());bpy.ops.render.render(write_still=True)
  dest=a.out/f'{label}-{shot}.webp'
  subprocess.run(['/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python',str(HERE/'save_preview.py'),str(raw),str(dest),label+' | '+shot],check=True)
  # Retain exact PNG pixels for independent visual review.
  receipt['captures'].append({'variant':label,'view':shot,'camera':list(position),'target':list(look),'scale':scale,'filename':dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
  (a.out/'capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
receipt['status']='All twenty actual matched captures completed'
(a.out/'capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
# Native JSON and constructor are the editable source; no saved blend/cache.
