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
SOURCE=ROOT/'art/driftwood-isle/puffer-remaster-guided/semantic-face-diagonal-native.json'
EXPECTED='483b47367ddbad0e4872f357f786fc0cca778380a07bd536428923aadd3046cb'
if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED:raise RuntimeError('V71 source pin changed')
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--render',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
args.out.mkdir(parents=True,exist_ok=True)
if (args.out/'inspection.blend').exists():raise RuntimeError('Fresh output directory required')
native=json.loads(SOURCE.read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Unaccepted anatomy clay');mat.use_nodes=True
shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.32,.31,.28,1);shader.inputs['Roughness'].default_value=.85
attribute=mat.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='Col';mat.node_tree.links.new(attribute.outputs['Color'],shader.inputs['Base Color'])

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
receipt={'status':'unaccepted flat semantic face palette check','sourceNativeSha256':EXPECTED,'geometryChanges':False}
(args.out/'preflight.json').write_text(json.dumps(receipt,indent=2)+'\n')
for part,verts,fs in meshes:
    used=sorted({i for face in fs for i in face});remap={old:new for new,old in enumerate(used)}
    data=bpy.data.meshes.new(part['name']);data.from_pydata([verts[i]for i in used],[],[tuple(remap[i]for i in face)for face in fs]);data.update();data.materials.append(mat)
    paint=data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for fi,face in enumerate(data.polygons):
        for li,k in zip(face.loop_indices,(0,6,3)):paint.data[li].color=(*part['colorsLinear'][fi*9+k:fi*9+k+3],1)
    ob=bpy.data.objects.new(part['name'],data);bpy.context.collection.objects.link(ob)
bpy.ops.wm.save_as_mainfile(filepath=str((args.out/'inspection.blend').resolve()))
if args.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100;scene.world.color=(.18,)*3;scene.view_settings.view_transform='AgX'
    for name,loc,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Fixed guide comparison');cam=bpy.data.objects.new('Fixed guide comparison',data);bpy.context.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.2
    for name,yaw,elevation in [('hero',32.94,14.34),('front',0,0),('side',90,0)]:
        y,e=math.radians(yaw),math.radians(elevation);target=Vector((0,-.03,.84));cam.location=target+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((args.out/('color-'+name+'.png')).resolve());bpy.ops.render.render(write_still=True)
print(json.dumps(receipt))
