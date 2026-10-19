"""Blender-only, fixed-camera forefin comparison. Run only with coordinator lane.

blender -b --python render_comparison.py -- --out tmp/puffer-fin-study
Reconstructs the unchanged native bind surfaces, replacing only Two forefin fans in
memory for the study. No retained asset, scene, or runtime files are overwritten.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_refined_fins import build, BASE
from build_fins import build as build_compact
parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
a=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False
scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
mat=bpy.data.materials.new('Linear anatomical regions');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.83
attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col';mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
base=json.loads(BASE.read_text());study=build()[1]
objects=[]
def make_part(part):
    coords=part['positions'];verts=[(coords[i],coords[i+2],coords[i+1])for i in range(0,len(coords),3)]
    # Native -> Blender swaps y/z, so reverse each face's winding.
    faces=[(i,i+2,i+1)for i in range(0,len(verts),3)]
    mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
    col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for i,d in enumerate(col.data):d.color=part['colorsLinear'][i*3:i*3+3]+[1.]
    obj=bpy.data.objects.new(part['name'],mesh);bpy.context.collection.objects.link(obj);return obj
for p in base['parts']:objects.append(make_part(p))
old=[o for o in objects if o.name in ('Volumetric connected finL','Volumetric connected finR')];new=[make_part(p) for p in study['parts']]
compact=[make_part(p) for p in build_compact()[1]["parts"]]
for o in new+compact:o.hide_render=True
floor=bpy.data.materials.new('Studio ground');floor.diffuse_color=(.028,.045,.06,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));bpy.context.object.data.materials.append(floor)
for name,xyz,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Fixed comparison');cam=bpy.data.objects.new('Fixed comparison',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
shots=[('hero',(3,4.6,2.25),(0,-.03,.84),3.2),('side',(5,-.0575,.79),(0,-.0575,.79),4.2),('front',(0,4.9425,.79),(0,-.0575,.79),4.2)]
for label,position,target,scale in shots:
    cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=scale
    for variant in ('v71','compact-base','fin-study'):

        for o in old:o.hide_render=variant!='v71'
        for o in new:o.hide_render=variant!='fin-study'
        for o in compact:o.hide_render=variant!='compact-base'
        scene.render.filepath=str(out/f'{variant}-{label}.png');bpy.ops.render.render(write_still=True)
(out/'capture-receipt.json').write_text(json.dumps({'status':'actual Blender native-bind comparison; unaccepted','shots':shots,'resolution':[600,740],'samples':20,'lighting':'V71 studio three-light setup','albedo':'unchanged V71 except authored forefin regions','onlyReplacement':'Two forefin fans','runtimeValidated':False},indent=2)+'\n')
