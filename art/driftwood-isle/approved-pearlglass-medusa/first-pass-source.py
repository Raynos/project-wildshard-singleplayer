"""Pearlglass Medusa DI-N17: editable native +Y-up mesh producer.
Blender basis is (x,-z,y), a proper rotation. Native binds are absolute,
identity-oriented. GLB edit-bone orientations are not native animation axes.
"""
import argparse,sys,math,json,hashlib,importlib.util,random
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render-dir');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'pearl':'FFF0CD','cream':'F4DCA8','white':'FFF8E8','mint':'A5DDD2','aqua':'71C7CC','teal':'459B9E','rose':'F18FA5','pink':'F5B6BE','peach':'F5BB91','gold':'ECA529','amber':'C87418','light':'FFE197','core':'FFF1A8','shadow':'B98B62'}
def linear(h):return [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]]
colors={k:linear(h) for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.56;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,3.35,0]},{'name':'head','parent':'body','pos':[0,3.25,.08]},{'name':'bell','parent':'body','pos':[0,3.65,0]}]
# Eight spaced pendulous ribbons. Three articulated spans each; roots under bell.
paths=[]
for k in range(8):
 t=math.tau*k/8+.18;rad=.68;length=2.62+.36*math.sin(k*1.7)**2
 rows=[]
 for j in range(13):
  q=j/12;r=rad+.65*math.sin(q*math.pi*.9)+.20*math.sin(q*math.tau*1.7+k*.8);theta=t+.19*math.sin(q*math.tau+k*.6)
  rows.append(([r*math.cos(theta),3.22-length*q,r*math.sin(theta)],(.12+.22*math.sin(q*math.pi)**.7)*(1-.65*q**7)))
 paths.append(rows)
 for s in range(3):bones.append({'name':f'ribbon{k}_{s}','parent':'body' if s==0 else f'ribbon{k}_{s-1}','pos':rows[s*4][0]})
parts={name:{'name':name,**{key:[] for _,_,_,key in codec.ATTRS}} for name in ['bell','head']+[f'ribbon{k}' for k in range(8)]};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def skin(joint):return [(next(i for i,b in enumerate(bones) if b['name']==joint),1.)]
def mesh(name,vs,fs,palette,part,joint=None,weights=None,face_colors=None):
 tris=[];mats=[]
 for fi,f in enumerate(fs):
  for j in range(1,len(f)-1):tris.append((f[0],f[j],f[j+1]));mats.append(face_colors[fi] if face_colors else (fi*7+fi//3)%len(palette))
 data=bpy.data.meshes.new(name);data.from_pydata([bp(v) for v in vs],[],tris);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
 for k in palette:data.materials.append(materials[k])
 weights=weights or [skin(joint or part) for v in vs];target=parts[part]
 for i,tri in enumerate(tris):
  data.polygons[i].material_index=mats[i]
  for vi in tri:
   ids=[x[0] for x in weights[vi]];ws=[x[1] for x in weights[vi]]
   target['positions'].extend(float(x) for x in vs[vi]);target['colorsLinear'].extend(colors[palette[mats[i]]]);target['skinIndices'].extend(ids+[0]*(4-len(ids)));target['skinWeights'].extend(ws+[0.]*(4-len(ws)));target['furLen'].append(0)
 for bi,b in enumerate(bones):
  selected=[(vi,dict(w).get(bi,0)) for vi,w in enumerate(weights) if dict(w).get(bi,0)>0]
  if selected:
   g=o.vertex_groups.new(name=b['name'])
   for vi,w in selected:g.add([vi],w,'REPLACE')
 objects.append(o);components.append({'name':name,'triangles':len(tris),'part':part});return o

def tube(name,rows,palette,part,joint=None,n=6):
 vs=[];last=Vector((1,0,0))
 for j,(c,r) in enumerate(rows):
  t=(Vector(rows[min(j+1,len(rows)-1)][0])-Vector(rows[max(j-1,0)][0])).normalized();u=last-t*last.dot(t)
  if u.length<.001:u=Vector((0,0,1))-t*t.z
  u.normalize();v=t.cross(u);last=u
  vs.extend(tuple(Vector(c)+r*(math.cos(math.tau*i/n)*u+math.sin(math.tau*i/n)*v)) for i in range(n))
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]+[tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]
 return mesh(name,vs,fs,palette,part,joint)
# Continuous hollow bell with thickness, closed at central inner roof, scalloped rim.
n=32;vs=[]
profiles=[(.10,4.43),(.58,4.39),(1.05,4.18),(1.43,3.88),(1.76,3.60),(1.83,3.49),(1.71,3.43),(1.40,3.57),(1.02,3.76),(.55,3.89),(.08,3.94)]
for j,(r,y) in enumerate(profiles):
 for i in range(n):
  t=math.tau*i/n;scallop=math.cos(8*t);rr=r*(1+.055*scallop*(r/1.83));yy=y+.075*scallop*(r/1.83)+.035*math.sin(3*t)*(r/1.83)
  vs.append((rr*math.cos(t),yy,rr*.88*math.sin(t)))
fs=[];fc=[];pal=['pearl','white','mint','aqua','rose','pink','peach','cream','teal']
for j in range(len(profiles)-1):
 for i in range(n):
  # Reverse XZ ring winding on outside. Each quad splits diagonally into colored facets.
  aa=j*n+i;bb=j*n+(i+1)%n;cc=(j+1)*n+(i+1)%n;dd=(j+1)*n+i
  fs.extend([(aa,dd,cc),(aa,cc,bb)])
  if j<5:fc.extend([(i//2+j*2)%8,(i//3+j*3+2)%8])
  else:fc.extend([2+(i+j)%2,8 if (i+j)%4==0 else 2])
fs.extend([tuple(reversed(range(n))),tuple((len(profiles)-1)*n+i for i in range(n))]);fc.extend([0,2])
mesh('Continuous scalloped hollow pearlglass bell',vs,fs,pal,'bell',face_colors=fc)
# Strong warm-white radial struts carry rim into visible underside hub.
for k in range(16):
 t=math.tau*k/16
 rows=[]
 for r,y,w in [(.19,3.33,.065),(.52,3.45,.070),(1.02,3.53,.075),(1.43,3.46,.070),(1.76,3.47,.045)]:rows.append(((r*math.cos(t),y,.88*r*math.sin(t)),w))
 tube('Ivory radial bell rib %02d'%k,rows,['pearl','cream','white'],'bell',n=5)
# Coherent faceted amber organ: clustered crown and luminous core, all true closed solids.
def gem(name,c,r,palette,part='head',joint=None):
 x,y,z=c;vs=[(x,y+r*1.22,z),(x,y-r*1.25,z)]
 for yy,rr in [(y+r*.35,r*.78),(y-r*.38,r)]:
  vs.extend((x+rr*math.cos(math.tau*i/7),yy,z+rr*math.sin(math.tau*i/7)) for i in range(7))
 fs=[(0,2+(i+1)%7,2+i) for i in range(7)]+[(2+i,2+(i+1)%7,9+(i+1)%7,9+i) for i in range(7)]+[(1,9+i,9+(i+1)%7) for i in range(7)]
 return mesh(name,vs,fs,palette,part,joint)
gem('Visible inner amber core',(0,3.18,.10),.40,['gold','light','core','gold','amber'])
for k in range(14):
 t=math.tau*k/14;r=.40+.04*math.sin(k)
 gem('Amber crown nodule %02d'%k,(r*math.cos(t),3.27+.07*math.sin(k*2),r*math.sin(t)),.14+.035*(k%3),['gold','amber','light'])
for k in range(10):
 t=math.tau*k/10
 tube('Fine amber inner frond %02d'%k,[((.30*math.cos(t),3.20,.30*math.sin(t)),.065),((.44*math.cos(t+.15),2.93,.44*math.sin(t+.15)),.05),((.37*math.cos(t+.25),2.76,.37*math.sin(t+.25)),.013)],['gold','amber','light'],'head',n=5)
# Closed diamond-section ribbons: broad face, central ridge, narrow physical thickness.
for k,rows in enumerate(paths):
 vs=[];weights=[];t=math.tau*k/8+.18
 for j,(c,w) in enumerate(rows):
  q=j/12;twist=t+.65*math.sin(q*math.tau*1.4+k*.7);u=Vector((math.cos(twist),0,math.sin(twist)));v=Vector((-math.sin(twist),0,math.cos(twist)));center=Vector(c)
  coord=min(j/4,2);lo=int(coord);hi=min(lo+1,2);f=coord-lo;ww=skin(f'ribbon{k}_{lo}') if hi==lo or f==0 else [(skin(f'ribbon{k}_{lo}')[0][0],1-f),(skin(f'ribbon{k}_{hi}')[0][0],f)]
  for d in [u*w,v*(.048+.018*math.sin(q*math.pi)),-u*w,-v*.038]:vs.append(tuple(center+d));weights.append(ww)
 fs=[(j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i) for j in range(12) for i in range(4)]+[(3,2,1,0),(48,49,50,51)]
 fc=[([0,1,2,3,4,5][(j//2+i+k)%6]) for j in range(12) for i in range(4)]+[0,0]
 mesh('Flowing thick pearl ribbon %02d'%k,vs,fs,['pearl','pink','rose','peach','mint','aqua'],f'ribbon{k}',weights=weights,face_colors=fc)
 # Barnacle clusters use a real recessed opening, mounted to each ribbon's front edge.
 for j in [4,8]:
  c,w=rows[j];joint=f'ribbon{k}_{min(j//4,2)}'
  for h in range(3):
   x,y,z=c;x+=(h-1)*.075;y+=.05*(h%2);z+=.09;rad=.07 if h!=1 else .095;v=[]
   for rr,zz in [(rad,z),(rad*.85,z+rad*.7),(rad*.39,z+rad*.78),(rad*.31,z+rad*.18)]:
    v.extend((x+rr*math.cos(math.tau*i/6),y+rr*math.sin(math.tau*i/6),zz) for i in range(6))
   f=[(s*6+i,s*6+(i+1)%6,(s+1)*6+(i+1)%6,(s+1)*6+i) for s in range(3) for i in range(6)]
   mesh('Hollow ivory ribbon barnacle %d %d %d'%(k,j,h),v,f,['pearl','cream','white'],f'ribbon{k}',joint)
data={'schema':codec.SCHEMA,'candidate':'pearlglass-medusa-v1','status':'source candidate; not admitted or gameplay tested','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y; no reflection','bones':bones,'parts':list(parts.values())}
report=codec.validate_native(data);raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();assert len(raw)<=5_000_000;(out/'native-source.json').write_bytes(raw)
dims={'bodyY':3.35,'bodyHalfLen':.72,'bodyRadius':.63,'headRadius':.42,'legLen':0,'feet':[],'halfWidth':1.85,'capsuleAxis':'y'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/pearlglass-medusa-native');metadata['bodies'][0].update(kind='pearlglass-medusa',variant='pearlglass-medusa');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
arm=bpy.data.armatures.new('Medusa anatomy');rig=bpy.data.objects.new('Pearlglass Medusa rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.18))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
 mod=o.modifiers.new('Authored chain skin','ARMATURE');mod.object=rig;o.parent=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'pearlglass-medusa-v1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
assert (out/'pearlglass-medusa-v1.glb').stat().st_size<=1_000_000
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'pearlglass-medusa-v1.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'colliderAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render_dir:
 rd=Path(a.render_dir).resolve();rd.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.28,.28,.28);scene.view_settings.view_transform='Standard'
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.12,.18,.23,1);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-4,-5,8),1100,5),('Fill',(5,-3,4),750,5),('Rim',(0,4,7),900,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.15;target=Vector((0,0,2.25))
 views=[('hero',23,8),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((8*math.sin(ar)*math.cos(er),-8*math.cos(ar)*math.cos(er),8*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(rd/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'actualRender':True})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('MEDUSA_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
