"""Tide-Root Colossus complete grown anatomy: continuous, overlapping root anatomy study.

Front -Y. All anatomy is closed 3D geometry, with deliberate tapered bends and
broad irregular planes. Approved concept guides visible identity; back is an
interpretation. V1/V2 are preserved. Static study, not runtime/animation approval.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='tmp/colossus-complete-grown-anatomy')
parser.add_argument('--render', action='store_true')
parser.add_argument('--views', default='three-quarter')
a = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(a.out).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


palette = {
    'wood': '795638', 'lightwood': 'A98252', 'cut': 'C39A64',
    'darkwood': '4A392B', 'rootshade': '5C4833',
    'stone': '626C73', 'stoneLight': '89918C', 'stoneDark': '48545A',
    'leaf': '698D29', 'leafLight': '87A735', 'leafDark': '3E6227',
    'heart': '13C9C6', 'heartLight': '53E8DC', 'eye': '30EEE0',
    'socket': '172B28',
}
mats = {}
for name, color in palette.items():
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    rgb = tuple(linear(int(color[i:i + 2], 16) / 255) for i in (0, 2, 4))
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .88
    if name in ('heart', 'heartLight', 'eye'):
        shader.inputs['Emission Color'].default_value = (*rgb, 1)
        shader.inputs['Emission Strength'].default_value = .18
    mats[name] = material
parts = []


def mesh(name, vertices, faces, colors):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for color in dict.fromkeys(colors):
        data.materials.append(mats[color])
    slots = {m.name: i for i, m in enumerate(data.materials)}
    for i, face in enumerate(data.polygons):
        face.material_index = slots[colors[i % len(colors)]]
        face.use_smooth = False
    parts.append(ob)
    return ob


def root(name, sections, colors=('wood', 'lightwood', 'cut', 'wood', 'darkwood', 'rootshade'), twist=0):
    """Swept six-sided root: sections are x,y,z,width,depth, optional roll.

    Unlike V2, sections are perpendicular to the local path, not horizontal.
    The asymmetric cross section and controlled roll form bark ridges that carry
    around each bend; there is no random vertex noise or repeated segment caps.
    """
    # Individually authored section paths keep existing component ownership.
    side=-1 if name.endswith('-1') else 1
    overrides={
      'Forearm main to outer claw':[(side*1.81,-.17,2.78,.27,.27),(side*2.00,-.36,2.42,.36,.34),(side*2.14,-.43,2.02,.39,.32),(side*2.17,-.42,1.62,.31,.27),(side*2.25,-.47,1.28,.23,.22),(side*2.09,-.67,1.02,.18,.16),(side*1.89,-.76,.96,.075,.09)],
      'Forearm inner braid':[(side*1.86,.08,2.64,.21,.23),(side*1.88,.14,2.25,.26,.27),(side*2.05,.06,1.88,.30,.28),(side*2.04,-.23,1.55,.28,.24),(side*1.96,-.43,1.25,.22,.19)],
      'Middle root digit':[(side*2.10,-.38,1.54,.25,.23),(side*2.10,-.60,1.28,.23,.21),(side*1.94,-.83,1.08,.17,.16),(side*1.71,-.88,1.06,.08,.09)],
      'Inner root digit':[(side*1.94,-.19,1.57,.20,.21),(side*1.82,-.31,1.33,.18,.18),(side*1.70,-.53,1.19,.14,.14),(side*1.64,-.65,1.27,.06,.07)],
      'Opposed root thumb':[(side*1.98,-.19,1.73,.25,.23),(side*1.68,-.18,1.65,.21,.20),(side*1.52,-.35,1.47,.17,.16),(side*1.56,-.54,1.36,.07,.08)],
      'Left scapular arch':[(-1.40,.00,3.77,.25,.28),(-1.00,.45,3.89,.30,.28),(-.61,.62,3.59,.25,.23),(-.38,.43,3.15,.17,.18),(-.06,.28,2.73,.08,.11)],
      'Right scapular arch':[(1.44,.00,3.73,.23,.26),(1.04,.43,3.85,.29,.28),(.68,.60,3.56,.26,.24),(.49,.43,3.16,.18,.20),(.14,.30,2.82,.07,.11)],
      'Rear diagonal trunk':[(-.41,.22,2.20,.20,.23),(-.26,.45,2.72,.28,.24),(.03,.50,3.18,.30,.25),(.37,.36,3.69,.28,.26),(.09,.02,4.19,.27,.24)],
    }
    for key,path in overrides.items():
        if name==key or name.startswith(key+' '):sections=path;break
    if any(t in name.lower() for t in ('calf','ankle','lower leg','toe clasp')):
        # Roots widen continuously into stone, without moving planted toe tips.
        sections=[(x,y,z,w*(1.23 if .20<z<1.2 else 1.08),d*(1.20 if .20<z<1.2 else 1.05),*tail) for x,y,z,w,d,*tail in sections]
    if 'heart clasp' in name or 'heart claw' in name:
        sections=[(x,y+.045,z,w*.90,d*.92,*tail) for x,y,z,w,d,*tail in sections]
    if name=='Central brow nasal keel':
        sections=[(0,-.40,4.60,.25,.13),(0,-.61,4.36,.13,.09),(.005,-.65,4.10,.09,.07),(0,-.60,3.90,.035,.035)]
    if 'Layered pale cheek jaw' in name:
        sections=[(side*.32,-.35,4.44,.16,.14),(side*.28,-.54,4.19,.17,.11),(side*.17,-.63,3.97,.13,.09),(side*.075,-.59,3.75,.04,.045)]
        colors=('cut','lightwood','cut','lightwood','wood','lightwood')
    vertices = []
    points = [Vector(s[:3]) for s in sections]
    shape = [(1, .12), (.46, .95), (-.60, .83), (-1, -.12), (-.36, -1), (.55, -.72)]
    for i, section in enumerate(sections):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        guide = Vector((0, 1, 0))
        if abs(tangent.dot(guide)) > .94:
            guide = Vector((1, 0, 0))
        right = guide.cross(tangent).normalized()
        depth = tangent.cross(right).normalized()
        roll = twist + (section[5] if len(section) > 5 else 0)
        u = right * math.cos(roll) + depth * math.sin(roll)
        v = depth * math.cos(roll) - right * math.sin(roll)
        for x, y in shape:
            vertices.append(tuple(points[i] + u * x * section[3] + v * y * section[4]))
    faces = [tuple(reversed(range(6)))]
    face_colors = ['darkwood' if colors[0] in ('wood', 'darkwood', 'lightwood') else colors[0]]
    for k in range(len(sections) - 1):
        for j in range(6):
            face = (k * 6 + j, k * 6 + (j + 1) % 6, (k + 1) * 6 + (j + 1) % 6, (k + 1) * 6 + j)
            # A long bent broad side gets one deliberate diagonal planar break.
            # Flat neighboring strips stay coherent rather than checkerboarded.
            if (k + j) % 4 == 1 and len(sections) > 3:
                faces.extend([(face[0], face[1], face[2]), (face[0], face[2], face[3])])
                face_colors.extend([colors[j % len(colors)], colors[(j + (1 if k == 1 else 0)) % len(colors)]])
            else:
                faces.append(face)
                face_colors.append(colors[j % len(colors)])
    faces.append(tuple((len(sections) - 1) * 6 + j for j in range(6)))
    face_colors.append(colors[1 % len(colors)])
    return mesh(name, vertices, faces, face_colors)


def stone(name, center, scale, turn=0):
    """An embedded uneven rock wedge with a broad split face, never a sphere."""
    base = [(-.8,-.6,-.7),(.7,-.7,-.7),(1,.3,-.45),(.3,.85,-.65),(-.85,.45,-.6),
            (-.52,-.65,.45),(.35,-.7,.8),(.77,.13,.5),(.12,.6,1),(-.65,.42,.55),(.0,-.13,1.15)]
    c, s = math.cos(turn), math.sin(turn)
    vs = [(center[0]+(x*c-y*s)*scale[0],center[1]+(x*s+y*c)*scale[1],center[2]+z*scale[2]) for x,y,z in base]
    fs = [(4,3,2,1,0),(0,1,6,5),(1,2,7,6),(2,3,8,7),(3,4,9,8),(4,0,5,9),
          (5,6,10),(6,7,10),(7,8,10),(8,9,10),(9,5,10)]
    return mesh(name,vs,fs,['stoneDark','stone','stoneLight','stone','stoneDark','stone','stoneLight','stone','stoneLight','stone','stone'])


def leaf(name, start, tip, width, color='leaf', roll=0):
    start, tip = Vector(start), Vector(tip)
    axis = tip - start
    side = axis.cross(Vector((0,0,1)))
    if side.length < .001:
        side = Vector((1,0,0))
    side.normalize()
    normal = side.cross(axis.normalized())
    side = (side * math.cos(roll) + normal * math.sin(roll)) * width
    mid = start + axis * .48
    ridge = mid + normal * width * .40
    underside = mid - normal * width * .16
    vs = [start, mid+side, tip, mid-side, ridge, underside]
    return mesh(name,[tuple(v) for v in vs],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],
                [color,'leafLight',color,'leafDark','leafDark',color,'leafDark',color])


def growth(name, center, extent, yaw=0, pitch=0, tone='leaf'):
    """Closed irregular growth island with a broken oblique ridge.
    Unequal 7-point skirt, three ridge stations, depth-bearing underside.
    Yaw and pitch seat the mass along its supporting root, not a flat roof.
    """
    shape=[(-.98,-.33,-.15),(-.45,-.86,-.23),(.31,-.79,-.16),
           (.95,-.21,-.30),(.68,.60,-.10),(-.13,.82,-.21),(-.82,.45,-.12),
           (-.51,-.12,.48),(.07,-.14,.61),(.48,.15,.30),(-.10,.05,-.46)]
    verts=[]
    cy,sy=math.cos(yaw),math.sin(yaw);cp,sp=math.cos(pitch),math.sin(pitch)
    for x,y,z in shape:
        x*=extent[0];y*=extent[1];z*=extent[2]
        y,z=y*cp-z*sp,y*sp+z*cp
        verts.append((center[0]+x*cy-y*sy,center[1]+x*sy+y*cy,center[2]+z))
    faces=[(0,1,7),(1,2,8,7),(2,3,9,8),(3,4,9),(4,5,8,9),(5,6,7,8),(6,0,7),
           (1,0,10),(2,1,10),(3,2,10),(4,3,10),(5,4,10),(6,5,10),(0,6,10)]
    # Broad same-tone planes alternate with narrow creases, no bright badge rim.
    mesh(name,verts,faces,[tone,tone,'leafLight',tone,'leafDark',tone,'leafLight',tone,
                         'leafDark','leafDark',tone,'leafDark','leafDark',tone,'leafDark'])


# Root anatomy: two opposing load paths cradle an open heart, then continue
# through the hips and back. Neither makes a regular circular frame.
root('Crooked pelvic trunk',[(.06,.11,1.60,.13,.20),(-.16,.20,1.97,.32,.31),(.11,.15,2.28,.34,.30),(-.14,.31,2.62,.27,.25)],twist=.2)
root('Left chest load root',[(-.10,-.14,2.27,.13,.15),(-.57,-.09,2.61,.28,.30),(-.88,.04,3.17,.32,.36),(-.78,-.07,3.68,.36,.36),(-1.23,.04,4.02,.36,.34)],twist=-.24)
root('Right chest load root',[(.23,.09,2.20,.15,.18),(.58,.02,2.70,.26,.30),(.80,.00,3.05,.28,.34),(.66,-.14,3.57,.31,.32),(1.10,-.04,3.94,.40,.37)],twist=.28)
root('Left clavicle cascade',[(-1.33,.03,3.99,.28,.31),(-.89,-.37,3.94,.33,.26),(-.52,-.49,3.58,.27,.20),(-.33,-.50,3.34,.07,.08)],twist=-.20)
root('Right clavicle cascade',[(1.33,.12,3.94,.25,.29),(.88,-.34,3.98,.32,.25),(.57,-.48,3.67,.21,.18),(.42,-.54,3.49,.05,.06)],twist=.15)
root('Left lower cradle',[(-.83,-.02,3.14,.22,.24),(-.77,-.36,2.96,.25,.21),(-.48,-.56,2.78,.19,.15),(-.23,-.45,2.51,.13,.12),(-.15,-.31,2.31,.045,.06)],twist=.4)
root('Right diagonal cradle',[(.71,.06,3.24,.22,.26),(.78,-.38,2.96,.23,.21),(.42,-.60,2.67,.18,.13),(-.02,-.40,2.61,.06,.08)],twist=-.3)
root('Left upper inward rib',[(-.88,-.15,3.48,.20,.23),(-.62,-.46,3.58,.24,.19),(-.37,-.64,3.44,.13,.10),(-.22,-.60,3.32,.035,.055)],twist=.15)
root('Right upper inward rib',[(.76,-.04,3.62,.17,.20),(.70,-.42,3.41,.21,.18),(.42,-.61,3.26,.11,.10),(.29,-.57,3.16,.04,.06)],twist=-.2)
root('Waist front spur',[(-.31,-.13,2.62,.15,.17),(-.16,-.40,2.33,.25,.16),(.05,-.40,2.07,.15,.11),(-.05,-.35,1.83,.025,.05)],twist=.3)
# Deep back: slanted roots traverse one another instead of a solid V panel.
root('Rear diagonal trunk',[(-.41,.22,2.20,.20,.23),(-.19,.51,2.72,.33,.26),(.19,.51,3.19,.37,.27),(.46,.36,3.69,.33,.28),(.09,.02,4.19,.27,.24)],twist=.37)
root('Left scapular arch',[(-1.40,.00,3.77,.25,.28),(-1.00,.47,3.83,.33,.29),(-.55,.63,3.51,.30,.26),(-.33,.48,3.05,.21,.20),(-.01,.32,2.69,.08,.11)],twist=-.35)
root('Right scapular arch',[(1.44,.00,3.73,.23,.26),(1.02,.45,3.80,.33,.29),(.64,.66,3.57,.30,.28),(.45,.48,3.11,.20,.20),(.12,.31,2.81,.07,.11)],twist=.4)
root('Crossback lower root',[(-.76,.17,2.61,.16,.17),(-.53,.55,2.91,.26,.21),(-.05,.69,3.27,.25,.20),(.49,.56,3.51,.17,.17),(.84,.35,3.86,.09,.10)],twist=.25)

for side in (-1,1):
    s=side
    asym=.07 if s>0 else -.04
    # These secondary roots wrap and split the large load-bearing masses.
    root(f'Outer shoulder root {s}',[(s*.79,.09,3.90,.28,.31),(s*1.26,-.02,4.04+asym,.44,.43),(s*1.61,-.10,3.69,.37,.34),(s*1.81,.02,3.25,.28,.28)],twist=s*.3)
    root(f'Arm descending trunk {s}',[(s*1.44,.12,3.83,.29,.33),(s*1.69,.07,3.45,.38,.33),(s*1.82,-.11,3.03,.30,.30),(s*1.73,-.24,2.73,.25,.28),(s*1.98,-.25,2.30,.33,.29)],twist=s*.25)
    root(f'Upper arm crossing bark {s}',[(s*1.28,-.36,3.88,.18,.16),(s*1.51,-.40,3.53,.28,.17),(s*1.72,-.30,3.21,.20,.15),(s*1.88,-.14,2.99,.05,.07)],twist=s*.4)
    root(f'Elbow outer hook {s}',[(s*1.74,.07,3.03,.21,.21),(s*2.00,.04,2.73,.28,.24),(s*2.15,-.13,2.48,.17,.19),(s*2.16,-.23,2.18,.04,.08)],twist=s*.3)
    # Two muscular forearm roots continue into palm and outer finger.
    root(f'Forearm main to outer claw {s}',[(s*1.81,-.17,2.78,.27,.27),(s*2.02,-.38,2.41,.42,.32),(s*2.17,-.45,1.98,.33,.29),(s*2.23,-.39,1.53,.25,.23),(s*2.39,-.37,1.16,.17,.17),(s*2.35,-.66,.84,.12,.12),(s*2.19,-.76,.71,.045,.06)],twist=-s*.22)
    root(f'Forearm inner braid {s}',[(s*1.86,.08,2.64,.21,.23),(s*1.87,.06,2.23,.28,.24),(s*2.00,-.04,1.86,.25,.25),(s*1.96,-.29,1.49,.26,.20),(s*2.08,-.42,1.24,.20,.18)],twist=s*.38)
    root(f'Front forearm blade {s}',[(s*1.89,-.46,2.58,.10,.10),(s*1.98,-.64,2.20,.21,.14),(s*2.03,-.65,1.82,.16,.13),(s*1.91,-.55,1.61,.035,.05)],twist=-s*.15)
    # Deliberately varied curling digit lengths, with actual negative spaces.
    root(f'Middle root digit {s}',[(s*2.10,-.38,1.54,.19,.17),(s*2.10,-.57,1.23,.16,.14),(s*2.02,-.80,.91,.12,.11),(s*1.83,-.92,.76,.055,.06)],twist=s*.24)
    root(f'Inner root digit {s}',[(s*1.91,-.24,1.53,.14,.15),(s*1.80,-.35,1.23,.13,.12),(s*1.70,-.57,1.02,.095,.09),(s*1.65,-.70,1.10,.035,.045)],twist=-s*.23)
    root(f'Opposed root thumb {s}',[(s*1.98,-.19,1.73,.19,.18),(s*1.62,-.16,1.55,.16,.15),(s*1.46,-.28,1.31,.12,.12),(s*1.49,-.48,1.23,.045,.055)],twist=s*.35)
    # Bowed thigh, exposed rock, and spiralling calf straps. Roots carry into
    # isolated stones at different heights, avoiding V2's shoe-like rim.
    root(f'Thigh load root {s}',[(s*.31,.11,2.19,.25,.28),(s*.65,.02,1.98,.35,.30),(s*.93,.07,1.66+asym,.33,.28),(s*.94,-.10,1.30,.21,.22)],twist=-s*.37)
    root(f'Thigh oblique bark {s}',[(s*.27,-.19,2.14,.16,.16),(s*.59,-.34,1.85,.23,.18),(s*.88,-.26,1.58,.20,.15),(s*1.04,-.09,1.43,.04,.06)],twist=s*.15)
    stone(f'Embedded knee rock {s}',(s*.91,.09,1.18+asym),(.29,.29,.34),s*.3)
    root(f'Calf rear load {s}',[(s*.89,.17,1.48,.23,.24),(s*1.08,.29,1.05,.28,.27),(s*1.02,.12,.58,.29,.28),(s*.83,-.10,.19,.20,.22)],twist=s*.5)
    root(f'Calf crossing root {s}',[(s*.78,-.13,1.43,.17,.18),(s*.84,-.34,1.06,.22,.20),(s*1.13,-.29,.66,.25,.21),(s*1.30,-.19,.34,.18,.19),(s*1.42,-.35,.12,.05,.07)],twist=-s*.45)
    root(f'Front ankle anchoring root {s}',[(s*1.12,.03,.95,.16,.18),(s*.98,-.40,.55,.22,.18),(s*.84,-.55,.30,.20,.17),(s*.62,-.78,.09,.055,.07)],twist=s*.2)
    stone(f'Outer embedded foot stone {s}',(s*1.36,-.32,.23),(.29,.39,.29),s*.4)
    stone(f'Inner grounded stone {s}',(s*.68,-.52,.18),(.25,.34,.23),-s*.3)
    stone(f'Rear heel stone {s}',(s*1.08,.34,.19),(.26,.28,.24),s*.7)
    root(f'Hip fork {s}',[(s*.18,.03,2.16,.17,.18),(s*.47,.10,2.38,.20,.19),(s*.75,.03,2.45,.09,.09),(s*.85,-.13,2.30,.025,.04)],twist=s*.25)
    root(f'Arm winding bark ridge {s}',[(s*1.38,.24,3.77,.13,.14),(s*1.76,.31,3.44,.21,.17),(s*1.99,.08,3.08,.16,.15),(s*1.86,-.35,2.83,.13,.12),(s*1.71,-.41,2.61,.025,.045)],twist=s*.5)
    root(f'Forearm diagonal living root {s}',[(s*1.83,.16,2.54,.12,.13),(s*2.11,.10,2.22,.20,.17),(s*2.32,-.16,1.96,.21,.15),(s*2.27,-.48,1.66,.14,.11),(s*2.09,-.62,1.44,.03,.05)],twist=-s*.55)
    root(f'Lower leg lateral root {s}',[(s*.78,.13,1.64,.12,.13),(s*1.03,.30,1.28,.18,.16),(s*1.30,.14,.92,.17,.15),(s*1.33,-.18,.58,.15,.13),(s*1.51,-.42,.30,.09,.10),(s*1.58,-.60,.10,.025,.04)],twist=s*.4)
    root(f'Inner toe clasp {s}',[(s*.99,.10,.67,.15,.16),(s*.69,-.08,.46,.17,.15),(s*.52,-.38,.23,.13,.12),(s*.48,-.65,.07,.035,.05)],twist=-s*.4)
    # The core is clasped at distinct depths, with broken tips facing inward.
    root(f'Upper heart clasp {s}',[(s*.78,-.23,3.47,.14,.16),(s*.63,-.57,3.42,.17,.13),(s*.41,-.72,3.32,.12,.10),(s*.25,-.74,3.34,.025,.035)],twist=s*.4)
    root(f'Lower heart claw {s}',[(s*.72,-.19,2.97,.15,.15),(s*.53,-.61,2.85,.18,.14),(s*.29,-.70,2.73,.13,.10),(s*.20,-.68,2.94,.035,.045)],twist=-s*.5)
    # Mantle patches wrap across front and rear; no continuous shoulder bead row.

# Rear canopy is staggered between the root layers rather than confined to top.

# Heart: offset perimeter and staggered internal ridges, closed back fan.
vs=[(-.06,-.43,3.74),(-.28,-.49,3.48),(-.38,-.45,3.19),(-.28,-.41,2.87),
    (-.10,-.42,2.65),(.16,-.42,2.73),(.37,-.40,3.07),(.26,-.45,3.43),
    (-.08,-.79,3.45),(-.21,-.83,3.15),(.07,-.87,3.10),(.02,-.72,2.84),(.15,-.74,3.37),(0,-.12,3.20)]
fs=[(0,1,8),(1,2,9,8),(2,3,9),(3,4,11,9),(4,5,11),(5,6,10,11),
    (6,7,12,10),(7,0,8,12),(8,9,10),(8,10,12),(9,11,10)]
fs += [(i,13,(i+1)%8) for i in range(8)]
vs=[(x,y+.065 if y<-.4 else y,z) for x,y,z in vs]
mesh('Exposed turquoise heart',vs,fs,['heartLight','heart','heart','heartLight','heart','heart',
    'heartLight','heart','heart','heartLight','heart','heart'])

# Integrated long bark mask: flat tapering front, no separate beak or owl disk.
root('Neck rear root',[(-.05,.10,3.73,.24,.24),(.03,.04,4.15,.34,.27),(-.04,-.08,4.48,.31,.26)],twist=.1)
# Coordinates integrate brow -> cheek -> lower chin; center ridge is modest.
# Central brow descends only to a short nasal split. Long pale identity comes
# from offset cheek blades, separated by real recessed dark wood channels.
root('Central brow nasal keel',[(0,-.40,4.60,.25,.13),(0,-.61,4.36,.13,.09),(.005,-.65,4.11,.075,.07),(0,-.60,3.98,.022,.035)],colors=('lightwood','cut','lightwood','wood','rootshade','wood'),twist=.1)
for s in (-1,1):
    root(f'Layered pale cheek jaw {s}',[(s*.32,-.35,4.44,.16,.14),(s*.30,-.52,4.19,.14,.11),(s*.19,-.62,3.97,.11,.09),(s*.105,-.58,3.72,.032,.045)],colors=('cut','lightwood','cut','wood','darkwood','wood'),twist=s*.27)
    root(f'Outer broken jaw plane {s}',[(s*.42,-.21,4.32,.13,.15),(s*.37,-.36,4.04,.14,.13),(s*.27,-.43,3.86,.055,.065)],colors=('wood','lightwood','cut','rootshade','darkwood','wood'),twist=-s*.4)
root('Recessed split jaw backing',[(0,-.29,4.30,.23,.12),(0,-.37,4.02,.18,.10),(0,-.39,3.80,.075,.05)],colors=('darkwood','rootshade','darkwood'),twist=.1)
def face_inlay(name, vertices, color):
    back=[(x,y+.035,z) for x,y,z in vertices]
    return mesh(name,vertices+back,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],[color])

for s in (-1,1):
    face_inlay(f'Recessed eye socket {s}',[(s*.052,-.708,4.31),(s*.310,-.575,4.44),(s*.282,-.610,4.28),(s*.105,-.706,4.21)],'socket')
    face_inlay(f'Narrow cyan eye {s}',[(s*.102,-.712,4.305),(s*.273,-.610,4.395),(s*.251,-.632,4.335),(s*.123,-.711,4.264)],'eye')
    # A crown root forks into a long side cheek, leaving the narrow centre mask
    # visible and enclosing the eye rather than framing a separate owl disk.
    root(f'Crown cheek flow {s}',[(s*.16,-.43,3.70,.025,.05),(s*.29,-.44,3.98,.10,.10),(s*.38,-.30,4.37,.17,.15),(s*.41,-.13,4.65,.22,.19),(s*.63,-.05,4.88,.20,.17)],twist=s*.25)
    root(f'Brow descending ridge {s}',[(s*.48,-.19,4.61,.12,.12),(s*.31,-.48,4.52,.12,.09),(s*.16,-.62,4.36,.075,.065),(s*.065,-.71,4.24,.025,.035)],twist=s*.25)
# Asymmetric branches occupy depth as well as width. Their large forks derive
# from the original crown, not a perfectly planar deer-antler silhouette.
root('Crown left main',[(-.32,-.09,4.45,.22,.20),(-.60,.00,4.87,.23,.19),(-.75,.12,5.19,.17,.15),(-.73,.19,5.52,.13,.11),(-.86,.14,5.85,.055,.065)],twist=-.2)
root('Crown left outer',[(-.63,.01,4.84,.16,.16),(-1.02,-.13,4.98,.17,.14),(-1.30,-.25,5.22,.11,.10),(-1.40,-.28,5.45,.045,.055)],twist=.3)
root('Crown left terminal fork',[(-.85,.18,5.35,.105,.10),(-1.10,.29,5.48,.09,.08),(-1.18,.36,5.66,.035,.04)],twist=-.1)
root('Crown right main',[(.34,-.06,4.47,.23,.19),(.63,.02,4.81,.21,.18),(.78,.03,5.16,.16,.14),(.60,-.12,5.43,.13,.11),(.62,-.23,5.72,.045,.055)],twist=.25)
root('Crown right outer',[(.65,.00,4.83,.16,.14),(1.00,.14,4.95,.17,.14),(1.23,.28,5.16,.10,.10),(1.34,.33,5.39,.045,.055)],twist=-.3)
root('Crown right short tine',[(.77,.02,5.13,.10,.10),(.98,-.06,5.31,.08,.07),(1.09,-.15,5.53,.03,.04)],twist=.2)

# Complete-pass anatomy: actual depth, asymmetric interlocking stone and root.
# Dark stone is a secondary load path within the roots, not a new armor shell.
for s in (-1,1):
    stone(f'Upper arm embedded slate {s}',(s*1.54,.27,3.44),(.24,.28,.43),s*.45)
    stone(f'Forearm split slate {s}',(s*2.06,.10,2.06),(.24,.22,.38),-s*.52)
    stone(f'Outer thigh embedded slate {s}',(s*.86,.18,1.65),(.28,.25,.36),s*.28)
    stone(f'Shin rising slate {s}',(s*1.09,.06,.85),(.29,.25,.43),-s*.45)
    stone(f'Separate forward toe {s}',(s*1.00,-.66,.16),(.18,.30,.20),s*.16)
    root(f'Splayed living toe {s}',[(s*.95,.13,.64,.18,.18),(s*1.13,-.25,.36,.20,.17),(s*1.19,-.62,.16,.15,.12),(s*1.34,-.89,.055,.035,.035)],twist=s*.33)
    root(f'Flank bowed trunk {s}',[(s*.32,.29,2.25,.16,.19),(s*.66,.59,2.70,.25,.29),(s*.82,.60,3.22,.31,.33),(s*1.01,.35,3.82,.25,.24)],twist=-s*.4)
    root(f'Forearm root split {s}',[(s*1.85,.23,2.66,.13,.17),(s*2.28,.27,2.26,.21,.24),(s*2.40,.00,1.84,.19,.19),(s*2.30,-.27,1.48,.06,.08)],twist=s*.48)
root('Interlocking rear heart cover',[(-.25,.18,2.79,.24,.18),(-.34,.44,3.10,.27,.18),(-.05,.44,3.46,.28,.19),(.23,.24,3.78,.13,.13)],twist=-.3)
root('Lower diagonal abdominal braid',[(.52,-.13,2.83,.16,.17),(.28,-.43,2.54,.21,.16),(-.07,-.47,2.34,.16,.13),(-.29,-.32,2.13,.045,.06)],twist=.55)
# Hand-authored growth islands: center, extents, yaw, pitch.
# No mirrored three-lobe canopy call and no repeated every-joint cuff recipe.
islands=[
 ('Left scapula saddle',(-1.20,-.02,4.38),(.58,.48,.43),-.5,.50),
 ('Left shoulder rear fold',(-1.27,.65,4.10),(.51,.48,.55),.20,.88),
 ('Left shoulder outer fall',(-1.69,-.18,4.10),(.38,.49,.57),-.80,-.82),
 ('Left collar sprout',(-.67,.17,4.35),(.38,.34,.32),.60,.23),
 ('Right high shoulder island',(1.15,.15,4.46),(.57,.49,.44),.55,-.35),
 ('Right shoulder front fold',(1.40,-.43,4.24),(.49,.42,.50),-.3,-.70),
 ('Right rear outer fall',(1.64,.44,4.04),(.37,.49,.57),.80,.85),
 ('Left scapular joining fold',(-.98,.45,4.28),(.34,.42,.34),.8,.65),
 ('Right outer shoulder overlap',(1.70,.05,4.15),(.29,.38,.48),-.6,.80),
 ('Left elbow rear tuft',(-1.89,.34,3.04),(.26,.33,.35),.8,.9),
 ('Right hip side tuft',(.67,-.08,2.22),(.27,.31,.30),.5,.65),
 ('Nape tucked island',(.03,.50,4.32),(.38,.44,.33),.3,.65),
 ('Left upper back climbing growth',(-.72,.87,4.00),(.46,.44,.56),-.7,.85),
 ('Left lower scapular fall',(-.56,1.02,3.57),(.42,.40,.55),.4,1.15),
 ('Right rear ridge growth',(.58,.94,3.97),(.50,.47,.44),-.4,.55),
 ('Right lower back island',(.73,1.01,3.45),(.40,.42,.50),.60,1.02),
 ('Central offset back growth',(-.02,.98,3.23),(.34,.35,.44),.3,1.12),
 ('Left rib trailing growth',(-.68,-.63,3.69),(.34,.32,.36),-.4,-.8),
 ('Right collar crease',(.55,-.30,4.15),(.28,.31,.30),.7,-.4),
 ('Left elbow climbing moss',(-1.95,.06,3.27),(.40,.43,.41),-.6,.85),
 ('Left elbow front drape',(-1.87,-.52,3.07),(.38,.37,.40),.3,-.78),
 ('Right elbow outer island',(2.06,.03,3.03),(.40,.44,.44),.7,.4),
 ('Right arm descending growth',(1.95,-.56,2.72),(.35,.36,.46),.2,-.85),
 ('Left forearm outer remnant',(-2.29,.12,2.06),(.24,.34,.35),-.5,.65),
 ('Right forearm rear sprout',(2.24,.32,1.90),(.22,.34,.31),.7,.9),
 ('Left hip diagonal island',(-.48,-.49,2.26),(.35,.31,.35),-.65,-.9),
 ('Left thigh root following growth',(-1.04,.25,1.82),(.28,.38,.41),-.4,.55),
 ('Right hip upward sprout',(.43,.40,2.46),(.33,.36,.33),.5,.5),
 ('Right thigh front fall',(.82,-.48,2.02),(.31,.33,.48),.6,-.72),
 ('Rear pelvis rooted growth',(.18,.62,2.49),(.36,.33,.30),.45,.8),
 ('Left shin outer fold',(-1.16,-.36,1.08),(.33,.36,.40),-.8,-.8),
 ('Left calf rear moss',(-1.05,.47,.75),(.26,.30,.34),.4,.9),
 ('Right knee green sprout',(1.04,.29,1.42),(.32,.31,.35),.5,.55),
 ('Right calf winding growth',(1.22,-.42,.83),(.30,.33,.40),.7,-.9),
 ('Right inner ankle moss',(.74,-.38,.46),(.25,.29,.25),-.6,-.5),
]
for name,center,extent,yaw,pitch in islands:
    large=any(t in name.lower() for t in ('shoulder','scapul','back','nape','collar'))
    factor=.96 if large else .83
    growth(name,center,(extent[0]*factor,extent[1]*factor,extent[2]*(.88 if large else .73)),yaw,pitch)
    hanging=.66 if ('shoulder' in name.lower() or 'scapul' in name.lower() or 'back' in name.lower()) else .48
    for j,(across,down) in enumerate(((-.48,.70),(.14,.96),(.58,.52))):
        x,y,z=center
        dx=math.cos(yaw)*across*extent[0];dy=math.sin(yaw)*across*extent[0]
        outward=1 if y>.18 else -1
        start=(x+dx,y+dy+outward*.08,z+.05-j*.045)
        tip=(x+dx+math.cos(yaw)*(.12 if j==2 else -.08),y+dy+outward*extent[1]*.64,z-hanging*down)
        leaf(name+f' layered cascade {j}',start,tip,extent[0]*(.56 if j==1 else .46),'leaf',yaw*.3+j*.31)
# Selective unequal hanging shoots, rooted at islands and following wood grain.
shoots=[
 ('Left outer long shoot',(-1.59,-.16,3.96),(-1.86,-.29,3.32),.19,-.3),
 ('Left shoulder front spear',(-1.18,-.34,4.02),(-1.35,-.53,3.65),.24,.4),
 ('Left shoulder back shoot',(-1.46,.48,3.94),(-1.59,.71,3.34),.19,.6),
 ('Left collar small shoot',(-.68,-.06,4.18),(-.77,-.38,3.93),.15,.2),
 ('Right high cascade',(1.46,-.20,4.06),(1.67,-.38,3.46),.21,-.5),
 ('Right front shorter shoot',(1.16,-.36,4.04),(1.09,-.49,3.68),.18,.3),
 ('Right scapula long trailing shoot',(1.21,.61,3.85),(1.39,.79,3.24),.22,.5),
 ('Left upper back spear',(-.87,.82,3.82),(-1.05,1.02,3.18),.20,.7),
 ('Left center back shoot',(-.43,.96,3.52),(-.56,1.07,2.92),.19,.3),
 ('Right back oblique shoot',(.61,.95,3.42),(.34,1.07,2.95),.24,-.4),
 ('Spinal lower shoot',(-.01,.91,3.23),(.12,.98,2.80),.17,.5),
 ('Left rib narrow fall',(-.67,-.63,3.65),(-.76,-.66,3.23),.14,.6),
 ('Left elbow front shoot',(-1.86,-.46,3.01),(-1.97,-.50,2.49),.18,.1),
 ('Left elbow outer short',(-2.01,.02,3.15),(-2.17,-.01,2.82),.17,-.4),
 ('Right elbow outside spear',(2.06,.02,2.99),(2.28,-.13,2.51),.20,.5),
 ('Right arm green fall',(1.92,-.52,2.69),(1.96,-.61,2.17),.16,-.3),
 ('Left hip slim fall',(-.56,-.43,2.24),(-.67,-.51,1.75),.18,.4),
 ('Right thigh diagonal shoot',(.81,-.42,2.01),(.96,-.44,1.48),.20,-.4),
 ('Left thigh rear shoot',(-.87,.41,1.80),(-1.05,.48,1.32),.17,.5),
 ('Left shin side spear',(-1.20,-.19,1.08),(-1.44,-.26,.57),.17,.3),
 ('Right calf narrow fall',(1.12,-.44,.83),(.97,-.51,.37),.17,.3),
 ('Right knee outer leaf',(1.05,.22,1.37),(1.27,.15,1.02),.17,.2),
 ('Low back unequal shoot',(.27,.62,2.46),(.43,.67,2.02),.14,.5),
]
for name,start,tip,width,roll in shoots:
    # Per-region attachment offsets follow rebuilt group seats.
    if 'shoulder' in name or 'scapula' in name or 'high cascade' in name:
        dy=.12 if start[1]>0 else -.12; dz=.15
    elif 'back' in name or 'Spinal' in name:
        dy=.18; dz=.08
    else:
        dy=.10 if start[1]>0 else -.10; dz=.05
    start=(start[0],start[1]+dy,start[2]+dz)
    tip=(tip[0],tip[1]+dy,tip[2])
    leaf(name,start,tip,width*1.10,'leaf',roll)

# A continuous shape-space bend affects every named component coherently.
# Keep the head/core relationship; deepen rib and shoulder cage then lean it.
for ob in parts:
    for v in ob.data.vertices:
        x,y,z=v.co
        upper=max(0,min(1,(z-2.15)/1.8))
        body=max(0,1-max(0,abs(x)-1.25)/1.05)
        y*=1+.34*upper*body
        y-=.25*max(0,min(1,(z-2.4)/1.9))
        # Break rigid bilateral leg rhythm without disconnecting root overlaps.
        if z<2.25:
            y+=.10*math.sin(z*2.0)*(1 if x>0 else -.7)
        # Lengthen the bowed leg load paths locally, leaving feet planted.
        lift=.24*max(0,min(1,(z-.35)/1.8))
        if z>4.4: lift*=max(.55,1-(z-4.4)*.25)
        side=1 if x>0 else -1
        if .35<z<2.3:
            x+=side*.11*math.sin(math.pi*(z-.35)/1.95)
            y+=.075*math.sin(math.pi*(z-.35)/1.95)
        # Narrow upper cage while retaining independent long arm paths.
        if 2.1<z<4.4:
            weight=max(0,1-abs(abs(x)-.6)/1.15)
            x*=1-.10*weight
            # shoulder height difference fades into torso and wrist.
            z+=side*.085*max(0,1-abs(z-3.9)/1.1)*min(1,abs(x)/1.15)
        if abs(x)>1.45 and 1.1<z<3.4:
            x-=side*.06*math.sin((z-1.1)*math.pi/2.3)
        z+=lift
        v.co=(x,y,z)
    ob.data.update()

# Named connected growth regions are retained for later rigging work.
for ob in parts:
    ob['asset']='tide-root-colossus-lowpoly'
    ob['status']='unaccepted-complete-grown-anatomy-study'
    ob['front']='-Y'

for ob in parts:
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(ob.data);bm.free();ob.data.update()
# Native geometry document supports round-trip reconstruction without GLB loss.
native={'schema':'wildshard.editable-mesh.v1','front':'-Y','units':'meters','status':'static unaccepted anatomy; no animation approval','palette':palette,'parts':[]}
prior_pivots={p['name']:p['editPivot'] for p in json.loads((Path(__file__).resolve().parent.parent/'complete-character-next/editable-native.json').read_text())['parts']}
for ob in parts:
    verts=[list(v.co) for v in ob.data.vertices]
    center=[sum(v[i] for v in verts)/len(verts) for i in range(3)]
    native['parts'].append({'name':ob.name,'vertices':verts,'faces':[list(f.vertices) for f in ob.data.polygons],'faceMaterials':[ob.data.materials[f.material_index].name for f in ob.data.polygons],'editPivot':prior_pivots[ob.name]})
(out/'editable-native.json').write_text(json.dumps(native,separators=(',',':'))+'\n')
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
glb=out/'tide-root-colossus-complete-grown-anatomy.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
import struct
raw=glb.read_bytes();jslen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jslen]);binary=raw[20+jslen:]
for item in doc['meshes']:item.pop('name',None)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+binary)
points=[ob.matrix_world @ Vector(c) for ob in parts for c in ob.bound_box]
lo=[min(v[i] for v in points) for i in range(3)]
hi=[max(v[i] for v in points) for i in range(3)]
triangles=sum(sum(len(f.vertices)-2 for f in ob.data.polygons) for ob in parts)
(out/'metrics-complete-grown-anatomy.json').write_text(json.dumps({'status':'unaccepted complete grown anatomy coupled anatomy/growth study','objects':len(parts),'triangles':triangles,'bounds':{'min':lo,'max':hi},'front':'-Y','glbBytes':glb.stat().st_size,'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'rendered':a.render},indent=2)+'\n')
if a.render:
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=False
    scene.render.resolution_x=900
    scene.render.resolution_y=1200
    scene.render.resolution_percentage=100
    scene.world.color=(.12,.12,.12)
    scene.view_settings.view_transform='Standard'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.08))
    floor=bpy.context.object
    m=bpy.data.materials.new('Review floor')
    m.diffuse_color=(.025,.04,.055,1)
    floor.data.materials.append(m)
    def aim(ob,point):
        ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,energy,size in [('Key',(-4,-6,9),1500,5),('Fill',(5,-3,5),850,4),('Rim',(0,4,7),1800,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        ob=bpy.context.object
        ob.name=name
        ob.data.energy=energy
        ob.data.shape='DISK'
        ob.data.size=size
        aim(ob,(0,0,3))
    bpy.ops.object.camera_add(location=(7,-15,8))
    cam=bpy.context.object
    cam.data.type='ORTHO'
    cam.data.ortho_scale=7.25
    aim(cam,(0,0,2.95))
    scene.camera=cam
    for name,loc in [('front',(0,-16,6.6)),('three-quarter',(7,-15,7.4)),('back',(-7,15,7.4))]:
        if name not in a.views.split(','):
            continue
        cam.location=loc
        aim(cam,(0,0,2.95))
        scene.render.filepath=str(out/(name+'.png'))
        bpy.ops.render.render(write_still=True)
