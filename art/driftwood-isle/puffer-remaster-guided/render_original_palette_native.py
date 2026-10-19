"""Matched frozen geometry comparison using the approved builder's original palette."""
import argparse,json,hashlib,math,sys
from pathlib import Path
from collections import defaultdict
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--scene',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--variant',choices=['supported','baselinehood'],required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);args.out.mkdir(parents=True,exist_ok=True)
native_path=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json';expected='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
if hashlib.sha256(native_path.read_bytes()).hexdigest()!=expected:raise RuntimeError('Guide changed')
native=json.loads(native_path.read_text());reference={}
for part in native['parts']:
    triangles=[];exact=defaultdict(list);points=[];faces=[]
    for i in range(0,len(part['positions']),9):
        tri=[];colors=[]
        for k in(0,6,3):
            x,y,z=part['positions'][i+k:i+k+3];tri.append((x,z,y));colors.append(tuple(part['colorsLinear'][i+k:i+k+3]))
        index=len(triangles);triangles.append((tri,colors));exact[tuple(sorted(tri))].append(index);faces.append(tuple(range(len(points),len(points)+3)));points.extend(tri)
    reference[part['name']]={'triangles':triangles,'exact':exact,'tree':BVHTree.FromPolygons(points,faces,all_triangles=True)}
def barycentric(point,tri):
    a,b,c=map(Vector,tri);v0=b-a;v1=c-a;v2=Vector(point)-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
    if abs(den)<1e-18:return(1,0,0)
    v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;weights=[max(0,1-v-w),max(0,v),max(0,w)];total=sum(weights);return tuple(w/total for w in weights)
def linear(x):return x/12.92 if x<=.04045 else((x+.055)/1.055)**2.4
palette={k:tuple(linear(x)for x in rgb)for k,rgb in {'ochre':(.91,.43,.075),'socket':(.39,.24,.09)}.items()}
def inside(x,z,poly):
    result=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if(a[1]>z)!=(b[1]>z)and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:result=not result
    return result
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
mat=bpy.data.materials.new('Original native linear corner palette');mat.use_nodes=True;shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.85;attribute=mat.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='Col';mat.node_tree.links.new(attribute.outputs['Color'],shader.inputs['Base Color'])
receipt={'status':'unaccepted matched original-palette geometry check','variant':args.variant,'nativeSha256':expected,'sceneSha256':hashlib.sha256(args.scene.read_bytes()).hexdigest(),'paletteChanges':False,'originalPaletteSrgb':{'ochre':[.91,.43,.075],'socket':[.39,.24,.09]},'parts':[]}
for ob in bpy.context.scene.objects:
    if ob.type!='MESH':continue
    ref=reference[ob.name];d=ob.data;d.materials.clear();d.materials.append(mat);paint=d.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER');counts=defaultdict(int)
    for face in d.polygons:
        tri=[tuple(d.vertices[i].co)for i in face.vertices]
        if len(tri)!=3:raise RuntimeError('Expected final triangles')
        exact=ref['exact'].get(tuple(sorted(tri)));semantic=None
        center=sum((Vector(p)for p in tri),Vector())/3
        if args.variant=='baselinehood' and ob.name=='Continuous mantle cheek and pouch' and not exact:
            hood=[(.19,.8944),(.46,.958),(.435,1.020),(.205,.954)]
            if inside(abs(center.x),center.z,hood):semantic='ochre'
            elif .23<abs(center.x)<.45 and .805<center.z<.965 and center.y<.741:
                if all(.66<p[1]<.786 for p in tri):semantic='socket'
        if semantic:
            colors=[palette[semantic]]*3;counts[semantic]+=1
        elif exact:
            oldtri,oldcolors=ref['triangles'][exact[0]];colors=[oldcolors[oldtri.index(p)]for p in tri];counts['exactNativeTriangles']+=1
        else:
            colors=[]
            for point in tri:
                hit,_,fi,_=ref['tree'].find_nearest(Vector(point));oldtri,oldcolors=ref['triangles'][fi];weights=barycentric(hit,oldtri);colors.append(tuple(sum(weights[j]*oldcolors[j][k]for j in range(3))for k in range(3)))
            counts['barycentricNativeTransfer']+=1
        for li,color in zip(face.loop_indices,colors):paint.data[li].color=(*color,1)
    receipt['parts'].append({'name':ob.name,'counts':dict(counts)})
(args.out/'palette-transfer-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
if True:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=600;scene.render.resolution_y=740;scene.render.resolution_percentage=100;scene.world.color=(.18,)*3;scene.view_settings.view_transform='AgX'
    for name,loc,power,size,color in [('Warm key',(-3,4,5),650,4,(1,.90,.76)),('Cool fill',(4,1,3),360,4,(.73,.87,1)),('Rim',(0,-4,4),500,3,(.66,.87,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color;ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.7))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Fixed guide comparison');cam=bpy.data.objects.new('Fixed guide comparison',data);bpy.context.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=3.2
    for name,yaw,elevation in [('hero',32.94,14.34),('front',0,0),('side',90,0)]:
        y,e=math.radians(yaw),math.radians(elevation);target=Vector((0,-.03,.84));cam.location=target+Vector((5*math.sin(y)*math.cos(e),5*math.cos(y)*math.cos(e),5*math.sin(e)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str((args.out/('color-'+name+'.png')).resolve());bpy.ops.render.render(write_still=True)
print(json.dumps(receipt))
