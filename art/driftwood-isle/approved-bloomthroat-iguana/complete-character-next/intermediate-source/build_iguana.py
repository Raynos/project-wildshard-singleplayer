"""DI-N10 source reconstruction. Native +Y up/+Z forward; Blender (x,-z,y).
Hero authoritative; hidden sides inferred. Closed component solids, authored skin.
"""
import argparse,sys,math,json,hashlib,importlib.util
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render-dir');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'sand':'DCA64E','gold':'F1BC62','light':'F9D58B','ochre':'B77D38','shadow':'89603B','teal':'318B91','aqua':'56B1B1','mint':'8AC6B4','rose':'DB3974','pink':'EF5F89','coral':'FF886D','plum':'A83364','claw':'463B37','black':'211C19','iris':'E8A62C','glint':'FFF1C7'}
def linear(h):return [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]]
colors={k:linear(h) for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_nodes=True;m.use_backface_culling=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.8;materials[k]=m
bones=[]
def bone(name,parent,pos):bones.append({'name':name,'parent':parent,'pos':list(pos)})
bone('body',None,(0,.78,-.2));bone('neck','body',(0,.92,.42));bone('head','neck',(0,1.51,1.04));bone('jaw','head',(0,1.37,1.09))
for side,s in [('L',-1),('R',1)]:
 for end,z,y in [('F',.62,.74),('B',-.70,.66)]:
  bone('leg'+end+side,'body',(s*.46,y,z));bone('shin'+end+side,'leg'+end+side,(s*.72,.35,z+.02));bone('foot'+end+side,'shin'+end+side,(s*.83,.13,z+.14))
tailpath=[((0,.64,-.92),.38),((.04,.58,-1.30),.34),((.25,.61,-1.69),.28),((.61,.77,-1.98),.23),((.94,1.06,-1.99),.20),((1.08,1.34,-1.76),.23),((1.07,1.56,-1.40),.27),((.93,1.66,-1.02),.19),((.84,1.65,-.83),.025)]
for j in range(4):bone('tail'+str(j),'body' if j==0 else 'tail'+str(j-1),tailpath[j*2][0])
for j in range(7):bone('bloom'+str(j),'jaw',(0,1.43,1.12))
parts={name:{'name':name,**{key:[] for _,_,_,key in codec.ATTRS}} for name in ['body','neck','head','jaw','tail']+['leg'+e+s for e in ['F','B'] for s in ['L','R']]+['bloom'+str(j) for j in range(7)]};objects=[];components=[]
def bp(v):return (v[0],-v[2],v[1])
def skin(joint):return [(next(i for i,b in enumerate(bones) if b['name']==joint),1.)]
def mesh(name,vs,fs,palette,part,joint=None,weights=None):
 # Recalculate manifold outward normals in native coordinates before both exports.
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.calc_loop_triangles();tris=[tuple(t.vertices) for t in me.loop_triangles];bpy.data.meshes.remove(me)
 data=bpy.data.meshes.new(name);data.from_pydata([bp(v) for v in vs],[],tris);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
 for k in palette:data.materials.append(materials[k])
 weights=weights or [skin(joint or part) for v in vs];target=parts[part];volume=0;area=1e9
 for i,tri in enumerate(tris):
  mi=(i//4+i//17)%len(palette);data.polygons[i].material_index=mi
  aa,bb,cc=[Vector(vs[t]) for t in tri];volume+=aa.dot(bb.cross(cc))/6;area=min(area,(bb-aa).cross(cc-aa).length*.5)
  for vi in tri:
   ids=[x[0] for x in weights[vi]];ws=[x[1] for x in weights[vi]];target['positions'].extend(vs[vi]);target['colorsLinear'].extend(colors[palette[mi]]);target['skinIndices'].extend(ids+[0]*(4-len(ids)));target['skinWeights'].extend(ws+[0.]*(4-len(ws)));target['furLen'].append(0)
 for bi,b in enumerate(bones):
  selected=[(vi,dict(w).get(bi,0)) for vi,w in enumerate(weights) if dict(w).get(bi,0)>0]
  if selected:
   g=o.vertex_groups.new(name=b['name'])
   for vi,w in selected:g.add([vi],w,'REPLACE')
 assert volume>0 and area>1e-10,(name,volume,area)
 objects.append(o);components.append({'name':name,'triangles':len(tris),'part':part,'signedVolume':volume,'minTriangleArea':area});return o

def ell(name,c,r,pal,part,joint=None,n=10,m=6):
 vs=[(c[0],c[1]+r[1],c[2]),(c[0],c[1]-r[1],c[2])]
 for j in range(1,m):
  phi=math.pi*j/m
  for i in range(n):
   t=math.tau*(i+(j%2)*.24)/n;vs.append((c[0]+r[0]*math.sin(phi)*math.cos(t),c[1]+r[1]*math.cos(phi),c[2]+r[2]*math.sin(phi)*math.sin(t)))
 fs=[(0,2+i,2+(i+1)%n) for i in range(n)]+[(1,2+(m-2)*n+(i+1)%n,2+(m-2)*n+i) for i in range(n)]
 for j in range(m-2):
  for i in range(n):fs.append((2+j*n+i,2+j*n+(i+1)%n,2+(j+1)*n+(i+1)%n,2+(j+1)*n+i))
 return mesh(name,vs,fs,pal,part,joint)
def tube(name,rows,pal,part,joints=None,n=8):
 vs=[];weights=[];last=Vector((1,0,0))
 for j,(c,r) in enumerate(rows):
  t=(Vector(rows[min(j+1,len(rows)-1)][0])-Vector(rows[max(j-1,0)][0])).normalized();u=last-t*last.dot(t)
  if u.length<.001:u=Vector((0,0,1))-t*t.z
  u.normalize();v=t.cross(u);last=u
  for i in range(n):
   vs.append(tuple(Vector(c)+r*(math.cos(math.tau*i/n)*u+math.sin(math.tau*i/n)*v)))
   if joints:
    f=j/(len(rows)-1)*(len(joints)-1);lo=int(f);hi=min(lo+1,len(joints)-1);w=f-lo;weights.append(skin(joints[lo]) if hi==lo or w==0 else [(skin(joints[lo])[0][0],1-w),(skin(joints[hi])[0][0],w)])
 fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]+[tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]
 return mesh(name,vs,fs,pal,part,weights=weights or None)
# Coherent anatomical lofts follow longitudinal planes, not an upright neck egg.
def loft(name,rows,pal,part,joint,n=12):
 vs=[]
 for j,(z,y,rx,ry) in enumerate(rows):
  for i in range(n):
   t=math.tau*i/n;vs.append((rx*math.cos(t),y+ry*math.sin(t),z))
 fs=[tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]
 fs += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rows)-1) for i in range(n)]
 return mesh(name,vs,fs,pal,part,joint)
loft('Continuous low trunk into rising broad shoulder',[(-1.08,.63,.20,.23),(-.82,.64,.48,.40),(-.43,.66,.60,.46),(-.04,.77,.62,.51),(.31,.91,.56,.55),(.61,1.10,.44,.48),(.82,1.26,.34,.33)],['sand','gold','ochre','gold','light'],'body','body')
loft('Sloping attached cervical mantle',[(.18,1.03,.42,.31),(.44,1.22,.41,.32),(.72,1.40,.37,.27),(1.01,1.47,.32,.21)],['gold','sand','light','gold'],'neck','neck')
loft('Broad angular reptile skull',[(.63,1.49,.25,.20),(.82,1.55,.39,.23),(1.10,1.55,.41,.22),(1.37,1.51,.34,.17),(1.52,1.49,.27,.135)],['gold','light','sand','light','gold'],'head','head',n=12)
loft('Integrated lower angular jaw',[(.80,1.37,.30,.075),(1.10,1.35,.36,.085),(1.36,1.37,.32,.075),(1.51,1.39,.255,.05)],['gold','light','sand'],'jaw','jaw',n=10)
# Broad low-relief imbricated plates, individually varied in size and position.
def plate(name,c,rx,ry,depth,part,joint,pal):
 x,y,z=c
 vs=[(x,y+ry,z),(x,y+ry*.42,z+rx*.82),(x,y-ry*.45,z+rx),(x,y-ry,z+.12*rx),(x,y-ry*.55,z-rx*.85),(x,y+ry*.30,z-rx),(x+depth,y+.02,z), (x-depth*.20,y,z)]
 fs=[(6,i,(i+1)%6) for i in range(6)]+[(7,(i+1)%6,i) for i in range(6)]
 return mesh(name,vs,fs,pal,part,joint)
for side,sig in [('L',-1),('R',1)]:
 ell('Narrow mouth line '+side,(sig*.322,1.405,1.25),(.022,.008,.22),['ochre'],'head',n=8,m=4)
 ell('Eye angular socket '+side,(sig*.365,1.66,1.12),(.057,.115,.15),['ochre','shadow'],'head',n=8,m=5)
 ell('Large amber eye '+side,(sig*.408,1.66,1.135),(.037,.086,.102),['iris'],'head',n=10,m=6)
 ell('Vertical pupil '+side,(sig*.441,1.66,1.15),(.013,.061,.026),['black'],'head',n=8,m=5)
 ell('Catchlight '+side,(sig*.452,1.696,1.177),(.007,.019,.017),['glint'],'head',n=6,m=4)
 plate('Angular gold supraorbital brow '+side,(sig*.372,1.747,1.13),.178,.065,sig*.071,'head','head',['gold','light','ochre'])
 ell('Nostril '+side,(sig*.245,1.56,1.479),(.029,.025,.012),['black'],'head',n=6,m=4)
 cheek=[(.93,1.59,.085,.068),(.80,1.56,.10,.075),(1.035,1.52,.10,.082),(.90,1.47,.12,.088),(.76,1.44,.115,.095),(.98,1.37,.13,.10),(.80,1.31,.13,.11)]
 for j,(z,y,rx,ry) in enumerate(cheek):plate('Overlapping cheek plate '+side+str(j),(sig*(.365+.018*(j%2)),y,z),rx,ry,sig*.042,'head','head',['teal','aqua','aqua','mint'])
 for j,(z,y,rx,ry) in enumerate([(.49,1.34,.16,.20),(.35,1.12,.17,.23),(.56,1.03,.16,.22),(.25,.94,.13,.19)]):
  plate('Shoulder mantle plate '+side+str(j),(sig*(.43+.025*(j%2)),y,z),rx,ry,sig*.07,'neck','neck',['teal','aqua','mint','aqua'])
# Muscular bent forequarters and rear haunches, with broad five-toed grounded paws.
for side,sig in [('L',-1),('R',1)]:
 for end,z,y in [('F',.62,.82),('B',-.70,.65)]:
  part='leg'+end+side
  tube(part+' broad bent limb',[((sig*.43,y,z-.05),.29 if end=='F' else .35),((sig*.63,.53,z-.13),.27),((sig*.76,.30,z+.04),.19),((sig*.84,.145,z+.19),.145)],['gold','sand','light','gold','ochre'],part,[part,'shin'+end+side,'foot'+end+side],n=10)
  ell(part+' broad palm',(sig*.84,.115,z+.22),(.25,.115,.25),['gold','sand','light'],part,'foot'+end+side,n=10,m=4)
  for j in range(5):
   xx=sig*.84+(j-2)*.103;zz=z+.30+.07*(1-abs(j-2)/2);spread=(j-2)*.035
   tube(part+' stout toe '+str(j),[((xx,.11,zz),.078),((xx+spread,.085,zz+.14),.062),((xx+spread*1.25,.067,zz+.20),.038)],['gold','light','sand'],part,['foot'+end+side],n=6)
   tube(part+' hooked dark talon '+str(j),[((xx+spread,.085,zz+.14),.065),((xx+spread*1.5,.065,zz+.25),.049),((xx+spread*1.8,.012,zz+.34),.008)],['claw','shadow','claw'],part,['foot'+end+side],n=6)
  for j in range(4):
   plate(part+' broad wrist scale '+str(j),(sig*(.79+.055*(j%2)),.38-.085*(j//2),z+.10+.085*(j%2)),.10,.095,sig*.052,part,'shin'+end+side,['teal','aqua','mint'])
# Tail sweep becomes a flattened expanded leaf at its terminus.
def paddle_tail():
 vs=[];weights=[];n=10;last=Vector((1,0,0))
 for j,(c,r) in enumerate(tailpath):
  tangent=(Vector(tailpath[min(j+1,len(tailpath)-1)][0])-Vector(tailpath[max(j-1,0)][0])).normalized();u=(last-tangent*last.dot(tangent)).normalized();v=tangent.cross(u);last=u
  breadth=1.70 if j in [5,6,7] else 1.;thickness=.40 if j>=5 else 1.
  for i in range(n):
   t=math.tau*i/n;vs.append(tuple(Vector(c)+r*(math.cos(t)*u*thickness+math.sin(t)*v*breadth)))
   f=j/(len(tailpath)-1)*3;lo=int(f);hi=min(3,lo+1);w=f-lo;weights.append(skin('tail'+str(lo)) if w==0 else [(skin('tail'+str(lo))[0][0],1-w),(skin('tail'+str(hi))[0][0],w)])
 fs=[tuple(reversed(range(n))),tuple((len(tailpath)-1)*n+i for i in range(n))]+[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(tailpath)-1) for i in range(n)]
 mesh('Continuous curled leaf paddle tail',vs,fs,['teal','aqua','teal','gold','sand','gold'],'tail',weights=weights)
paddle_tail()
# Chunky ridge diamonds sink their wide roots into the actual spine profile.
for j,(z,y,h) in enumerate([(.80,1.66,.20),(.57,1.55,.21),(.32,1.43,.22),(.05,1.26,.22),(-.23,1.12,.20),(-.51,1.04,.17),(-.77,.94,.14),(-1.00,.82,.12)]):
 w=.13 if j<5 else .10
 mesh('Anchored alternating dorsal plate '+str(j),[(-w,y-.10,z+.09),(w,y-.10,z+.09),(w*.70,y+.04,z-.14),(0,y+h,z-.04),(-w*.70,y+.04,z-.14),(0,y-.16,z-.09)],[(0,1,3),(1,2,3),(2,4,3),(4,0,3),(0,5,1),(1,5,2),(2,5,4),(4,5,0)],['teal','aqua'] if j%2==0 else ['gold','sand'],'neck' if j<3 else 'body','neck' if j<3 else 'body')
# Wide organic petal silhouettes overlap like a pendulous flower, never a uniform pleated fan.
for j,(x,yy,zz,wide,length) in enumerate([(-.31,1.38,1.17,.23,.53),(.31,1.38,1.17,.23,.55),(-.21,1.36,1.28,.235,.72),(.22,1.37,1.28,.23,.73),(-.095,1.35,1.35,.23,.87),(.11,1.35,1.36,.23,.90),(0,1.34,1.41,.20,.82)]):
 outward=x*.75;outline=[(x-.055,yy,zz),(x+.065,yy,zz),(x+wide+outward*.3,yy-length*.48,zz+.08),(x+wide*.65+outward,yy-length*.88,zz+.015),(x+outward,yy-length,zz-.015),(x-wide*.65+outward,yy-length*.86,zz+.015),(x-wide+outward*.3,yy-length*.46,zz+.08)]
 vs=outline+[(x+outward*.45,yy-length*.50,zz+.15)]+[(xx,y,z-.075) for xx,y,z in outline]
 fs=[(i,(i+1)%7,7) for i in range(7)]+[(8+i,8+(i+1)%7,(i+1)%7,i) for i in range(7)]+[tuple(range(14,7,-1))]
 mesh('Broad overlapping coral throat petal '+str(j),vs,fs,['pink','coral','rose','coral','pink'],'bloom'+str(j))
data={'schema':codec.SCHEMA,'candidate':'bloomthroat-iguana-complete-next','status':'source-only first complete candidate; not visual or runtime acceptance','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y proper rotation','bones':bones,'parts':list(parts.values())}
report=codec.validate_native(data);raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();assert len(raw)<5_000_000;(out/'native-source.json').write_bytes(raw)
dims={'bodyY':.78,'bodyHalfLen':.64,'bodyRadius':.58,'headRadius':.43,'legLen':.75,'feet':[[-.83,.81],[.83,.81],[-.83,-.51],[.83,-.51]],'halfWidth':.55,'capsuleAxis':'z'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/bloomthroat-iguana-native');metadata['bodies'][0].update(kind='bloomthroat-iguana',variant='bloomthroat-iguana');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
arm=bpy.data.armatures.new('Iguana anatomy');rig=bpy.data.objects.new('Bloomthroat Iguana rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.12))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:mod=o.modifiers.new('Authored anatomy skin','ARMATURE');mod.object=rig;o.parent=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'bloomthroat-iguana-complete-next.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
assert (out/'bloomthroat-iguana-complete-next.glb').stat().st_size<1_000_000
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'bloomthroat-iguana-complete-next.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render_dir:
 rd=Path(a.render_dir).resolve();rd.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-1.2
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.14,.20,.27,1);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-3,-4,7),900,5),('Fill',(4,-3,4),650,4),('Rim',(0,4,6),850,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.size=size;bpy.context.object.rotation_euler=(Vector((0,0,1))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.3;target=Vector((.10,.18,.9));views=[('hero',-48,12),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((8*math.sin(ar)*math.cos(er),-8*math.cos(ar)*math.cos(er),8*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(rd/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'actualRender':True,'orthographicScale':5.3})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('IGUANA_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
