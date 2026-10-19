"""Rebuild frozen sources and render exact matched views; never write to inputs."""
import hashlib,json,runpy,sys,struct
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
RAW=ROOT/'tmp/mantis-cervical-frame-visual'
BASE=HERE.parent
ROLES={'baseline':'complete-pass2','candidate':'cervical-frame-repair'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def semantics(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
 for k in ['materials','meshes']:
  for entry in j[k]:entry.pop('name',None)
 return j,b[28+n:]
points=[Vector(v) for suffix in ROLES.values() for part in json.loads((BASE/suffix/('mantis-mesh-'+suffix+'.json')).read_text())['parts'] for v in part['vertices']]
center=Vector(tuple((min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)))
views={'hero':(-5.5,-8,3.4),'front':(0,-10,0),'left':(-10,0,0),'right':(10,0,0),'back':(0,10,0),'top':(0,-.001,10),'diag-front':(0,-10,8),'diag-left':(-10,0,8),'diag-right':(10,0,8),'diag-back':(0,10,8)}
cameras={};aspect=638/900
for view,offset in views.items():
 location=Vector(offset) if view=='hero' else center+Vector(offset)
 rotation=(center-location).to_track_quat('-Z','Y');local=[rotation.inverted()@(p-location) for p in points]
 xmin,xmax=min(p.x for p in local),max(p.x for p in local);ymin,ymax=min(p.y for p in local),max(p.y for p in local)
 location+=rotation@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
 cameras[view]={'location':list(location),'rotation':list(rotation.to_euler()),'orthoScale':max(ymax-ymin,(xmax-xmin)/aspect)*1.12}
common=max(c['orthoScale'] for v,c in cameras.items() if v!='hero')
for v,c in cameras.items():
 if v!='hero':c['orthoScale']=common
lights=[('Key',(-3,-4,7),700,4),('Fill',(4,-2,4),400,4),('Rim',(0,5,5),850,3)]
settings={'engine':'CYCLES','samples':20,'denoising':False,'seed':0,'resolution':[638,900],'worldColor':[.15,.15,.15],'viewTransform':'AgX','groundDiffuse':[.00209,.00286,.00350,1],'lights':lights,'lightTarget':[0,0,1.7]}
(HERE/'cameras.json').write_text(json.dumps({'method':'Identical paired union-bounds cameras; common nine-view scale; separate union-bounds hero','cameras':cameras,'settings':settings},indent=2)+'\n')
receipts={}
for role,suffix in ROLES.items():
 dest=RAW/role;dest.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 source=BASE/suffix/'build_mantis_complete.py';before=sha(source)
 sys.argv=['build','--','--out',str(dest)];g=runpy.run_path(str(source))
 # Reject any unanticipated rebuilt geometry, materials or exported binary difference.
 for stem in ['mantis-mesh-','metrics-']:
  name=stem+suffix+'.json';assert json.loads((dest/name).read_text())==json.loads((BASE/suffix/name).read_text()),name
 glb='mantis-study-'+suffix+'.glb'
 assert semantics(dest/glb)==semantics(BASE/suffix/glb),'GLB non-name data changed'
 assert before==sha(source)
 receipts[role]={'sourceSha256':before,'frozenGlbSha256':sha(BASE/suffix/glb),'rebuiltGlbSha256':sha(dest/glb),'glbAllNonNameDataAndBinaryEqual':True,'meshAndMetricsEqual':True,'sourcePath':str(source.relative_to(ROOT)),'capturedViews':{}}
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False;scene.cycles.seed=0
 scene.render.resolution_x=638;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 if scene.world is None:scene.world=bpy.data.worlds.new('Matched world')
 scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.compression=100
 mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.00209,.00286,.00350,1)
 bpy.ops.mesh.primitive_plane_add(size=100);bpy.context.object.data.materials.append(mat)
 for name,pos,power,size in lights:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Matched');cam=bpy.data.objects.new('Matched',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO'
 for view,data in cameras.items():
  cam.location=data['location'];cam.rotation_euler=data['rotation'];d.ortho_scale=data['orthoScale'];scene.render.filepath=str(dest/(view+'.png'));bpy.ops.render.render(write_still=True)
  receipts[role]['capturedViews'][view]={'camera':data,'settings':settings,'sha256':sha(dest/(view+'.png'))}
 (HERE/'capture-provenance.json').write_text(json.dumps(receipts,indent=2)+'\n')
 # Only builder-created scratch blend is dispensable. Frozen input folders untouched.
 for p in dest.glob('*.blend'):p.unlink()
