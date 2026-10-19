"""Build one frozen anatomical control cage. Blender execution needs the shared lane.

blender -b -t 2 --python-exit-code 1 -P THIS.py -- --candidate study-a --out tmp/... --render
No V71 imports, model replacement, runtime admission or source mutation.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
import bmesh
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from anatomy_geometry import make_cage,make_fin
parser=argparse.ArgumentParser()
parser.add_argument('--candidate',choices=['anatomy-revision'],required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.out.mkdir(parents=True,exist_ok=True)
if (args.out/'inspection.blend').exists():raise RuntimeError('Fresh output directory required')
config=json.loads((HERE/'anatomy_controls.json').read_text())
spec=next(c for c in config['candidates']if c['id']==args.candidate)
model=make_cage(spec,config['columns'])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PALETTE={'teal':(.12,.39,.38),'orange':(.91,.43,.075),'ivory':(1,.91,.70),'socket':(.12,.07,.025),'mouth':(.21,.058,.022),'gold':(1,.62,.17),'pupil':(.012,.021,.021),'clay':(.52,.50,.46)}
materials={}
for key,rgb in PALETTE.items():
    mat=bpy.data.materials.new(key);mat.diffuse_color=(*rgb,1);mat.use_nodes=True
    shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb),1);shader.inputs['Roughness'].default_value=.85
    materials[key]=mat
parts=[];audits=[]

def mesh(name,vertices,faces,colors,joint):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    for key in PALETTE:data.materials.append(materials[key])
    keys=list(PALETTE)
    for poly,color in zip(data.polygons,colors):poly.material_index=keys.index(color)
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if any(not e.is_manifold for e in bm.edges):raise RuntimeError(name+' is not closed manifold')
    if any(f.calc_area()<1e-10 for f in bm.faces):raise RuntimeError(name+' has degenerate triangles')
    volume=bm.calc_volume(signed=True)
    if volume<=0:raise RuntimeError(name+' has nonpositive volume')
    bm.to_mesh(data);bm.free();data.update()
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
    group=ob.vertex_groups.new(name=joint);group.add(list(range(len(data.vertices))),1,'REPLACE')
    parts.append(ob);audits.append(dict(name=name,vertices=len(data.vertices),triangles=len(data.polygons),volume=volume,closedManifold=True))
    return ob

body=mesh('Integrated anatomical cage',model['vertices'],model['faces'],model['colors'],'belly')
for sign in (-1,1):
    for kind in ('fore','rear'):
        scale=1 if kind=='fore' else .68
        verts,faces=make_fin(spec[kind+'Root'],spec[kind+'Fan'],spec['fanWidth']*scale,spec['fanDepth']*scale,sign)
        colors=['teal']*len(faces)
        for i in range(6,12):colors[i]='orange' if i in (7,8,9)else'teal'
        mesh(kind+' fan '+str(sign),verts,faces,colors,('fin'if kind=='fore'else'rear')+('L'if sign<0 else'R'))
# Shallow closed lens discs inside the real sockets, with a simple inset pupil.
for eye in model['eyes']:
    cx,cy,cz=eye['center'];rx,rz=eye['rx'],eye['rz']
    center=Vector(eye['center']);tangent=Vector(eye['tangent']);up=Vector(eye['up']);normal=Vector(eye['normal'])
    verts=[]
    for depth in (0,-.012):
        for i in range(12):
            t=2*math.pi*i/12;verts.append(tuple(center+tangent*(rx*math.cos(t))+up*(rz*math.sin(t))+normal*depth))
    faces=[tuple(range(12)),tuple(reversed(range(12,24)))]+[(i,(i+1)%12,(i+1)%12+12,i+12)for i in range(12)]
    mesh('Amber eye '+str(eye['sign']),verts,faces,['gold']*len(faces),'head')
    pv=[tuple(center+tangent*(rx*.30*math.cos(2*math.pi*i/8))+up*(rz*.55*math.sin(2*math.pi*i/8))+normal*.001)for i in range(8)]
    pv += [tuple(Vector(point)-normal*.006)for point in pv]
    pf=[tuple(range(8)),tuple(reversed(range(8,16)))]+[(i,(i+1)%8,(i+1)%8+8,i+8)for i in range(8)]
    mesh('Pupil '+str(eye['sign']),pv,pf,['pupil']*len(pf),'head')
# Rig sockets establish editable intent only; no animation acceptance or native export.
rest={'body':((0,0,.70),None),'belly':((0,0,.70),'body'),'head':((0,.50,.93),'belly'),
      'tail':((0,spec['rearY'],.68),'body'),
      'finL':((-spec['foreRoot'][0],spec['foreRoot'][1],spec['foreRoot'][2]),'body'),
      'finR':(tuple(spec['foreRoot']),'body'),
      'rearL':((-spec['rearRoot'][0],spec['rearRoot'][1],spec['rearRoot'][2]),'body'),
      'rearR':(tuple(spec['rearRoot']),'body')}
armdata=bpy.data.armatures.new('Blockout rest hierarchy');arm=bpy.data.objects.new('Blockout rest hierarchy',armdata);bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(head,parent)in rest.items():
    bone=armdata.edit_bones.new(name);bone.head=head;bone.tail=Vector(head)+Vector((0,0,.10))
    if parent:bone.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for ob in parts:
    mod=ob.modifiers.new('Rest armature','ARMATURE');mod.object=arm
# Explicit cap classification against the final triangulated cage, no guessed plane.
sys.path.insert(0,str(HERE.parent/'approved-puffer'))
from puffer_surface_clearance import classify_surface_point
hull_vertices=[tuple(v.co)for v in body.data.vertices]
hull_faces=[tuple(p.vertices)for p in body.data.polygons]
cap_receipts=[]
for ob in parts:
    if ' fan 'not in ob.name:continue
    for v in list(ob.data.vertices)[:4]:
        # find_nearest supplies Euclidean distance; sign comes from winding.
        from mathutils.bvhtree import BVHTree
        tree=BVHTree.FromPolygons(hull_vertices,hull_faces,all_triangles=True)
        hit,normal,index,distance=tree.find_nearest(v.co)
        classification=classify_surface_point(tuple(v.co),hull_vertices,hull_faces,distance)
        cap_receipts.append(dict(part=ob.name,vertex=v.index,classification=classification,distance=distance))
        if classification['classification']!='inside':raise RuntimeError('Blockout fin cap is exposed: '+str(cap_receipts[-1]))
receipt={'status':'unaccepted anatomical blockout','candidate':args.candidate,'design':spec['design'],'landmarks':model['landmarks'],'meshAudits':audits,'finCapQueries':cap_receipts,'restPivots':rest,'sourcePins':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in (HERE/'anatomy_controls.json',HERE/'anatomy_geometry.py',Path(__file__))},'limitations':['rigid draft weights; no deformation test','no tail or spine detail; judge anatomy separately','no runtime admission']}
(args.out/'build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str((args.out/'inspection.blend').resolve()))
if args.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100
    scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
    for name,loc,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color
        ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Fixed blockout comparison');cam=bpy.data.objects.new('Fixed blockout comparison',data);bpy.context.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.2
    original={ob.name:[p.material_index for p in ob.data.polygons]for ob in parts}
    for mode in ('clay',):
        for ob in parts:
            for p,index in zip(ob.data.polygons,original[ob.name]):p.material_index=list(PALETTE).index('clay')if mode=='clay'else index
        for name,yaw,elevation in [('hero',32.94,14.34),('side',90,0)]:
            y,e=math.radians(yaw),math.radians(elevation);target=Vector((0,-.03,.84))
            cam.location=target+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)))
            cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str((args.out/(mode+'-'+name+'.png')).resolve());bpy.ops.render.render(write_still=True)
print(json.dumps(receipt))
