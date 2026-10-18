"""V30 from V9: complete-identity refinement against the approved low-poly target. Mesh implementation remains unaccepted.
Blender 4.3: -b -t 2 --python-exit-code 1 -P <source> -- --out tmp/puffer-lowpoly-v30-from-v9 --render
No old assets replaced; no runtime wiring. X right, Y forward, Z up.
"""
import argparse,json,math,random,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');p.add_argument('--nine-views',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);random.seed(4877)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
PI=math.pi
PALETTE={'teal':(.12,.39,.38),'light':(.20,.48,.44),'dark':(.055,.25,.26),'ochre':(.91,.43,.075),'gold':(1,.62,.17),'cream':(.95,.82,.56),'ivory':(1,.91,.70),'socket':(.39,.24,.09),'black':(.012,.021,.021),'mouth':(.21,.058,.022),'tongue':(.72,.24,.09)}
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
mat=bpy.data.materials.new('Matte semantic color fields');mat.use_nodes=True;shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.85;attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Col';mat.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
parts=[]
def mesh(name,verts,faces,color,joint='belly',variation=.045,face_colors=None,fix=True):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    if fix:
        bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);d.materials.append(mat)
    paint=d.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for i,poly in enumerate(d.polygons):
        key=face_colors[i] if face_colors is not None else color;rgb=PALETTE[key] if isinstance(key,str) else key;gain=1+random.uniform(-variation,variation)
        for li in poly.loop_indices:paint.data[li].color=tuple(linear(max(0,min(1,c*gain)))for c in rgb)+(1,)
    vg=ob.vertex_groups.new(name=joint);vg.add(list(range(len(verts))),1,'REPLACE');parts.append((ob,joint));return ob

def loft(name,rows,color,joint='belly',variation=.045):
    n=len(rows[0]);vs=[v for r in rows for v in r];fs=[]
    for j in range(len(rows)-1):
        for i in range(n):
            q=j*n+i;r=j*n+(i+1)%n;s=(j+1)*n+(i+1)%n;t=(j+1)*n+i
            fs.extend([(q,r,s),(q,s,t)] if (i+j)%2 else [(q,r,t),(r,s,t)])
    fs.extend([tuple(reversed(range(n))),tuple((len(rows)-1)*n+i for i in range(n))]);return mesh(name,vs,fs,color,joint,variation)

# Sparse authored longitudinal sections. Crown is highest behind the eyes and slopes into the face.
SECTIONS=[(-.76,.10,.64,.13),(-.59,.30,.72,.31),(-.39,.49,.79,.44),(-.15,.60,.80,.53),(.10,.61,.79,.52),(.33,.55,.81,.44),(.55,.44,.84,.31),(.73,.28,.83,.18),(.82,.11,.81,.08)]
def section(y):
    for x,z in zip(SECTIONS,SECTIONS[1:]):
        if x[0]<=y<=z[0]:
            t=(y-x[0])/(z[0]-x[0]);return tuple(x[i]*(1-t)+z[i]*t for i in range(1,4))
    return SECTIONS[0][1:] if y<SECTIONS[0][0] else SECTIONS[-1][1:]
def surface(y,angle,offset=0):
    w,z,h=section(y);return Vector(((w+offset)*math.sin(angle),y,z+(h+offset)*math.cos(angle)))
rows=[]
for y,w,z,h in SECTIONS:rows.append([(w*math.sin(2*PI*i/14),y,z+h*math.cos(2*PI*i/14))for i in range(14)])
body=loft('Sloping faceted cranial body',rows,'teal')

# Only fourteen broad, thick-edged mantle plates. No chips, grooves or scale carpet.
def plate(name,y,angle,length,half_angle,color):
    outline=[(-.45,-.68),(-.48,.35),(-.12,.58),(.46,.30),(.48,-.45),(.02,-.62)]
    vs=[]
    for xx,yy in outline:vs.append(tuple(surface(y+yy*length,angle+xx*half_angle,.014)))
    vs.append(tuple(surface(y+.03*length,angle,.045)))
    for xx,yy in outline:vs.append(tuple(surface(y+yy*length,angle+xx*half_angle,-.045)))
    fs=[(i,(i+1)%6,6)for i in range(6)]+[(i,7+i,7+(i+1)%6,(i+1)%6)for i in range(6)]+[tuple(7+i for i in reversed(range(6)))]
    return mesh(name,vs,fs,color,variation=.025)
for row,(y,length) in enumerate([(-.43,.36),(-.12,.39),(.20,.36),(.45,.27)]):
    for col,angle in enumerate([-.95,-.32,.32,.95] if row<3 else [-.38,.38]):
        plate(f'Broad mantle plate {row}-{col}',y,angle,length,.88,'light' if (row+col)%4==1 else'teal')

def union_into_body(ob):
    global parts
    bpy.context.view_layer.objects.active=body
    mod=body.modifiers.new('Continuous authored volume','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts=[entry for entry in parts if entry[0]!=ob]
    bpy.data.objects.remove(ob,do_unlink=True)
for ob,joint in list(parts):
    if ob.name.startswith('Broad mantle plate'):union_into_body(ob)

# V9 silhouette correction: dominant low forward pouch and short broad weight-bearing feet.
# Broad ivory egg/pouch: large planar faces, no fine pleats. Mouth is physically cut through it.
rows=[]
for j,lat in enumerate([-1.50,-1.12,-.68,-.20,.28,.70,1.10,1.48]):
    rr=[]
    for i in range(14):
        angle=2*PI*(i+(.30 if j%2 and j<5 else 0))/14;rad=math.cos(lat);width=.58*rad*(1+.025*math.sin(lat))
        z=.56+.48*math.sin(lat)
        if z<.34:z=.17+(z-.08)*.66
        rr.append((width*math.sin(angle),.55+.49*rad*math.cos(angle),z))
    rows.append(rr)
pouch=loft('Broad ivory throat planes',rows,'ivory',variation=.065)
union_into_body(pouch);pouch=body
body.name='Continuous mantle cheek and pouch'
# Low wide open beak, with true rear cavity. Cut the same opening through skull and pouch.
outline=[(-.19,.80),(-.20,.855),(-.135,.94),(0,1.025),(.135,.94),(.20,.855),(.19,.80),(.08,.785),(-.08,.785)]
vs=[]
for y in [.62,1.40]:vs.extend([(x,y,z)for x,z in outline])
n=len(outline);fs=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,n+(i+1)%n,n+i)for i in range(n)]
cutter=mesh('Mouth construction cutter',vs,fs,'mouth')
for ob in [pouch]:
    bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('Open mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
parts=[r for r in parts if r[0]!=cutter];bpy.data.objects.remove(cutter,do_unlink=True)
mesh('Dark recessed palate',[(x*.96,.87,.884+(z-.884)*.96)for x,z in outline],[tuple(range(n))],'mouth','head',0)
mesh('Tongue inside mouth',[(-.115,.98,.818),(.115,.98,.818),(.085,.92,.855),(-.085,.92,.855)],[(0,1,2,3)],'tongue','head',.02)

# Cream face/beak is a broad solid ribbon following the mouth, not a loose outline.
inner=[(-.20,.955,.805),(-.135,.985,.93),(0,1.005,1.025),(.135,.985,.93),(.20,.955,.805)]
outer=[(-.255,.86,.83),(-.215,.89,.985),(0,.96,1.075),(.215,.89,.985),(.255,.86,.83)]
vs=inner+outer+[(x,y-.065,z)for x,y,z in inner]+[(x,y-.065,z)for x,y,z in outer];fs=[]
for i in range(4):fs.extend([(i,i+1,i+6),(i,i+6,i+5),(i+10,i+15,i+16,i+11),(i,i+10,i+11,i+1),(i+5,i+6,i+16,i+15)])
fs.extend([(0,5,15,10),(4,14,19,9)])
mesh('Continuous cream facial beak planes',vs,fs,'cream','head',.035)
mesh('Small hooked beak tip',[(-.040,1.022,1.034),(.040,1.022,1.034),(0,1.045,.970),(0,.98,1.05)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'ivory','head')
for sign in [-1,1]:
    x=sign*.058
    mesh(f'Bridge nostril {sign}',[(x-.012,1.015,1.042),(x,1.019,1.052),(x+.012,1.015,1.042),(x,1.019,1.034)],[(0,1,2,3)],'mouth','head',0)
loft('Lower lip',[[(x,.985+.037*math.cos(k*PI/3),.80+.027*math.sin(k*PI/3))for k in range(6)]for x in[-.17,-.08,.08,.17]],'cream','head',.03)

# Connected dorsal nose roof closes the unintended mouth-to-forehead opening.
roof=[(-.215,.89,.985),(0,.96,1.075),(.215,.89,.985),(-.215,.60,1.025),(0,.61,1.105),(.215,.60,1.025)]
verts=roof+[(x,y,z-.045)for x,y,z in roof]
faces=[(0,1,4,3),(1,2,5,4),(6,9,10,7),(7,10,11,8),(0,3,9,6),(2,8,11,5),(0,6,7,1),(1,7,8,2),(3,4,10,9),(4,5,11,10)]
union_into_body(mesh('Connected warm nose roof',verts,faces,'cream','belly',.025))
for ob,joint in list(parts):
    if ob.name in ('Continuous cream facial beak planes','Small hooked beak tip'):union_into_body(ob)

# Real local orbital cavities, retaining round amber lower lobes and thick orange brows.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update();uncut_hull=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
frames={};clearances=[]
for sign in[-1,1]:
    theta=math.radians(24)*sign;n=Vector((math.sin(theta),math.cos(theta),0));t=Vector((n.y,-n.x,0));up=Vector((0,0,1))
    landmark=Vector((sign*.34,.65,1.00));hit,_,_,_=uncut_hull.ray_cast(landmark+n*2,-n,4)
    if hit is None:raise RuntimeError('No actual hull at V9 orbital landmark')
    origin=hit+t*(sign*.026)-up*.015
    depths=[]
    for k in range(32):
        angle=2*PI*k/32;u=math.cos(angle);v=min(math.sin(angle),.45+.35*u*sign)
        sample=origin+t*(.112*u)+up*(.084*v);surface_hit,_,_,_=uncut_hull.ray_cast(sample+n*2,-n,4)
        if surface_hit is None:raise RuntimeError('Missing actual orbital surface')
        depths.append((surface_hit-origin).dot(n))
    safe=min(depths)-.023;frames[sign]=(origin,n,t,safe)
    rows=[]
    for depth in [safe-.09,.20]:
        rows.append([tuple(origin+n*depth+t*(.143*math.cos(k*2*PI/24))+up*(.108*min(math.sin(k*2*PI/24),.60+.32*math.cos(k*2*PI/24)*sign)))for k in range(24)])
    cutter=loft(f'Actual orbital cavity {sign}',rows,'socket','head',0)
    marker=mat.copy();marker.name=f'Explicit socket wall {sign}';body.data.materials.append(marker);cutter.data.materials.clear();cutter.data.materials.append(marker)
    bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Actual inset orbit','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
    parts=[r for r in parts if r[0]!=cutter];bpy.data.objects.remove(cutter,do_unlink=True)
    # Solid slanted brow is rooted in hull, with front edge aligned to the true aperture.
    def pt(u,z,d):return tuple(origin+t*u+up*z+n*d)
    lower=[(-.155,.045-.30*sign*.155),(.155,.045+.30*sign*.155)]
    vs=[pt(u,z,.025)for u,z in lower]+[pt(u,z+.070,-.005)for u,z in lower]+[pt(u,z,-.12)for u,z in lower]+[pt(u,z+.070,-.12)for u,z in lower]
    brow=mesh(f'Integrated orange orbital brow {sign}',vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'ochre','belly',.025)
    union_into_body(brow)

# Shared semantic cuts create a warm cheek stripe without independent overlay cards.
bm=bmesh.new();bm.from_mesh(body.data)
planes=[((.20,0,0),(1,0,0)),((-.20,0,0),(1,0,0)),((.55,0,0),(1,0,0)),((-.55,0,0),(1,0,0)),((0,.25,0),(0,1,0))]
for sign in[-1,1]:
    planes.extend([((0,0,.80),(-sign*.28,0,1)),((0,0,.92),(-sign*.28,0,1))])
for co,no in planes:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=co,plane_no=no,clear_inner=False,clear_outer=False)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
paint=body.data.color_attributes.get('Col')
for face in body.data.polygons:
    c=face.center;key=None
    if .20<abs(c.x)<.55 and c.y>.25 and .80+.28*abs(c.x)<c.z<.92+.28*abs(c.x):key='ochre'
    if face.material_index>0:key='socket'
    if key:
        for li in face.loop_indices:paint.data[li].color=tuple(linear(v)for v in PALETTE[key])+(1,)
    face.material_index=0
body.data.materials.clear();body.data.materials.append(mat)
bpy.context.view_layer.update();cut_hull=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get());visibility={}
for sign in[-1,1]:
    origin,n,t,safe=frames[sign];up=Vector((0,0,1))
    def iris_surface(name,rx,rz,depth,color,shift=(0,0)):
        rows=[]
        for rad,bulge in[(1,0),(.70,.002),(.25,.003),(.01,.003)]:
            row=[]
            for k in range(20):
                angle=k*2*PI/20;u=math.cos(angle);v=min(math.sin(angle),.45+.35*u*sign)if color=='gold' else math.sin(angle)
                point=origin+t*(rx*rad*u+shift[0])+up*(rz*rad*v+shift[1])+n*(depth+bulge)
                hit,_,_,_=uncut_hull.ray_cast(point+n*2,-n,4)
                if hit is None:raise RuntimeError('Eye has no enclosing original surface')
                clearance=(hit-point).dot(n);clearances.append(clearance)
                if clearance<.006:raise RuntimeError('Eye escapes actual hull surface')
                row.append(tuple(point))
            rows.append(row)
        loft(name,rows,color,'head',0)
    iris_surface(f'Round recessed amber eye {sign}',.112,.084,safe,'gold')
    iris_surface(f'Recessed pupil {sign}',.040,.050,safe+.003,'black',(0,-.005))
    iris_surface(f'Eye highlight {sign}',.011,.012,safe+.006,'ivory',(-sign*.018,.022))
    center=origin-up*.005+n*(safe+.006)
    visibility[str(sign)]={}
    for label,camera in [('front',Vector((0,4.9425,.89))),('hero',Vector((3,4.6,2.35)))]:
        direction=(center-camera).normalized();hit,_,index,_=cut_hull.ray_cast(camera,direction,(center-camera).length)
        visibility[str(sign)][label]={'blockedByHull':hit is not None,'hit':list(hit)if hit is not None else None,'faceIndex':index}
(out/'eye-containment.json').write_text(json.dumps({'testedVertices':len(clearances),'minimumClearance':min(clearances),'method':'actual union-hull raycasts in local orbital frames; measured before shared10cm stance translation'},indent=2))
(out/'eye-visibility.json').write_text(json.dumps(visibility,indent=2))

# Solid articulated feet: broad shoulder cross section, sloping midfoot and chunky radial tips.
def fin(sign,rear=False):
    joint=('rearL'if sign>0 else'rearR')if rear else('finL'if sign>0 else'finR')
    cy=-.34 if rear else .22
    scale=.82 if rear else 1
    # Closed horizontal cross-sections supply real fore/aft volume at every station.
    stations=[(sign*.33,cy,.60*scale,.105,.105),
              (sign*.48,cy+.16,.20*scale,.20,.14),
              (sign*.60,cy+.36,.11,.275,.18),
              (sign*.66,cy+.45,.004,.30,.18)]
    n=12;vs=[]
    for cx,yy,z,rx,ry in stations:
        for k in range(n):
            t=2*PI*k/n
            vs.append((cx+rx*math.cos(t),yy+ry*math.sin(t),z))
    fs=[];colors=[]
    for j in range(3):
        for k in range(n):
            q=j*n+k;r=j*n+(k+1)%n;u=(j+1)*n+k;v=(j+1)*n+(k+1)%n
            fs.extend([(q,r,v),(q,v,u)])
            colors.extend(['ochre' if j==2 else 'light' if j==1 else 'teal']*2)
    fs.extend([tuple(reversed(range(n))),tuple(3*n+k for k in range(n))]);colors.extend(['teal','ochre'])
    mesh(f'Volumetric connected {joint}',vs,fs,'teal',joint,.035,colors)
    cx,cy,z,rx,ry=stations[-1]
    for i in range(4):
        u=(i-1.5)/1.5;x=cx+u*.24
        base_y=cy+ry*math.sqrt(max(0,1-(u*.82)**2))-.055
        tip=(x+u*.026,base_y+.145,.004)
        mesh(f'{joint} cream toe {i}',[(x-.082,base_y,.085),(x+.082,base_y,.085),tip,(x,base_y-.018,0)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'ivory',joint,.04)
for sign in[-1,1]:fin(sign);fin(sign,True)

# Small polygonal tail fan with a single ochre border.
rows=[]
for y,r in[(-.63,.12),(-.84,.09),(-.94,.06)]:rows.append([((-.63-y)*.9+r*math.cos(k*PI/4),y,.68+r*math.sin(k*PI/4))for k in range(8)])
loft('Tail root',rows,'teal','tail')
vs=[];n=12
for side in[-1,1]:
    for radius in[.006,.235,.29]:
        for k in range(n):
            theta=k*2*PI/n
            vs.append((.29+side*.045,-1.0+radius*math.cos(theta),.68+radius*math.sin(theta)))
fs=[];colors=[]
for side in range(2):
    offset=side*3*n
    for band in range(2):
        for k in range(n):
            q=offset+band*n+k;r=offset+band*n+(k+1)%n;u=q+n;v=r+n
            fs.extend([(q,r,v),(q,v,u)]);colors.extend(['ochre','ochre'] if band else ['teal','light'])
    fs.append(tuple(offset+k for k in range(n)));colors.append('teal')
for k in range(n):
    q=2*n+k;r=2*n+(k+1)%n;fs.append((q,r,r+3*n,q+3*n));colors.append('ochre')
mesh('Full angular tail fan with ochre face border',vs,fs,'teal','tail',.035,colors)

# Eight purposeful cream spines, large form hierarchy only.
def spine(name,base,tip,r):
    base=Vector(base);tip=Vector(tip);d=(tip-base).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u).normalized()
    vs=[tuple(base+u*math.cos(k*2*PI/4)*r+v*math.sin(k*2*PI/4)*r*.70)for k in range(4)]+[tuple(tip)]
    mesh(name,vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'ivory',variation=.055)
for i,(y,angle,length,r)in enumerate([(-.43,0,.24,.12),(-.12,0,.28,.13),(.21,0,.22,.10),(-.27,-.95,.22,.10),(-.27,.95,.22,.10),(.15,-1.15,.16,.08),(.15,1.15,.16,.08),(-.53,1.55,.13,.075)]):
    base=surface(y,angle,-.018);spine(f'Cream crown spine {i}',base,base+Vector((math.sin(angle)*length*.55,-length*.24,length*.88)),r)

# V29 stance: lower complete core/face/spines/tail by 10 cm, retaining proportions.
# Matching body/belly/head/tail absolute bind pivots are explicitly lowered below.
for ob,joint in parts:
    if joint in ('belly','head','tail'):
        for vertex in ob.data.vertices:vertex.co.z-=.10
        ob.data.update()

# Eight-joint contract remains available for future arena integration; no runtime replacement here.
REST={'body':(None,(0,0,.60)),'belly':('body',(0,0,.60)),'head':('belly',(0,.50,.83)),'tail':('body',(0,-.70,.58)),'finL':('body',(.43,.16,.50)),'finR':('body',(-.43,.16,.50)),'rearL':('body',(.43,-.36,.50)),'rearR':('body',(-.43,-.36,.50))}
d=bpy.data.armatures.new('Puffer low-poly rig');arm=bpy.data.objects.new('Puffer low-poly rig',d);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,xyz)in REST.items():
    b=d.edit_bones.new(name);b.head=xyz;b.tail=Vector(xyz)+Vector((0,0,.12))
    if parent:b.parent=d.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
triangles=0
for ob,joint in parts:
    group=ob.vertex_groups.get(joint) or ob.vertex_groups.new(name=joint);group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);mod=ob.modifiers.new('Skin','ARMATURE');mod.object=arm;ob.parent=arm
# Boolean/bisect interpolation can overshoot corner colour range by float error.
paint_corrections=[]
for ob,joint in parts:
    for datum in ob.data.color_attributes['Col'].data:
        rgba=tuple(datum.color)
        if not all(math.isfinite(value)for value in rgba):raise RuntimeError('Non-finite interpolated paint')
        if min(rgba)<0 or max(rgba)>1:
            paint_corrections.append(rgba)
            datum.color=tuple(max(0,min(1,value))for value in rgba)
(out/'paint-range.json').write_text(json.dumps({'clampedCorners':len(paint_corrections),'minimumBefore':min((min(v)for v in paint_corrections),default=0),'maximumBefore':max((max(v)for v in paint_corrections),default=1)},indent=2))
# Consolidate components by joint without changing geometry or corner colours.
merged_parts=[]
for joint in REST:
    owned=[ob for ob,name in parts if name==joint]
    if not owned:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in owned:ob.select_set(True)
    bpy.context.view_layer.objects.active=owned[0]
    if len(owned)>1:bpy.ops.object.join()
    merged_parts.append((bpy.context.object,joint))
parts=merged_parts
sys.path.insert(0,str(Path(__file__).resolve().parent))
from native_export import export_native_puffer
export_native_puffer(out/'puffer-native-v30.json',[ob for ob,joint in parts],arm)
bpy.ops.object.select_all(action='DESELECT')
for ob,joint in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Puffer style revision skin'
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'puffer-style-v30.glb'),export_format='GLB',use_selection=True,export_animations=False)
(out/'metrics.json').write_text(json.dumps({'status':'approved low-poly target; implementation unaccepted','triangles':triangles,'joints':8,'materials':1,'glbBytes':(out/'puffer-style-v30.glb').stat().st_size},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'inspection.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Studio');floor.diffuse_color=(.028,.045,.06,1)
    ob=mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],'dark');ob.data.materials.clear();ob.data.materials.append(floor)
    def light(name,xyz,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,4,5),650,4,(1,.90,.76));light('Cool fill',(4,1,3),360,4,(.73,.87,1));light('Rim',(0,-4,4),500,3,(.66,.87,1))
    d=bpy.data.cameras.new('Matched style camera');cam=bpy.data.objects.new('Matched style camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=3.2;cam.location=(3.0,4.6,2.25);cam.rotation_euler=(Vector((0,-.03,.84))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-style.png');bpy.ops.render.render(write_still=True)

    if a.nine_views:
        scene.render.resolution_x=600;scene.render.resolution_y=740;scene.cycles.samples=24
        shots=[('01-front',0,0),('02-left',90,0),('03-right',-90,0),('04-back',180,0),('05-top',0,90),('06-elevated-front',0,39.2894),('07-elevated-left',90,39.2894),('08-elevated-right',-90,39.2894),('09-elevated-back',180,39.2894)]
        points=[skin.matrix_world@v.co for v in skin.data.vertices]
        lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
        target=Vector((0,-.05750000476837158,.7900000214576721));radius=max((v-target).length for v in points)
        d.ortho_scale=3.919041395187378
        assert radius<d.ortho_scale*(600/740)/2/1.04, 'Shared V27 camera no longer fits with margin'
        (out/'nine-view-camera.json').write_text(json.dumps({'projection':'orthographic','fixedScale':d.ortho_scale,'target':list(target),'unionRadius':radius,'framingSource':'fixed V27 union fit; reused unchanged for fair V9 comparison','minimumMargin':.04,'imageSize':[600,740],'sameCameraForAllNine':True},indent=2))
        for label,yaw,elevation in shots:
            yaw=math.radians(yaw);el=math.radians(elevation)
            cam.location=target+Vector((5*math.sin(yaw)*math.cos(el),5*math.cos(yaw)*math.cos(el),5*math.sin(el)))
            cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
