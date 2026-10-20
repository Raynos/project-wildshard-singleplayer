"""Derive the complete sibling producer without writing any predecessor."""
from pathlib import Path
H=Path(__file__).resolve().parent
s=(H.parent/'complete-integrated-next/build_mantis_complete.py').read_text()
s=s.replace('complete-integrated-next','complete-sculpted-anatomy')
# The 20 authored pivots and the native22 hierarchy are deliberately unchanged.
# Construct an imbricated thorax in volume, not a smooth cream neck column.
a=s.index("loft('Integrated pale throat'");b=s.index('for side in [-1,1]:',a)
s=s[:a]+'''loft('Integrated pale throat',[((0,-.015,1.73),.075,.045),((0,-.18,2.01),.080,.040),((0,-.34,2.25),.075,.040),((0,-.51,2.46),.050,.030),((0,-.67,2.55),.018,.015)],[warm,light,wood],n=5)
for j in range(4):
 p=Vector(neck[j+2][0]);q=Vector(neck[j+1][0])
 # Forward overlapping wedge faces grow from the chest rather than hanging free.
 leaf('Layered sternal bark '+str(j),tuple(p+Vector((0,-.095,.10))),tuple(q+Vector((0,-.17,-.11))),.145-j*.017,.075,mats=[warm,light,wood])
''' +s[b:]
s=s.replace("base=p+Vector((side*.07,.015,.055))", "base=p+Vector((side*.075,-.045,.09))")
s=s.replace("tip=p2+Vector((side*(.29-j*.027),.10,-.075))", "tip=p2+Vector((side*(.24-j*.021),-.075,-.11))")
s=s.replace(".125-j*.008,.075", ".15-j*.011,.082")
s=s.replace("(side*.08,-.54,2.66),(side*.28,-.28,2.82),.075,.055", "(side*.08,-.54,2.66),(side*.29,-.30,2.81),.095,.060")
# Smaller inset almond eyes, encircled by an angular orbital recess and brow.
a=s.index(' perimeter=[(.075');b=s.index(" # Brow ridge",a)
s=s[:a]+''' perimeter=[(.112,-.646,2.625),(.205,-.500,2.662),(.262,-.466,2.582),(.207,-.586,2.476),(.123,-.674,2.521)]
 center=(.190,-.585,2.563)
 rim=[(center[0]+(x-center[0])*1.17,y+.012,center[2]+(z-center[2])*1.13) for x,y,z in perimeter]
 vs=[(s*x,y,z) for x,y,z in rim]+[(s*center[0],center[1]+.025,center[2])]
 vs += [(s*x,y+.033,z) for x,y,z in rim]
 fs=[(i,(i+1)%5,5) for i in range(5)]+[tuple(6+i for i in reversed(range(5)))]+[(i,6+i,6+(i+1)%5,(i+1)%5) for i in range(5)]
 mesh('Recessed angular orbit '+str(s),vs,fs,[dark,wood,warm],[0,0,0,0,0,1]+[1]*5,'head')
 vs=[(s*x,y,z) for x,y,z in perimeter]+[(s*.188,-.647,2.569)]
 vs += [(s*x,y+.025,z) for x,y,z in perimeter]
 mesh('Inset green compound eye '+str(s),vs,fs,[eye,eyeLight,shade],[1,0,0,0,1,2]+[2]*5,'head')
''' +s[b:]
s=s.replace("((s*.08,-.65,2.66),.018,.018),((s*.19,-.53,2.71),.026,.022),((s*.275,-.38,2.66),.025,.023)","((s*.095,-.66,2.66),.028,.024),((s*.19,-.53,2.71),.040,.030),((s*.275,-.38,2.66),.035,.030)")
s=s.replace("((s*.26,-.36,2.55),.032,.03),((s*.22,-.49,2.44),.031,.026),((s*.065,-.72,2.34),.005,.006)","((s*.255,-.37,2.56),.045,.037),((s*.22,-.51,2.45),.039,.032),((s*.075,-.71,2.36),.007,.008)")
# Compact lower mask; crown remains angular and broad enough for orbital planes.
s=s.replace("[(0,-.77,2.35),(.075,-.69,2.39),(.17,-.50,2.43),(.13,-.28,2.40),(0,-.20,2.40),(-.13,-.28,2.40),(-.17,-.50,2.43),(-.075,-.69,2.39)]", "[(0,-.74,2.38),(.075,-.68,2.41),(.17,-.50,2.45),(.13,-.28,2.42),(0,-.20,2.42),(-.13,-.28,2.42),(-.17,-.50,2.45),(-.075,-.68,2.41)]")
# Six distinct leaf volumes. New lower leaves remain rigid children of the
# existing lower wing joints, so the exact native rig contract is preserved.
s=s.replace("(-.62,1.48,3.36)","(-.72,1.37,3.36)").replace("(.46,1.67,2.99)","(.61,1.50,3.17)").replace("(-1.18,1.94,2.42)","(-1.06,1.75,2.72)").replace("(1.04,2.02,2.08)","(.98,1.86,2.58)")
s=s.replace("(-1,0):.39,(1,0):.29,(-1,1):.34,(1,1):.27", "(-1,0):.31,(1,0):.29,(-1,1):.29,(1,1):.27")
s=s.replace("depth=.29 if j==0 else .23", "depth=.19 if j==0 else .15")
s=s.replace(" # Walking pairs:",''' # Short lateral fan leaf: separate attachment and tilt, no new native joint.
 lower='wing'+str(s)+'_1'
 leaf('Leaf wing short '+str(s),(s*.20,.77,1.49),(s*1.19,1.94,1.97 if s<0 else 2.05),.255,.12,lower)
 loft('Short fan petiole '+str(s),[((s*.20,.77,1.49),.026,.021),((s*.61,1.20,1.70),.019,.015),((s*1.17,1.91,1.97 if s<0 else 2.05),.004,.004)],[wood,warm],lower,5,continuous_frame=True)
 # Walking pairs:''')
# Reduce thigh/shin abruptness; bark greaves align with the complete leg taper.
s=s.replace("[(hip,.18,.15),((s*.43,.08+j*.82,1.34),.205,.155),((s*.61,.04+j*.9,1.15),.16,.12),(knee,.115,.10)]", "[(hip,.145,.13),((s*.43,.08+j*.82,1.34),.158,.13),((s*.61,.04+j*.9,1.15),.133,.108),(knee,.108,.093)]")
s=s.replace(".145,.105),((s*(.96+j*.14)", ".122,.094),((s*(.96+j*.14)")
s=s.replace("(s*.46,-.055+j*.84,1.35),(s*.72,-.12+j*.86,.73),.16,.082", "(s*.43,-.065+j*.84,1.34),(s*.69,-.14+j*.86,.79),.135,.065")
# Waist/abdomen: more deliberate peak with overlapping lances instead of barrels.
a=s.index("for i in range(4):\n y=.29");b=s.index('# Curved insect prothorax',a)
s=s[:a]+'''for i,(y,w,length) in enumerate([(.26,.285,.52),(.60,.245,.51),(.93,.195,.48),(1.22,.135,.47)]):
 loft('Abdominal tergite '+str(i),[((0,y,1.49-i*.025),w*.88,.17-i*.018),((0,y+.14,1.55-i*.025),w,.205-i*.024),((0,y+length,1.40-i*.025),w*.34,.055)],[wood,warm,light],n=6,continuous_frame=True)
''' +s[b:]
s=s.replace("(side*.19,.18+j*.60,1.61),(side*.43,.42+j*.64,1.15),.145,.09", "(side*.14,.11+j*.60,1.66),(side*.35,.39+j*.64,1.12),.165,.085")
# Apply a single anatomical blade-plane rotation, not a camera trick. The same
# rigid rotation is shared by wood and ivory so their cutting boundary stays joined.
a=s.index('# Overlapping hip collars')
s=s[:a]+'''# The cutting planes are oblique volumes visible from front and profile.
for ob in objects:
 if ob.name.startswith(('Swept bevelled wood sickle','Bevelled continuous ivory teeth')):
  side=-1 if ob.name.endswith('-1') else 1
  center=pivots['raptor'+str(side)+'_hook'].location
  theta=-side*.68;c=math.cos(theta);sn=math.sin(theta)
  for v in ob.data.vertices:
   dx=v.co.x-center.x;dy=v.co.y-center.y
   v.co.x=center.x+c*dx-sn*dy;v.co.y=center.y+sn*dx+c*dy

''' +s[a:]
# Reduce upper torso hub mass while keeping body bone and all ground contacts.
a=s.index('for ob in objects:\n for v in ob.data.vertices:')
s=s[:a]+'''# Continuous waist taper across attached body shells only. No root lift.
for ob in objects:
 if ob['joint']=='body' and not ob.name.startswith(('Leaf wing','Seated','Short')):
  for v in ob.data.vertices:
   weight=max(0,1-abs(v.co.z-1.50)/.34)
   v.co.x*=1-.12*weight

''' +s[a:]
s=s.replace("4 thick wings; 2 antennae", "6 thick leaves on 4 wing joints; 2 antennae")
(H/'build_mantis_complete.py').write_text(s)
