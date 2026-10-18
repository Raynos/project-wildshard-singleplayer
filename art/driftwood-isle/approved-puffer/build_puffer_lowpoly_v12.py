"""Puffer approved low-poly target study. Mesh implementation remains unaccepted.
Blender 4.3: -b -t 2 --python-exit-code 1 -P <source> -- --out tmp/puffer-lowpoly-v12 --render
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
rows=[]
for y,w,z,h in SECTIONS[:-2]:rows.append([(w*math.sin(2*PI*i/14),y,z+h*math.cos(2*PI*i/14))for i in range(14)])
body=loft('Sloping faceted cranial body',rows,'teal')

# Only fourteen broad, thick-edged mantle plates. No chips, grooves or scale carpet.
def plate(name,y,angle,length,half_angle,color):
    outline=[(-.45,-.68),(-.48,.35),(-.12,.58),(.46,.30),(.48,-.45),(.02,-.62)]
    vs=[]
    for xx,yy in outline:vs.append(tuple(surface(y+yy*length,angle+xx*half_angle,.022)))
    vs.append(tuple(surface(y+.03*length,angle,.073)))
    for xx,yy in outline:vs.append(tuple(surface(y+yy*length,angle+xx*half_angle,.002)))
    fs=[(i,(i+1)%6,6)for i in range(6)]+[(i,7+i,7+(i+1)%6,(i+1)%6)for i in range(6)]+[tuple(7+i for i in reversed(range(6)))]
    return mesh(name,vs,fs,color,variation=.025)
# Mantle is the broad faceted hull itself; no offset scale carpet.

# V9 silhouette correction: dominant low forward pouch and short broad weight-bearing feet.
# V12 replaces every detached facial overlay with one connected surface.
# Rows are anatomical cross-sections, not equal-latitude rings: crown, brow,
# orbital opening, cheek, mouth corners, pouch shoulders and tapered chin.
FROWS=[(1.29,.30,.24),(1.16,.47,.49),(1.075,.55,.64),(1.025,.585,.73),(.935,.60,.80),(.825,.595,.87),(.68,.58,.99),(.46,.52,1.035),(.25,.38,.92),(.12,.16,.72)]
C=[-1,-.83,-.63,-.40,-.255,0,.255,.40,.63,.83,1]
vs=[]
for j,(z,w,y)in enumerate(FROWS):
    for k,u in enumerate(C):
        x=w*u
        zz=z+(abs(u)*.10 if j in[2,3,4] else 0)
        # Broad forward cheeks, flat central pouch planes and swept-back sides.
        yy=y-.36*abs(u)**2
        if j>=6:yy+=.025*((k+j)%2-.5)
        vs.append((x,yy,zz))
fs=[];cols=[];N=len(C)
for j in range(len(FROWS)-1):
    for k in range(N-1):
        eye=(j==3 and (1<=k<=3 or 6<=k<=8))
        mouth=(j in[3,4] and k in[4,5])
        if eye or mouth:continue
        q=j*N+k
        fs.extend([(q,q+1,q+N+1),(q,q+N+1,q+N)] if (j+k)%2 else [(q,q+1,q+N),(q+1,q+N+1,q+N)])
        color='teal' if j<2 else 'ochre' if j==2 and (1<=k<=3 or 6<=k<=8) else 'ivory'
        if j in[3,4]and k in[0,9]:color='ochre'
        if j==3 and k in[4,5]:color='cream'
        cols.extend([color,color])
# Mouth and eyes have shared edge vertices, short recessed walls, then dark interior.
def aperture_wall(indices,name,depth,color):
    base=len(vs)
    for i in indices:
        x,y,z=vs[i];vs.append((x,y-depth,z))
    for i,idx in enumerate(indices):
        ni=(i+1)%len(indices);fs.append((idx,indices[ni],base+ni,base+i));cols.append(color)
    fs.append(tuple(base+i for i in reversed(range(len(indices)))));cols.append('mouth'if name=='mouth'else'black')
# Rectangular topology is warped into slanted anatomical apertures by row positions.
for left,right in[(1,4),(6,9)]:
    aperture_wall([3*N+k for k in range(left,right+1)]+[4*N+k for k in reversed(range(left,right+1))],'eye',.08,'ochre')
aperture_wall([3*N+4,3*N+5,3*N+6,4*N+6,5*N+6,5*N+5,5*N+4,4*N+4],'mouth',.16,'cream')
face=mesh('Continuous crown orbit cheek pouch shell',vs,fs,'ivory','head',.025,cols)
# Large amber eye surfaces sit behind the shell's slanted brow. No external rings.
def lens(name,c,rx,rz,color):
    x,y,z=c;n=14
    v=[(x+rx*math.cos(k*2*PI/n),y-.03*(math.cos(k*2*PI/n)**2),z+rz*math.sin(k*2*PI/n))for k in range(n)]+[(x,y+.007,z)]
    return mesh(name,v,[(k,(k+1)%n,n)for k in range(n)],color,'head',0)
for sign in[-1,1]:
    lens(f'Recessed amber globe {sign}',(sign*.34,.680,1.018),.124,.086,'gold')
    lens(f'Deep black pupil {sign}',(sign*.33,.691,1.015),.043,.058,'black')
    lens(f'Eye light {sign}',(sign*.315,.701,1.045),.011,.014,'ivory')
# Small continuous upper beak tip bridges the center of the forehead shell.
mesh('Broad hooked upper beak',[(-.15,.755,1.047),(0,.79,1.09),(.15,.755,1.047),(0,.90,.975)],[(0,1,3),(1,2,3)],'cream','head',.02)
for sign in[-1,1]:
    mesh(f'Nostril {sign}',[(sign*.054,.822,1.034),(sign*.072,.81,1.037),(sign*.061,.83,1.02)],[(0,1,2)],'socket','head',0)
mesh('Tongue behind mouth',[(-.10,.77,.855),(.10,.77,.855),(.07,.71,.87),(-.07,.71,.87)],[(0,1,2,3)],'tongue','head',0)

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
for i,(y,angle,length,r)in enumerate([(-.43,0,.24,.12),(-.12,0,.28,.13),(.21,0,.22,.10),(-.27,-.95,.22,.10),(-.27,.95,.22,.10),(.15,-1.15,.16,.08),(.15,1.15,.16,.08),(-.53,1.55,.13,.075)]):
    base=surface(y,angle,.015);spine(f'Cream crown spine {i}',base,base+Vector((math.sin(angle)*length*.55,-length*.24,length*.88)),r)

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
bpy.ops.export_scene.gltf(filepath=str(out/'puffer-style-v12.glb'),export_format='GLB',use_selection=True,export_animations=False)
(out/'metrics.json').write_text(json.dumps({'status':'approved low-poly target; implementation unaccepted','triangles':triangles,'joints':8,'materials':1,'glbBytes':(out/'puffer-style-v12.glb').stat().st_size},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'inspection.blend'))
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
    floor=bpy.data.materials.new('Studio');floor.diffuse_color=(.028,.045,.06,1)
    ob=mesh('Ground',[(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[(0,1,2,3)],'dark');ob.data.materials.clear();ob.data.materials.append(floor)
    def light(name,xyz,power,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(-3,4,5),650,4,(1,.90,.76));light('Cool fill',(4,1,3),360,4,(.73,.87,1));light('Rim',(0,-4,4),500,3,(.66,.87,1))
    d=bpy.data.cameras.new('Matched style camera');cam=bpy.data.objects.new('Matched style camera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=3.2;cam.location=(4.0,4.0,2.0);cam.rotation_euler=(Vector((0,-.03,.84))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'matched-style.png');bpy.ops.render.render(write_still=True)
