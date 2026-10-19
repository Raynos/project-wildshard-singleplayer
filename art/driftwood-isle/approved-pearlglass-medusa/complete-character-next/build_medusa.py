"""Pearlglass Medusa DI-N17: editable native +Y-up mesh producer.
Blender basis is (x,-z,y), a proper rotation. Native binds are absolute,
identity-oriented. GLB edit-bone orientations are not native animation axes.
"""
import argparse,sys,math,json,hashlib,importlib.util,random
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render-dir');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
# The native consumer preserves supplied attributes; author normals explicitly.
codec.ATTRS=codec.ATTRS+[('normal','f32',3,'normals')]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'pearl':'FFF0CD','cream':'F4DCA8','white':'FFF8E8','mint':'A5DDD2','aqua':'71C7CC','teal':'459B9E','rose':'F18FA5','pink':'F5B6BE','peach':'F5BB91','gold':'ECA529','amber':'C87418','light':'FFE197','core':'FFF1A8','shadow':'B98B62'}
def linear(h):return [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]]
colors={k:linear(h) for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.56;materials[k]=m
bones=[{'name':'body','parent':None,'pos':[0,3.35,0]},{'name':'head','parent':'body','pos':[0,3.25,.08]},{'name':'bell','parent':'body','pos':[0,3.65,0]}]
# Eight complete spatial oral ribbons, broad middle bodies and curled ends.
paths=[]
for k in range(8):
 t=[.10,.72,2.30,2.95,3.80,4.55,5.30,5.85][k];length=2.54+.36*math.sin(k*1.7)**2
 rows=[]
 for j in range(17):
  q=j/16;rad=.49+.70*math.sin(q*math.pi*.85)+.29*math.sin(q*math.tau*1.55+k*.64)*math.sin(q*math.pi)
  theta=t+.25*math.sin(q*math.tau*1.2+k*.7)+.34*q*q
  curl=.15*math.sin(max(0,q-.82)/.18*math.pi)
  center=[rad*math.cos(theta),3.12-length*q+curl,rad*math.sin(theta)]
  width=(.10+(.26 if k%3 else .18)*math.sin(q*math.pi)**.72)*(1-.60*q**9)
  rows.append((center,width))
 paths.append(rows)
 for seg in range(3):bones.append({'name':f'ribbon{k}_{seg}','parent':'body' if seg==0 else f'ribbon{k}_{seg-1}','pos':rows[seg*5][0]})
parts={name:{'name':name,**{key:[] for _,_,_,key in codec.ATTRS}} for name in ['bell','head']+[f'ribbon{k}' for k in range(8)]};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1]-3.35)
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
  normal=(Vector(vs[tri[1]])-Vector(vs[tri[0]])).cross(Vector(vs[tri[2]])-Vector(vs[tri[0]])).normalized()
  for vi in tri:
   target['normals'].extend(float(x) for x in normal)
   ids=[x[0] for x in weights[vi]];ws=[x[1] for x in weights[vi]]
   target['positions'].extend(float(x)-(3.35 if axis==1 else 0) for axis,x in enumerate(vs[vi]));target['colorsLinear'].extend(colors[palette[mats[i]]]);target['skinIndices'].extend(ids+[0]*(4-len(ids)));target['skinWeights'].extend(ws+[0.]*(4-len(ws)));target['furLen'].append(0)
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
# Staggered, rounded lobed bell. Closed shell with a thick rolled perimeter.
n=28;vs=[]
profiles=[(.08,4.48),(.43,4.49),(.83,4.39),(1.16,4.18),(1.49,3.89),(1.74,3.65),(1.77,3.51),(1.65,3.43),(1.39,3.58),(1.02,3.71),(.58,3.75),(.08,3.71)]
for j,(r,y) in enumerate(profiles):
 for i in range(n):
  t=math.tau*i/n + (.030*math.sin(i*2.1+j*1.5) if j not in [0,11] else 0)
  lobe=.052*math.sin(5*t+.4)+.039*math.cos(3*t-.6)+.023*math.sin(8*t)
  rr=r*(1+lobe);yy=y+.40*math.sin(t)*(r/1.83)+(.11*math.sin(3*t+.8)+.045*math.cos(5*t))*min(1,r/.7)
  vs.append((rr*math.cos(t)+.09*(1-r/1.9),yy,rr*.88*math.sin(t)))
fs=[];fc=[];pal=['pearl','cream','mint','aqua','rose','pink','peach','teal']
for j in range(len(profiles)-1):
 for i in range(n):
  aa=j*n+i;bb=j*n+(i+1)%n;cc=(j+1)*n+(i+1)%n;dd=(j+1)*n+i
  fs.extend([(aa,bb,dd),(bb,cc,dd)] if (i+j)%2 else [(aa,bb,cc),(aa,cc,dd)])
  if j<7:
   field=math.sin(i*.66+j*.87)+.55*math.cos(i*.91-j*.72)
   choices=[0,1,6] if field<-.35 else ([2,3,0] if field<.65 else [4,5,6])
   fc.extend([choices[(j+i)%3],choices[(j+i+1)%3]])
  else:fc.extend([2 if (i+j)%3 else 3,7 if (i+j)%4==0 else 3])
fs.extend([tuple(reversed(range(n))),tuple((len(profiles)-1)*n+i for i in range(n))]);fc.extend([0,2])
mesh('Lobed thick closed pearlglass bell',vs,fs,pal,'bell',face_colors=fc)
# Arches grow from the organ, bow below recessed teal pockets and merge into rim.
for k in range(12):
 t=math.tau*k/12+.06;rows=[]
 for j in range(8):
  q=j/7;r=.28+1.46*q;angle=t+.09*math.sin(q*math.pi)
  y=3.20+.36*q+.17*math.sin(q*math.pi)+.40*math.sin(angle)*(r/1.83)
  w=.035+.095*math.sin(q*math.pi)**.7
  rows.append(((r*math.cos(angle),y,.88*r*math.sin(angle)),w))
 tube('Seated curved ivory chamber arch %02d'%k,rows,['pearl','cream'],'bell',n=5)
# Rounded low-poly organ nodules rather than pointed double-ended crystals.
def gem(name,c,r,palette,part='head',joint=None):
 x,y,z=c;n=7;vs=[(x,y+r*.93,z),(x,y-r*.93,z)]
 for ring,(yy,rr) in enumerate([(y+r*.56,r*.72),(y,r),(y-r*.56,r*.72)]):
  vs.extend((x+rr*math.cos(math.tau*i/n+.12*ring),yy,z+rr*math.sin(math.tau*i/n+.12*ring)) for i in range(n))
 fs=[(0,2+(i+1)%n,2+i) for i in range(n)]
 for j in range(2):
  fs.extend((2+j*n+i,2+j*n+(i+1)%n,2+(j+1)*n+(i+1)%n,2+(j+1)*n+i) for i in range(n))
 fs.extend((1,16+i,16+(i+1)%n) for i in range(n))
 return mesh(name,vs,fs,palette,part,joint)
gem('Luminous central pearl organ',(.08,3.00,.32),.36,['gold','light','core','gold'])
for k in range(18):
 t=math.tau*k/18;r=.31+.07*math.sin(k*1.8)
 gem('Clustered amber organ lobe %02d'%k,(r*math.cos(t),3.10+.13*math.sin(k*2.3),r*math.sin(t)),.11+.04*(k%3),['gold','amber','light'])
for k in range(8):
 t=math.tau*k/8
 tube('Short curling orange oral frond %02d'%k,[((.31*math.cos(t),3.10,.31*math.sin(t)),.065),((.48*math.cos(t+.12),2.93,.48*math.sin(t+.12)),.058),((.48*math.cos(t+.35),2.81,.48*math.sin(t+.35)),.041),((.39*math.cos(t+.55),2.84,.39*math.sin(t+.55)),.018)],['gold','amber','light'],'head',n=5)
# Continuous twisted lenticular six-point sections, no zero-thickness panels.
for k,rows in enumerate(paths):
 vs=[];weights=[];t=[.10,.72,2.30,2.95,3.80,4.55,5.30,5.85][k];sections=[]
 for j,(c,w) in enumerate(rows):
  q=j/16;twist=t+.9*math.sin(q*math.tau*1.15+k*.7)+.65*q
  tangent=(Vector(rows[min(j+1,16)][0])-Vector(rows[max(j-1,0)][0])).normalized()
  u=Vector((math.cos(twist),0,math.sin(twist)));u=(u-tangent*u.dot(tangent)).normalized();v=tangent.cross(u).normalized();center=Vector(c);sections.append((u,v))
  coord=min(j/5,2);lo=int(coord);hi=min(lo+1,2);f=coord-lo;ww=skin(f'ribbon{k}_{lo}') if hi==lo or f==0 else [(skin(f'ribbon{k}_{lo}')[0][0],1-f),(skin(f'ribbon{k}_{hi}')[0][0],f)]
  thick=.045+.055*math.sin(q*math.pi);cup=.10*w*math.sin(q*math.tau+k)
  for ux,vy in [(1,0),(.45,1),(-.45,1),(-1,0),(-.45,-1),(.45,-1)]:vs.append(tuple(center+u*(w*ux)+v*(thick*vy+cup*ux*ux)));weights.append(ww)
 fs=[(j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i) for j in range(16) for i in range(6)]+[tuple(reversed(range(6))),tuple(96+i for i in range(6))]
 # Section frame follows the downward path; perimeter cross tangent points outward.
 fc=[(j//3+i//2+k)%6 for j in range(16) for i in range(6)]+[0,0]
 mesh('Sculptural curled pearl ribbon %02d'%k,vs,fs,['pearl','pink','rose','peach','mint','aqua'],f'ribbon{k}',weights=weights,face_colors=fc)
 for j in ([5,11] if k%2==0 else [8]):
  c,w=rows[j];joint=f'ribbon{k}_{min(j//5,2)}';u,v=sections[j]
  # Cups follow the actual broad ribbon face, not one global front direction.
  for h in range(3 if k%3 else 4):
   rad=.055+.025*((h+k)%3);center=Vector(c)+u*((h-1)*.095)+v*.065+Vector((0,.035*(h%2),0));vv=[]
   axis=v;side=u;up=axis.cross(side).normalized()
   for rr,zz in [(rad,0),(rad*.91,rad*.7),(rad*.48,rad*.83),(rad*.35,rad*.20)]:
    vv.extend(tuple(center+side*(rr*math.cos(math.tau*i/6))+up*(rr*math.sin(math.tau*i/6))+axis*zz) for i in range(6))
   ff=[(s*6+i,s*6+(i+1)%6,(s+1)*6+(i+1)%6,(s+1)*6+i) for s in range(3) for i in range(6)]
   mesh('Hollow ivory ribbon barnacle %d %d %d'%(k,j,h),vv,ff,['pearl','cream'],f'ribbon{k}',joint)
data={'schema':codec.SCHEMA,'candidate':'pearlglass-medusa-complete-character-next','status':'source candidate; not admitted or gameplay tested','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y; no reflection','bones':[{**b,'pos':[b['pos'][0],b['pos'][1]-3.35,b['pos'][2]]} for b in bones],'parts':list(parts.values())}
report=codec.validate_native(data);raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();assert len(raw)<=5_000_000;(out/'native-source.json').write_bytes(raw)
dims={'bodyY':0,'bodyHalfLen':.72,'bodyRadius':.63,'headRadius':.42,'legLen':0,'feet':[],'halfWidth':1.85,'capsuleAxis':'y'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/pearlglass-medusa-native');metadata['bodies'][0].update(kind='pearlglass-medusa',variant='pearlglass-medusa');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
arm=bpy.data.armatures.new('Medusa anatomy');rig=bpy.data.objects.new('Pearlglass Medusa rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.18))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
 mod=o.modifiers.new('Authored chain skin','ARMATURE');mod.object=rig;o.parent=rig
# Compact GLB objects by skin part; native arrays retain every source component.
joined=[]
for part in parts:
 selected=[o for o,c in zip(objects,components) if c['part']==part]
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.select_set(True)
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();selected[0].name=part;joined.append(selected[0])
objects=joined
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'pearlglass-medusa-complete-character-next.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
assert (out/'pearlglass-medusa-complete-character-next.glb').stat().st_size<=1_000_000
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'pearlglass-medusa-complete-character-next.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'colliderAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render_dir:
 rd=Path(a.render_dir).resolve();rd.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.28,.28,.28);scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.9
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.12,.18,.23,1);bpy.ops.mesh.primitive_plane_add(size=12,location=(0,0,-3.35));bpy.context.object.data.materials.append(ground);bpy.context.object.hide_render=True
 for name,pos,power,size in [('Key',(-4,-5,8),1100,5),('Fill',(2,-5,2.5),950,5),('Rim',(0,4,7),900,4)]:
  bpy.ops.object.light_add(type='AREA',location=(pos[0],pos[1],pos[2]-3.35));bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size;bpy.context.object.rotation_euler=(Vector((0,0,0))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.15;target=Vector((0,0,-1.10))
 views=[('hero',23,-8),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((8*math.sin(ar)*math.cos(er),-8*math.cos(ar)*math.cos(er),8*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(rd/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'actualRender':True})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('MEDUSA_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
