"""Matched actual frozen native geometry, inherited Conch studio; no pose edits.
Run only with coordinator permission and shared heavy lease. Raw PNGs untouched.
"""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
CANDIDATE=HERE.parent
BASE=CANDIDATE.parent
ROOT=BASE.parents[2]
SOURCES={'selected':BASE/'selected-native-normals/native/conch-character-pass-native.json','articulated':CANDIDATE/'model.json'}
PINS={'selected':'3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929','articulated':'560abb099f474ddb86733f143e39652874298bba67f15fd1da7a63f1c4e91b3e'}
CAMERAS=BASE/'complete-pass1/cameras-complete-pass1.json'
parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=args.out.resolve()
if out.exists():raise RuntimeError('Refuse overwrite of existing raw capture attempt')
out.mkdir(parents=True)
sha=lambda raw:hashlib.sha256(raw).hexdigest()
f32=lambda v:struct.unpack('<f',struct.pack('<f',v))[0]
models={}
for variant,path in SOURCES.items():
 raw=path.read_bytes()
 if sha(raw)!=PINS[variant]:raise RuntimeError('Frozen model changed: '+variant)
 models[variant]=json.loads(raw)
cameras=json.loads(CAMERAS.read_bytes())['cameras']
assert len(cameras)==9
receipt={'status':'running; static source comparison only','sourcePins':PINS,'rendererSha256':sha(Path(__file__).read_bytes()),'cameraSourceSha256':sha(CAMERAS.read_bytes()),'blenderVersion':bpy.app.version_string,'coordinateContract':{'baselineToActor':'B=Ry(pi): (-x,y,-z)','actorToBlender':'C=(-x,z,y), determinant+1; C B recovers original Conch studio frame','actorForward':'+Z','studioForward':'+Y','rootOffsets':'none; all object transforms identity; static absolute bind geometry'},'materialContract':{'source':'native linear corner color, no palette edits','roughness':.76,'metallic':0,'normalHandling':'native normal transformed with B/C and loaded as Blender custom loop normals; Blender normalization/quantization is measured, not claimed bit-identical','renderer':'Cycles CPU, AgX, no denoising; source-native studio not engine shader equivalence'},'frames':[],'importChecks':[],'motionAuthored':False,'qualityAdmission':False,'runtimeAdmission':False}
def save(): (out/'capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
def transform(v,variant):
 x,y,z=v
 if variant=='selected':x,z=-x,-z
 return (-x,z,y)
def material(name,color=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Roughness'].default_value=.76;p.inputs['Metallic'].default_value=0
 if color is None:
  a=m.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='SourceLinear';m.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
 else:
  linear=tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in color);p.inputs['Base Color'].default_value=(*linear,1)
 return m
def setup(mode):
 bpy.ops.wm.read_factory_settings(use_empty=False)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24 if mode=='hero' else 16;scene.cycles.use_denoising=False;scene.cycles.seed=0
 scene.render.threads_mode='FIXED';scene.render.threads=2
 scene.render.resolution_x=780 if mode=='hero' else round(700*780/1100);scene.render.resolution_y=960 if mode=='hero' else 700;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.film_transparent=False;scene.view_settings.view_transform='AgX'
 scene.world.color=(.15,.15,.15)  # Retain factory World nodes as the original Conch builders do.
 mat=material('Unchanged native linear corner material');objects={}
 for variant,model in models.items():
  objects[variant]=[]
  for part in model['parts']:
   p=part['positions'];n=part['normals'];c=part['colorsLinear'];verts=[transform(p[i:i+3],variant) for i in range(0,len(p),3)];normals=[transform(n[i:i+3],variant) for i in range(0,len(n),3)]
   mesh=bpy.data.meshes.new(variant+':'+part['name']);mesh.from_pydata(verts,[],[tuple(range(i,i+3)) for i in range(0,len(verts),3)]);mesh.update();mesh.materials.append(mat)
   paint=mesh.color_attributes.new(name='SourceLinear',type='FLOAT_COLOR',domain='CORNER')
   for i,item in enumerate(paint.data):item.color=(*c[i*3:i*3+3],1)
   for poly in mesh.polygons:poly.use_smooth=True
   mesh.normals_split_custom_set(normals)
   ob=bpy.data.objects.new(variant+':'+part['name'],mesh);scene.collection.objects.link(ob);objects[variant].append(ob)
   maximum=0
   for i,v in enumerate(mesh.vertices):
    expected=tuple(f32(x) for x in verts[i]);actual=tuple(v.co)
    if actual!=expected:raise RuntimeError('Imported source position mismatch')
   for i,cn in enumerate(mesh.corner_normals):maximum=max(maximum,(cn.vector-Vector(normals[i])).length)
   if mode=='nine':receipt['importChecks'].append({'variant':variant,'part':part['name'],'corners':len(verts),'positionsExactFloat32':True,'maximumCustomNormalDelta':maximum,'transformIdentity':list(ob.location)==[0,0,0] and list(ob.rotation_euler)==[0,0,0] and list(ob.scale)==[1,1,1]})
 ground=bpy.data.meshes.new('Retained studio ground');ground.from_pydata([(-50,-50,0),(50,-50,0),(50,50,0),(-50,50,0)],[],[(0,1,2,3)]);ground.materials.append(material('Retained studio floor',(.025,.035,.045) if mode=='hero' else (.027,.037,.045)));o=bpy.data.objects.new('Retained studio ground',ground);scene.collection.objects.link(o)
 light_spec=[('Warm key',(-3,4,6),650,4),('Cool fill',(4,2,3),350,4),('Shell rim',(-1,-4,5),800,3)] if mode=='hero' else [('Key',(-3,4,7),700,4),('Fill',(4,2,4),400,4),('Rim',(0,-5,5),850,3)]
 for name,position,power,size in light_spec:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size
  if mode=='nine':d.shape='DISK'
  ob=bpy.data.objects.new(name,d);scene.collection.objects.link(ob);ob.location=position;ob.rotation_euler=(Vector((0,0,1.5 if mode=='hero' else 1.7))-ob.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Retained matched camera');cam=bpy.data.objects.new('Retained matched camera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO'
 return scene,cam,objects,light_spec
save()
for mode in ['nine','hero']:
 scene,cam,objects,lights=setup(mode)
 views=cameras if mode=='nine' else {'hero':{'location':[-3,7,3.0],'rotation':list((Vector((0,0,1.62))-Vector((-3,7,3.0))).to_track_quat('-Z','Y').to_euler()),'orthoScale':4.70}}
 for view,camera in views.items():
  cam.location=camera['location'];cam.rotation_euler=camera['rotation'];cam.data.ortho_scale=camera['orthoScale']
  for variant in ['selected','articulated']:
   for label,obs in objects.items():
    for ob in obs:ob.hide_render=label!=variant
   filename=f'{view}-{variant}.png';scene.render.filepath=str(out/filename);bpy.ops.render.render(write_still=True)
   raw=(out/filename).read_bytes();receipt['frames'].append({'file':filename,'variant':variant,'view':view,'bytes':len(raw),'sha256':sha(raw),'resolution':[scene.render.resolution_x,scene.render.resolution_y],'camera':camera,'lights':lights,'samples':scene.cycles.samples,'seed':scene.cycles.seed,'groundZ':0});save()
for variant,path in SOURCES.items():assert sha(path.read_bytes())==PINS[variant]
receipt['status']='complete: 20 matched static source frames; no quality or motion admission';receipt['sourceIdentityUnchanged']=True;save()
print(json.dumps({'complete':True,'frames':len(receipt['frames']),'rawBytes':sum(r['bytes'] for r in receipt['frames'])}))
