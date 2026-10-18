"""Puffer approved low-poly target study. Mesh implementation remains unaccepted.
Blender 4.3: -b -t 2 --python-exit-code 1 -P <source> -- --out tmp/puffer-lowpoly-v14 --render
No old assets replaced; no runtime wiring. X right, Y forward, Z up.
"""
import argparse,json,math,random,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
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
# V13: single closed three-dimensional hull, including the entire forward pouch.
# Cross-sections are anatomical masses; shared ring indices close sides/underside.
HULL=[(.12,.22,.27,.30),(.18,.40,.24,.53),(.34,.53,.18,.68),(.59,.63,.10,.79),(.82,.63,.045,.80),(1.00,.55,.005,.71),(1.16,.39,-.12,.53),(1.29,.19,-.23,.28),(1.335,.025,-.24,.045)]
rows=[]
for j,(z,w,cy,depth)in enumerate(HULL):
    row=[]
    for k in range(20):
        theta=2*PI*(k+(.40 if j%2 else 0))/20
        # Front cheek planes lean into the pouch, rear contour tapers toward tail.
        x=w*math.sin(theta);y=cy+depth*math.cos(theta)
        zz=z+(.040*math.sin(theta*3+j*1.17) if 0<j<8 else 0)
        if j>=5:zz-=.045*max(0,math.cos(theta))
        row.append((x,y,zz))
    rows.append(row)
hull=loft('Closed pear hull with continuous cheek and pouch',rows,'teal','belly',.02)
# Build cavity tools in one local frame per orbit. This first test deliberately
# has only dark sockets, without iris or brow overlays, to judge rounded anatomy.
def cavity(name,center,normal,rx,rz,depth):
    n=Vector(normal).normalized();t=Vector((n.y,-n.x,0));up=Vector((0,0,1));c=Vector(center);rr=[]
    for distance,scale in[(-depth,.82),(-.02,1),(depth,1)]:
        row=[]
        for k in range(16):
            angle=2*PI*k/16;u=math.cos(angle);v=math.sin(angle)
            # Upper arc is clipped by the diagonal brow boundary, lower remains round.
            vv=min(v,.30+.50*u) if name.startswith('Orbit')else v
            row.append(tuple(c+n*distance+t*(rx*u*scale)+up*(rz*vv*scale)))
        rr.append(row)
    return loft(name,rr,'black','head',0)
def subtract(tool):
    global parts
    bpy.context.view_layer.objects.active=hull;mod=hull.modifiers.new('Inset anatomical cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=tool;bpy.ops.object.modifier_apply(modifier=mod.name)
    parts=[r for r in parts if r[0]!=tool];bpy.data.objects.remove(tool,do_unlink=True)
for sign in[-1,1]:
    theta=math.radians(26)*sign;n=Vector((math.sin(theta),math.cos(theta),0));c=Vector((sign*.27,.65,1.035));subtract(cavity(f'Orbit {sign}',c,n,.145,.125,.21))
# Small mouth opening: broad triangular upper arch and rounded lower corners.
outline=[(-.20,.847),(-.18,.935),(0,1.018),(.18,.935),(.20,.847),(.09,.825),(-.09,.825)]
v=[]
for y in[.47,1.08]:v.extend([(x,y,z)for x,z in outline])
n=len(outline);f=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,n+(i+1)%n,n+i)for i in range(n)]
subtract(mesh('Mouth cavity construction',v,f,'mouth','head',0))
# Mandatory closed-surface gate before rendering/export; no tolerance for open seams.
bm=bmesh.new();bm.from_mesh(hull.data)
nonmanifold=sum(not e.is_manifold for e in bm.edges)
bm.free()
(out/'hull-topology.json').write_text(json.dumps({'nonManifoldEdges':nonmanifold,'closed':nonmanifold==0},indent=2))
if nonmanifold:raise RuntimeError(f'Closed anatomy gate failed: {nonmanifold} non-manifold edges')
# Repaint the single hull after cavity construction, using actual face positions.
paint=hull.data.color_attributes.get('Col')
for face in hull.data.polygons:
    c=face.center;front=c.y> .18
    cream=front and c.z<(.96-.12*abs(c.x))
    key='ivory' if cream else 'teal'
    if front and abs(c.x)>.17 and abs(c.z-(.91+.20*abs(c.x)))<.045:key='ochre'
    # Inward-facing orbital/mouth walls are dark, never raised rings.
    if front and face.normal.y<-.15 and c.z>.80:key='mouth' if abs(c.x)<.20 else'black'
    rgb=PALETTE[key]
    for li in face.loop_indices:paint.data[li].color=tuple(linear(v)for v in rgb)+(1,)

# Solid articulated feet: broad shoulder cross section, sloping midfoot and chunky radial tips.
def fin(sign,rear=False):
    joint=('rearL'if sign>0 else'rearR')if rear else('finL'if sign>0 else'finR')
    centers=[(sign*.46,-.36 if rear else .22,.40),(sign*.54,-.35 if rear else .33,.23),(sign*.66,-.31 if rear else .43,.105),(sign*.72,-.23 if rear else .53,.055)]
    widths=[.17,.20,.26,.29];heights=[.15,.12,.065,.03]
    if rear:widths=[w*.70 for w in widths];heights=[h*.8 for h in heights]
    vs=[]
    for side in[1,-1]:
        for j,(cx,cy,z)in enumerate(centers):
            for k in range(7):
                u=-1+k/3;ridge=(1-abs(u))*.035
                scallop=(.025 if k%2==0 else-.014)*(j/3)**5
                vs.append((cx+sign*u*widths[j],cy+scallop,z+side*(heights[j]+ridge)))
    L=28;fs=[];colors=[]
    for side in range(2):
        for j in range(3):
            for k in range(6):
                q=side*L+j*7+k
                for face in[(q,q+1,q+8),(q,q+8,q+7)]:
                    fs.append(face);colors.append('ochre'if j==2 else'light'if j==1 else'teal')
    for j in range(3):
        for k in[0,6]:q=j*7+k;fs.append((q,q+7,q+7+L,q+L));colors.append('ochre'if j==2 else'teal')
    for j in[0,3]:
        for k in range(6):q=j*7+k;fs.append((q,q+1,q+1+L,q+L));colors.append('ivory'if j==3 else'teal')
    mesh(f'Broad connected {joint}',vs,fs,'teal',joint,.035,colors)
    # Three broad ivory terminal wedges resolve the fan silhouette at phone distance.
    cx,cy,z=centers[-1]
    for i in range(4):
        x=cx+sign*(i-1.5)*(.10 if rear else .145)
        mesh(f'{joint} cream toe {i}',[(x-.076,cy-.01,.086),(x+.076,cy-.01,.086),(x,cy+.09,.025),(x,cy-.015,.035)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'ivory',joint,.04)
for sign in[-1,1]:fin(sign);fin(sign,True)

# Small polygonal tail fan with a single ochre border.
rows=[]
for y,r in[(-.63,.12),(-.84,.09),(-.94,.06)]:rows.append([((-.63-y)*.9+r*math.cos(k*PI/4),y,.68+r*math.sin(k*PI/4))for k in range(8)])
loft('Tail root',rows,'teal','tail')
vs=[]
for side in[-1,1]:
    for radius in[.015,.28]:
        for k in range(9):
            theta=-1.35+k/8*2.70;vs.append((.29+side*.045,-.90-radius*math.cos(theta),.68+radius*math.sin(theta)))
fs=[];colors=[]
for side in range(2):
    offset=side*18
    for k in range(8):fs.extend([(offset+k,offset+k+1,offset+k+10),(offset+k,offset+k+10,offset+k+9)]);colors.extend(['teal','light'])
for k in range(8):fs.append((9+k,10+k,28+k,27+k));colors.append('ochre')
for k in[0,8]:fs.append((k,k+9,k+27,k+18));colors.append('ochre')
mesh('Modest angular tail fan',vs,fs,'teal','tail',.035,colors)

# Eight purposeful cream spines, large form hierarchy only.
def spine(name,base,tip,r):
    base=Vector(base);tip=Vector(tip);d=(tip-base).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u).normalized()
    vs=[tuple(base+u*math.cos(k*2*PI/4)*r+v*math.sin(k*2*PI/4)*r*.70)for k in range(4)]+[tuple(tip)]
    mesh(name,vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'ivory',variation=.055)
# Crown spines deferred until closed hull / cavity anatomy passes.

# Eight-joint contract remains available for future arena integration; no runtime replacement here.
REST={'body':(None,(0,0,.70)),'belly':('body',(0,0,.70)),'head':('body',(0,.50,.93)),'tail':('body',(0,-.70,.68)),'finL':('body',(.43,.16,.50)),'finR':('body',(-.43,.16,.50)),'rearL':('body',(.43,-.36,.50)),'rearR':('body',(-.43,-.36,.50))}
d=bpy.data.armatures.new('Puffer low-poly rig');arm=bpy.data.objects.new('Puffer low-poly rig',d);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(parent,xyz)in REST.items():
    b=d.edit_bones.new(name);b.head=xyz;b.tail=Vector(xyz)+Vector((0,0,.12))
    if parent:b.parent=d.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
triangles=0
for ob,joint in parts:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);mod=ob.modifiers.new('Skin','ARMATURE');mod.object=arm;ob.parent=arm
bpy.ops.object.select_all(action='DESELECT')
for ob,joint in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Puffer style revision skin'
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'puffer-style-v14.glb'),export_format='GLB',use_selection=True,export_animations=False)
(out/'metrics.json').write_text(json.dumps({'status':'approved low-poly target; implementation unaccepted','triangles':triangles,'joints':8,'materials':1,'glbBytes':(out/'puffer-style-v14.glb').stat().st_size},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'inspection.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Studio');floor.diffuse_color=(.028,.045,.06,1)
    ob=mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],'dark');ob.data.materials.clear();ob.data.materials.append(floor)
    def light(name,xyz,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,4,5),650,4,(1,.90,.76));light('Cool fill',(4,1,3),360,4,(.73,.87,1));light('Rim',(0,-4,4),500,3,(.66,.87,1))
    d=bpy.data.cameras.new('Matched style camera');cam=bpy.data.objects.new('Matched style camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=3.2;cam.location=(4.0,4.0,2.0);cam.rotation_euler=(Vector((0,-.03,.84))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-style.png');bpy.ops.render.render(write_still=True)
