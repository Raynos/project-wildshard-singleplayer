"""One integrated derivation from preserved pass4, never edits the base."""
from pathlib import Path
import hashlib
base=Path(__file__).resolve().parent
src=base.parent/'complete-pass4/build_colossus_complete.py'
assert hashlib.sha256(src.read_bytes()).hexdigest()=='4ac78cfb86d5cc48f7ed71ed955fc9ca1389d8dcceff2b37a0078eadf8a83693'
s=src.read_text().replace('complete-pass4','complete-character-next').replace('complete pass 4','complete character next')
# Swept root geometry is changed before the common body transform.
s=s.replace('    vertices = []\n    points =', '''    if any(t in name for t in ('Middle root digit','Inner root digit','Opposed root thumb')):
        sections=[(x,y,1.57+(z-1.57)*.86,w*1.60,d*1.48,*tail) for x,y,z,w,d,*tail in sections]
    if 'Forearm main to outer claw' in name:
        sections=[(x,y,z,w*(1.42 if z<1.65 else 1),d*(1.28 if z<1.65 else 1),*tail) for x,y,z,w,d,*tail in sections]
    vertices = []
    points =''',1)
# Replace the uninterrupted central beak with three forked layered wood paths.
a=s.index("mesh('Long tapered bark mask'"); b=s.index('def face_inlay',a)
s=s[:a]+'''# Central brow descends only to a short nasal split. Long pale identity comes
# from offset cheek blades, separated by real recessed dark wood channels.
root('Central brow nasal keel',[(0,-.40,4.60,.25,.13),(0,-.61,4.36,.13,.09),(.005,-.65,4.11,.075,.07),(0,-.60,3.98,.022,.035)],colors=('lightwood','cut','lightwood','wood','rootshade','wood'),twist=.1)
for s in (-1,1):
    root(f'Layered pale cheek jaw {s}',[(s*.32,-.35,4.44,.16,.14),(s*.30,-.52,4.19,.14,.11),(s*.19,-.62,3.97,.11,.09),(s*.105,-.58,3.72,.032,.045)],colors=('cut','lightwood','cut','wood','darkwood','wood'),twist=s*.27)
    root(f'Outer broken jaw plane {s}',[(s*.42,-.21,4.32,.13,.15),(s*.37,-.36,4.04,.14,.13),(s*.27,-.43,3.86,.055,.065)],colors=('wood','lightwood','cut','rootshade','darkwood','wood'),twist=-s*.4)
root('Recessed split jaw backing',[(0,-.29,4.30,.23,.12),(0,-.37,4.02,.18,.10),(0,-.39,3.80,.075,.05)],colors=('darkwood','rootshade','darkwood'),twist=.1)
''' +s[b:]
# Iris/socket planes stay in the original legible configuration.
# Interlock the rib-like cradle: unequal meandering load routes and tapered ends.
s=s.replace("(-.65,-.48,3.46,.21,.18),(-.19,-.57,3.40,.035,.065)","(-.62,-.46,3.58,.24,.19),(-.37,-.64,3.44,.13,.10),(-.22,-.60,3.32,.035,.055)")
s=s.replace("(.67,-.44,3.38,.20,.17),(.29,-.57,3.24,.04,.07)","(.70,-.42,3.41,.21,.18),(.42,-.61,3.26,.11,.10),(.29,-.57,3.16,.04,.06)")
s=s.replace("(-.71,-.41,2.91,.24,.22),(-.40,-.59,2.75,.20,.15),(-.10,-.48,2.48,.10,.10)","(-.77,-.36,2.96,.25,.21),(-.48,-.56,2.78,.19,.15),(-.23,-.45,2.51,.13,.12),(-.15,-.31,2.31,.045,.06)")
# Keep core fully contained from the rear, using bark rather than foliage to hide it.
pos=s.index('# Hand-authored growth islands:')
s=s[:pos]+'''root('Interlocking rear heart cover',[(-.25,.18,2.79,.24,.18),(-.34,.44,3.10,.27,.18),(-.05,.44,3.46,.28,.19),(.23,.24,3.78,.13,.13)],twist=-.3)
root('Lower diagonal abdominal braid',[(.52,-.13,2.83,.16,.17),(.28,-.43,2.54,.21,.16),(-.07,-.47,2.34,.16,.13),(-.29,-.32,2.13,.045,.06)],twist=.55)
''' + s[pos:]
# Growth masses become smaller rooted cores with broad-to-point cascading leaves;
# varied triplets lie in 3D along the support rather than as roof slabs.
s=s.replace('    growth(name,center,extent,yaw,pitch)', '''    growth(name,center,(extent[0]*.76,extent[1]*.77,extent[2]*.68),yaw,pitch)
    hanging=.66 if ('shoulder' in name.lower() or 'scapul' in name.lower() or 'back' in name.lower()) else .48
    for j,(across,down) in enumerate(((-.42,.82),(.22,1.12),(.65,.65))):
        x,y,z=center
        dx=math.cos(yaw)*across*extent[0];dy=math.sin(yaw)*across*extent[0]
        outward=1 if y>.18 else -1
        start=(x+dx,y+dy+outward*.08,z+.05-j*.045)
        tip=(x+dx+math.cos(yaw)*(.12 if j==2 else -.08),y+dy+outward*extent[1]*.64,z-hanging*down)
        leaf(name+f' layered cascade {j}',start,tip,extent[0]*(.42 if j==1 else .34),'leaf',yaw*.3+j*.31)''')
# Native editable mesh document: exact material-separated source faces and pivots.
pos=s.index('bpy.context.view_layer.update()\nbpy.ops.object.select_all')
s=s[:pos]+'''# Native geometry document supports round-trip reconstruction without GLB loss.
native={'schema':'wildshard.editable-mesh.v1','front':'-Y','units':'meters','status':'static unaccepted anatomy; no animation approval','palette':palette,'parts':[]}
for ob in parts:
    verts=[list(v.co) for v in ob.data.vertices]
    center=[sum(v[i] for v in verts)/len(verts) for i in range(3)]
    native['parts'].append({'name':ob.name,'vertices':verts,'faces':[list(f.vertices) for f in ob.data.polygons],'faceMaterials':[ob.data.materials[f.material_index].name for f in ob.data.polygons],'editPivot':center})
(out/'editable-native.json').write_text(json.dumps(native,separators=(',',':'))+'\\n')
''' +s[pos:]
(base/'build_colossus_complete.py').write_text(s)
# Triangulate after all shape-space edits; n-gon normals otherwise contradict
# individual exported facets on the twisted load roots.
s=s.replace('# Native geometry document supports', '''for ob in parts:
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data);bm.free();ob.data.update()
# Native geometry document supports''')
(base/'build_colossus_complete.py').write_text(s)
# Drop only duplicate mesh labels from GLB JSON: node names retain exact identity.
# Geometry/accessors/materials/buffer bytes are unchanged.
s=s.replace("points=[ob.matrix_world",'''import struct
raw=glb.read_bytes();jslen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jslen]);binary=raw[20+jslen:]
for item in doc['meshes']:item.pop('name',None)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+binary)
points=[ob.matrix_world''')
(base/'build_colossus_complete.py').write_text(s)
