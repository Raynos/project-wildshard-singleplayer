"""DI-N10 source reconstruction. Native +Y up/+Z forward; Blender (x,-z,y).
Hero authoritative; hidden sides inferred. Closed component solids, authored skin.
"""
import argparse,sys,math,json,hashlib,importlib.util
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render-dir');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('codec',ROOT/'art/driftwood-isle/approved-puffer/native_export.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
hexes={'sand':'DCA64E','gold':'F1BC62','light':'F9D58B','ochre':'B77D38','shadow':'89603B','teal':'318B91','aqua':'56B1B1','mint':'8AC6B4','rose':'DB3974','pink':'EF5F89','coral':'FF886D','plum':'A83364','claw':'463B37','black':'211C19','iris':'E8A62C','glint':'FFF1C7'}
def linear(h):return [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in [int(h[i:i+2],16)/255 for i in (0,2,4)]]
colors={k:linear(h) for k,h in hexes.items()};materials={}
for k,c in colors.items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,1);m.use_nodes=True;m.use_backface_culling=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.8;materials[k]=m
bones=[]
def bone(name,parent,pos):bones.append({'name':name,'parent':parent,'pos':list(pos)})
bone('body',None,(0,.78,-.2));bone('neck','body',(0,.92,.42));bone('head','neck',(0,1.49,.82));bone('jaw','head',(0,1.48,1.05))
for side,s in [('L',-1),('R',1)]:
 for end,z,y in [('F',.62,.74),('B',-.70,.66)]:
  bone('leg'+end+side,'body',(s*.46,y,z));bone('shin'+end+side,'leg'+end+side,(s*.72,.35,z+.02));bone('foot'+end+side,'shin'+end+side,(s*.83,.13,z+.14))
tailpath=[((0,.67,-.89),.40),((.05,.62,-1.25),.35),((.24,.64,-1.61),.28),((.56,.78,-1.91),.24),((.86,1.02,-1.96),.20),((1.03,1.29,-1.77),.18),((1.01,1.54,-1.44),.14),((.89,1.68,-1.13),.07)]
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
  mi=(i*7+i//5)%len(palette);data.polygons[i].material_index=mi
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
# Core silhouette: long pear-shaped torso, raised chest and blunt reptile head.
ell('Broad golden iguana trunk',(0,.70,-.25),(.55,.49,.88),['sand','gold','ochre','gold','light'],'body',n=14,m=8)
ell('Rising tapered cervical chest',(0,1.10,.48),(.40,.61,.49),['gold','sand','light','ochre'],'neck',n=12,m=7)
ell('Angular iguana skull',(0,1.63,.99),(.37,.27,.43),['gold','light','sand','light'],'head',n=12,m=6)
ell('Broad blunt muzzle',(0,1.58,1.26),(.32,.16,.22),['light','gold','light'],'head',n=10,m=5)
ell('Separated lower jaw',(0,1.43,1.18),(.31,.105,.29),['gold','light','ochre'],'jaw',n=10,m=5)
for s in [-1,1]:
 ell('Dark closed mouth seam '+str(s),(s*.25,1.477,1.20),(.075,.012,.245),['shadow'],'head',n=8,m=4)
 ell('Eye recessed socket '+str(s),(s*.306,1.70,1.045),(.081,.115,.135),['ochre','shadow'],'head')
 ell('Amber alert eye '+str(s),(s*.369,1.70,1.055),(.037,.074,.081),['iris'],'head')
 ell('Vertical dark pupil '+str(s),(s*.401,1.70,1.066),(.012,.050,.024),['black'],'head',n=8,m=5)
 ell('Eye catchlight '+str(s),(s*.411,1.728,1.085),(.007,.015,.012),['glint'],'head',n=6,m=4)
 ell('Heavy upper brow '+str(s),(s*.319,1.79,1.06),(.097,.055,.155),['gold','sand'],'head',n=8,m=4)
 ell('Nostril '+str(s),(s*.20,1.64,1.436),(.035,.026,.012),['black'],'head',n=6,m=4)
 for j in range(4):
  for k in range(3):ell('Overlapping turquoise cheek scale %d %d %d'%(s,j,k),(s*(.335+.019*math.sin(j)),1.60-j*.067,.90-k*.07),(.055,.050,.062),['teal','aqua','mint'],'head',n=6,m=4)
# Four stocky legs, flattened planted palms, five splayed fingers and tapering claws.
for side,s in [('L',-1),('R',1)]:
 for end,z,y in [('F',.62,.74),('B',-.70,.66)]:
  part='leg'+end+side
  tube(part+' continuous articulated limb',[((s*.43,y,z),.24 if end=='F' else .31),((s*.61,.51,z-.08),.23),((s*.74,.30,z+.04),.16),((s*.83,.14,z+.15),.12)],['gold','sand','light','ochre'],part,[part,'shin'+end+side,'foot'+end+side],n=9)
  ell(part+' planted palm',(s*.83,.105,z+.19),(.21,.105,.23),['gold','sand','light'],part,'foot'+end+side,n=8,m=4)
  for j in range(5):
   xx=s*.83+(j-2)*.095;zz=z+.25+.09*(1-abs(j-2)/2)
   tube(part+' finger '+str(j),[((xx,.09,zz),.055),((xx+(j-2)*.018,.065,zz+.13),.042),((xx+(j-2)*.028,.042,zz+.23),.018)],['gold','light','sand'],part,['foot'+end+side],n=5)
   tube(part+' dark claw '+str(j),[((xx+(j-2)*.018,.065,zz+.13),.041),((xx+(j-2)*.04,.025,zz+.29),.005)],['claw','shadow'],part,['foot'+end+side],n=5)
  for j in range(3):ell(part+' turquoise wrist scute '+str(j),(s*(.82+.06*(j-1)),.29+.05*(j%2),z+.14),(.07,.10,.045),['teal','aqua','mint'],part,'shin'+end+side,n=6,m=4)
tube('Continuous curled two-tone tail',tailpath,['gold','teal','aqua','sand','teal','light'],'tail',['tail0','tail1','tail2','tail3'],n=10)
# Tall ridge scutes form the characteristic continuous dorsal silhouette.
for j in range(9):
 z=.64-j*.185;y=1.57-.55*min(1,j/7) if j<8 else .98+(j-8)*.06;h=.14+.06*math.sin(j*.7)**2
 part='neck' if j<4 else 'body' if j<9 else 'tail';joint=part if part!='tail' else 'tail1'
 mesh('Dorsal triangular scute %02d'%j,[(-.07,y,z),( .07,y,z),(0,y+h,z-.10),(0,y+.03,z-.22)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],['teal','aqua','gold','sand'],part,joint)
# Seven thick, overlapping petal lobes hang from the jaw; bright coral ridges.
for j in range(7):
 t=(j-3)/3;root=(t*.055,1.43,1.22);end=(t*.38,.67+.27*abs(t),1.27-.09*abs(t));mid=(t*.23,1.12,1.38);w=.13 if abs(t)<.7 else .11
 vs=[(root[0]-.045,root[1],root[2]),(root[0]+.045,root[1],root[2]),(mid[0]+w,mid[1],mid[2]),(end[0]+w*.55,end[1]+.04,end[2]),end,(end[0]-w*.55,end[1]+.04,end[2]),(mid[0]-w,mid[1],mid[2]),(mid[0],mid[1]-.04,mid[2]+.085)]
 vs+= [(x,y,z-.055) for x,y,z in vs[:7]]
 fs=[(i,(i+1)%7,7) for i in range(7)]+[(8+i,8+(i+1)%7,(i+1)%7,i) for i in range(7)]+[tuple(range(14,7,-1))]
 mesh('Throat bloom thick petal '+str(j),vs,fs,['rose','pink','coral','rose','plum','coral'],'bloom'+str(j))
for j in range(1,7):
 c,r=tailpath[j];x,y,z=c;h=.11
 mesh('Tail attached scute '+str(j),[(x-.055,y+r*.8,z),(x+.055,y+r*.8,z),(x,y+r+h,z+.04),(x,y+r*.9,z-.14)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],['teal','aqua','gold'],'tail','tail'+str(min(3,j//2)))
data={'schema':codec.SCHEMA,'candidate':'bloomthroat-iguana-v2','status':'source-only first complete candidate; not visual or runtime acceptance','coordinates':'right-handed x-right y-up z-forward; Blender x,-z,y proper rotation','bones':bones,'parts':list(parts.values())}
report=codec.validate_native(data);raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode();assert len(raw)<5_000_000;(out/'native-source.json').write_bytes(raw)
dims={'bodyY':.78,'bodyHalfLen':.64,'bodyRadius':.49,'headRadius':.36,'legLen':.75,'feet':[[-.83,.81],[.83,.81],[-.83,-.51],[.83,-.51]],'halfWidth':.55,'capsuleAxis':'z'}
metadata,packed=codec.pack_native_puffer(data,dims,'/assets/driftwood-isle/bloomthroat-iguana-native');metadata['bodies'][0].update(kind='bloomthroat-iguana',variant='bloomthroat-iguana');(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'payload.bin').write_bytes(packed)
arm=bpy.data.armatures.new('Iguana anatomy');rig=bpy.data.objects.new('Bloomthroat Iguana rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
 eb=arm.edit_bones.new(b['name']);eb.head=bp(b['pos']);eb.tail=Vector(eb.head)+Vector((0,0,.12))
 if b['parent']:eb.parent=arm.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:mod=o.modifiers.new('Authored anatomy skin','ARMATURE');mod.object=rig;o.parent=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'bloomthroat-iguana-v2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
assert (out/'bloomthroat-iguana-v2.glb').stat().st_size<1_000_000
report.update({'components':components,'nativeBytes':len(raw),'packedBytes':len(packed),'glbBytes':(out/'bloomthroat-iguana-v2.glb').stat().st_size,'visualAcceptance':False,'runtimeAcceptance':False,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()});(out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render_dir:
 rd=Path(a.render_dir).resolve();rd.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=600;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-1.2
 ground=bpy.data.materials.new('Review ground');ground.diffuse_color=(.14,.20,.27,1);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));bpy.context.object.data.materials.append(ground)
 for name,pos,power,size in [('Key',(-3,-4,7),900,5),('Fill',(4,-3,4),650,4),('Rim',(0,4,6),850,4)]:
  bpy.ops.object.light_add(type='AREA',location=pos);bpy.context.object.name=name;bpy.context.object.data.energy=power;bpy.context.object.data.size=size;bpy.context.object.rotation_euler=(Vector((0,0,1))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.3;target=Vector((.10,.18,.9));views=[('hero',-48,12),('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,89.9),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)];cameras=[]
 for name,az,el in views:
  ar=math.radians(az);er=math.radians(el);camera.location=target+Vector((8*math.sin(ar)*math.cos(er),-8*math.cos(ar)*math.cos(er),8*math.sin(er)));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(rd/(name+'.png'));bpy.ops.render.render(write_still=True);cameras.append({'name':name,'azimuthDegrees':az,'elevationDegrees':el,'actualRender':True,'orthographicScale':5.3})
 (out/'cameras.json').write_text(json.dumps(cameras,indent=2)+'\n')
print('IGUANA_SOURCE_COMPLETE',json.dumps({k:v for k,v in report.items() if k!='components'}))
