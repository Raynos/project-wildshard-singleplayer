"""Deterministic complete pass4 derivation from pinned retained pass1.
Only writes this directory's editable producer. No runtime edits.
"""
from pathlib import Path
import hashlib
base=Path(__file__).resolve().parent
original=(base.parent/'complete-pass1/build_colossus_complete.py').read_bytes()
assert hashlib.sha256(original).hexdigest()=='f7aff0e673e566e3cd6be4376d92b64109e596fb7124b904d0dab471381230b0'
s=original.decode().replace('complete-pass1','complete-pass4').replace('complete pass 1','complete pass 4')
s=s.replace("'leaf': '71952D', 'leafLight': '98B63B', 'leafDark': '436528'", "'leaf': '698D29', 'leafLight': '87A735', 'leafDark': '3E6227'")
# Root thickness is reduced selectively, not a whole-body/global scale change.
s=s.replace('    vertices = []\n    points =', '''    if any(token in name.lower() for token in ('forearm','arm descending','upper arm crossing')):
        sections=[(*sec[:3],sec[3]*.87,sec[4]*.90,*sec[5:]) for sec in sections]
    if 'heart clasp' in name or 'heart claw' in name:
        sections=[(*sec[:3],sec[3]*.82,sec[4]*.86,*sec[5:]) for sec in sections]
    vertices = []
    points =''',1)
# Remove repeated placement recipe entirely; growth below is authored in world space.
start=s.index('def canopy(');end=s.index('# Root anatomy:',start)
s=s[:start]+'''def growth(name, center, extent, yaw=0, pitch=0, tone='leaf'):
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
    faces=[(0,1,7),(1,2,8,7),(2,3,9,8),(3,4,9),(4,5,8,9),(5,6,7,8),(6,0,7),(7,8,9),
           (1,0,10),(2,1,10),(3,2,10),(4,3,10),(5,4,10),(6,5,10),(0,6,10)]
    # Broad same-tone planes alternate with narrow creases, no bright badge rim.
    mesh(name,verts,faces,[tone,tone,'leafLight',tone,'leafDark',tone,'leafLight',tone,
                         'leafDark','leafDark',tone,'leafDark','leafDark',tone,'leafDark'])


'''+s[end:]
s='\n'.join(line for line in s.split('\n') if not line.lstrip().startswith('canopy('))
# Unequal open digit paths, preserving palm and genuine intervening space.
replacements={
"root(f'Middle root digit {s}'":"    root(f'Middle root digit {s}',[(s*2.10,-.38,1.54,.19,.17),(s*2.10,-.57,1.23,.16,.14),(s*2.02,-.80,.91,.12,.11),(s*1.83,-.92,.76,.055,.06)],twist=s*.24)",
"root(f'Inner root digit {s}'":"    root(f'Inner root digit {s}',[(s*1.91,-.24,1.53,.14,.15),(s*1.80,-.35,1.23,.13,.12),(s*1.70,-.57,1.02,.095,.09),(s*1.65,-.70,1.10,.035,.045)],twist=-s*.23)",
"root(f'Opposed root thumb {s}'":"    root(f'Opposed root thumb {s}',[(s*1.98,-.19,1.73,.19,.18),(s*1.62,-.16,1.55,.16,.15),(s*1.46,-.28,1.31,.12,.12),(s*1.49,-.48,1.23,.045,.055)],twist=s*.35)",
"root('Crown left main'":"root('Crown left main',[(-.32,-.09,4.45,.22,.20),(-.60,.00,4.87,.23,.19),(-.75,.12,5.19,.17,.15),(-.73,.19,5.52,.13,.11),(-.86,.14,5.85,.055,.065)],twist=-.2)",
"root('Crown right main'":"root('Crown right main',[(.34,-.06,4.47,.23,.19),(.63,.02,4.81,.21,.18),(.78,.03,5.16,.16,.14),(.60,-.12,5.43,.13,.11),(.62,-.23,5.72,.045,.055)],twist=.25)",
"root('Crown right short tine'":"root('Crown right short tine',[(.77,.02,5.13,.10,.10),(.98,-.06,5.31,.08,.07),(1.09,-.15,5.53,.03,.04)],twist=.2)",
}
for prefix,line in replacements.items():
 rows=[l for l in s.splitlines() if l.lstrip().startswith(prefix)];assert len(rows)==1,prefix;s=s.replace(rows[0],line)
# More detailed offset facets of one closed heart, not overlapping glow slabs.
a=s.index('# Heart:');b=s.index('# Integrated long bark mask:',a)
s=s[:a]+'''# Heart: offset perimeter and staggered internal ridges, closed back fan.
vs=[(-.06,-.43,3.74),(-.28,-.49,3.48),(-.38,-.45,3.19),(-.28,-.41,2.87),
    (-.10,-.42,2.65),(.16,-.42,2.73),(.37,-.40,3.07),(.26,-.45,3.43),
    (-.08,-.79,3.45),(-.21,-.83,3.15),(.07,-.87,3.10),(.02,-.72,2.84),(.15,-.74,3.37),(0,-.12,3.20)]
fs=[(0,1,8),(1,2,9,8),(2,3,9),(3,4,11,9),(4,5,11),(5,6,10,11),
    (6,7,12,10),(7,0,8,12),(8,9,10),(8,10,12),(9,11,10)]
fs += [(i,13,(i+1)%8) for i in range(8)]
mesh('Exposed turquoise heart',vs,fs,['heartLight','heart','heart','heartLight','heart','heart',
    'heartLight','heart','heart','heartLight','heart','heart'])

'''+s[b:]
# Keep full-length pale mask, replace wide bright forehead triangle with brow planes.
s=s.replace("(-.39,-.36,4.67),(.38,-.35,4.65)","(-.36,-.36,4.65),(.35,-.35,4.64)")
s=s.replace("(.035,-.65,3.63),\n    (-.07,-.65,3.66)","(.055,-.65,3.65),\n    (-.065,-.65,3.66)")
s=s.replace("(0,-.61,4.53),(0,-.72,4.21),(0,-.69,3.84)","(0,-.57,4.58),(0,-.72,4.21),(0,-.69,3.84)")
s=s.replace("(-.26,-.08,4.45),(.27,-.08,4.45),(0,-.13,3.91)]", "(-.26,-.08,4.45),(.27,-.08,4.45),(0,-.13,3.91),(0,-.665,3.77)]")
s=s.replace('(5,10,4)', '(5,10,14),(14,10,4)').replace('(4,13,5)', '(4,13,14),(14,13,5)')
s=s.replace("['lightwood','wood','lightwood','wood','lightwood','cut','lightwood','cut','lightwood','wood','cut','lightwood','wood','darkwood','wood','darkwood','wood']", "['wood','lightwood','cut','lightwood','cut','lightwood','cut','cut','lightwood','cut','lightwood','cut','lightwood','wood','darkwood','wood','darkwood','darkwood','wood']")
# Individually authored group arrangements: mass axes wrap the scapula in depth;
# elbow, hip, and shin groups have different amounts, orientation and perimeter.
a=s.index('# A continuous shape-space bend')
growth='''# Hand-authored growth islands: center, extents, yaw, pitch.
# No mirrored three-lobe canopy call and no repeated every-joint cuff recipe.
islands=[
 ('Left scapula saddle',(-1.18,.06,4.10),(.52,.43,.39),-.5,.50),
 ('Left shoulder rear fold',(-1.29,.42,3.92),(.45,.40,.46),.20,.88),
 ('Left shoulder outer fall',(-1.57,-.08,3.91),(.29,.39,.46),-.80,-.82),
 ('Left collar sprout',(-.61,.08,4.17),(.30,.25,.28),.60,.23),
 ('Right high shoulder island',(1.19,.13,4.22),(.49,.42,.38),.55,-.35),
 ('Right shoulder front fold',(1.39,-.23,4.02),(.40,.35,.42),-.3,-.70),
 ('Right rear outer fall',(1.53,.28,3.82),(.27,.41,.48),.80,.85),
 ('Nape tucked island',(.03,.33,4.17),(.33,.36,.26),.3,.65),
 ('Left upper back climbing growth',(-.72,.63,3.86),(.38,.36,.47),-.7,.85),
 ('Left lower scapular fall',(-.56,.83,3.47),(.33,.33,.48),.4,1.15),
 ('Right rear ridge growth',(.58,.70,3.84),(.42,.39,.35),-.4,.55),
 ('Right lower back island',(.73,.83,3.35),(.34,.34,.42),.60,1.02),
 ('Central offset back growth',(-.02,.83,3.15),(.27,.29,.39),.3,1.12),
 ('Left rib trailing growth',(-.68,-.42,3.63),(.31,.29,.28),-.4,-.8),
 ('Right collar crease',(.55,-.16,4.01),(.22,.24,.24),.7,-.4),
 ('Left elbow climbing moss',(-1.82,.06,3.18),(.33,.38,.33),-.6,.85),
 ('Left elbow front drape',(-1.85,-.38,2.98),(.30,.31,.32),.3,-.78),
 ('Right elbow outer island',(1.94,.03,2.96),(.32,.38,.37),.7,.4),
 ('Right arm descending growth',(1.92,-.41,2.64),(.28,.30,.39),.2,-.85),
 ('Left forearm outer remnant',(-2.20,.09,2.01),(.18,.29,.29),-.5,.65),
 ('Right forearm rear sprout',(2.16,.23,1.84),(.16,.28,.24),.7,.9),
 ('Left hip diagonal island',(-.47,-.33,2.18),(.30,.26,.29),-.65,-.9),
 ('Left thigh root following growth',(-.86,.22,1.73),(.21,.32,.35),-.4,.55),
 ('Right hip upward sprout',(.43,.23,2.39),(.28,.30,.25),.5,.5),
 ('Right thigh front fall',(.78,-.32,1.95),(.25,.27,.40),.6,-.72),
 ('Rear pelvis rooted growth',(.18,.46,2.46),(.30,.27,.24),.45,.8),
 ('Left shin outer fold',(-1.08,-.16,1.02),(.27,.31,.33),-.8,-.8),
 ('Left calf rear moss',(-1.01,.31,.70),(.21,.24,.28),.4,.9),
 ('Right knee green sprout',(.96,.11,1.36),(.26,.25,.29),.5,.55),
 ('Right calf winding growth',(1.16,-.25,.78),(.25,.28,.35),.7,-.9),
 ('Right inner ankle moss',(.74,-.24,.42),(.20,.23,.20),-.6,-.5),
]
for name,center,extent,yaw,pitch in islands:
    growth(name,center,extent,yaw,pitch)
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
    leaf(name,start,tip,width,'leaf',roll)

'''
s=s[:a]+growth+s[a:]
# Coherent spatial deformation moves roots, foliage and embedded slate together.
key='''        v.co=(x,y,z)'''
new='''        # Lengthen the bowed leg load paths locally, leaving feet planted.
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
            x+=side*.08*math.sin((z-1.1)*math.pi/2.3)
        z+=lift
        v.co=(x,y,z)'''
assert key in s;s=s.replace(key,new)
s=s.replace("'status':'unaccepted complete pass 4 integrated growth study'","'status':'unaccepted complete pass 4 coupled anatomy/growth study'")
(base/'build_colossus_complete.py').write_text(s)
print('Wrote editable pass4 source',len(s.encode()))
