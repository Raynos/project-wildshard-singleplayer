"""One-time explicit derivation of pass3; retained for source provenance."""
from pathlib import Path
here=Path(__file__).resolve().parent
s=(here.parent/'complete-pass2/build_bellback_complete.py').read_text()
s=s.replace('Bellback editable full-3D study V6, solid shoulder and facial anatomy.','Bellback complete-pass3: projecting wreck-guardian wedge anatomy.')
s=s.replace("bellback-complete-pass2.glb","bellback-complete-pass3.glb").replace('Bellback complete pass 2','Bellback complete pass 3')
start=s.index('# Broad coherent skull')
end=s.index('# Anatomical asymmetry')
s=s[:start]+'''# A long descending wedge is the skull, not a compact feline mask.
# Cross sections widen at the temples and converge into a blunt splintered nose.
loft('Solid timber cranium',[((0,-.61,1.35),.73,.34),((0,-1.14,1.38),.72,.32),((0,-1.72,1.13),.49,.24),((0,-2.08,.95),.25,.17)],[wood,cut,shade],7)
v=[(-.27,-.86,1.64),(.28,-.86,1.65),(-.31,-1.52,1.47),(.33,-1.52,1.47),(-.18,-2.13,.94),(.18,-2.13,.94),(0,-2.26,1.03),(0,-1.58,1.65),(0,-.94,1.77),(-.24,-1.42,1.05),(.24,-1.42,1.05),(0,-2.10,.81)]
f=[(0,2,7,8),(1,8,7,3),(2,4,6,7),(3,7,6,5),(4,11,5,6),(0,9,4,2),(1,3,5,10),(9,10,11,4),(9,0,8,1,10),(10,5,11)]
mesh('Pointed central face keel',v,f,[wood,cut,shade],[0,1,1,0,1,2,2,2,2,2])
for side in [-1,1]:
 # Broad brow blade is rooted behind the eye and descends toward the nose.
 brow_front=[(.83,-.73,1.73),(.76,-1.28,1.61),(.30,-2.13,1.06),(.36,-2.10,.97),(.65,-1.64,1.20),(.83,-.93,1.42)]
 bv=[(side*x,y,z) for x,y,z in brow_front]+[(side*(x-.16),y+.12,z+.045) for x,y,z in brow_front]
 bf=[tuple(range(6)),tuple(range(11,5,-1))]+[(i,i+6,(i+1)%6+6,(i+1)%6) for i in range(6)]
 if side<0:bf=[tuple(reversed(f)) for f in bf]
 mesh('Shaped orbital brow timber',bv,bf,[wood,cut,shade],[1,2,0,1,0,2,0,0])
 loft('Lower cheek timber',[((side*.69,-.84,1.12),.24,.19),((side*.62,-1.44,.96),.20,.14),((side*.31,-2.04,.80),.12,.08)],[wood,shade,cut],5)
 loft('Swept cheek horn',[((side*.75,-.69,1.20),.23,.21),((side*1.05,-.78,1.51),.21,.17),((side*1.24,-.88,1.93),.14,.12),((side*1.20,-.99,2.30),.045,.035)],[wood,cut,shade],6)
 def eye_prism(name,front,depth,mat):
  vv=[(side*x,y,z) for x,y,z in front]+[(side*(x-depth*.6),y+depth,z) for x,y,z in front]
  ff=[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
  if side<0:ff=[tuple(reversed(q)) for q in ff]
  return mesh(name,vv,ff,[mat])
 eye_prism('Recessed eye shadow',[(.37,-2.08,.99),(.71,-1.60,1.23),(.63,-1.76,.98)],.07,dark)
 eye_prism('Inset amber eye',[(.405,-2.045,1.025),(.675,-1.645,1.19),(.602,-1.79,1.025)],.025,eye)
 # Original has two pale splinters on the crown, not eyebrow stripes.
 loft('Ivory crown splinter '+str(side),[((side*.32,-1.32,1.53),.085,.065),((side*.37,-1.30,1.82+(side*.035)),.012,.015)],[ivory],4)
loft('Mouth dark pocket',[((0,-1.58,.87),.43,.14),((0,-2.08,.74),.32,.15)],[dark],6)
loft('Lower timber jaw',[((0,-1.22,.68),.36,.15),((0,-1.80,.57),.33,.12),((0,-2.12,.67),.21,.09)],[wood,shade,cut],5)
# Every tooth is an independent broad pointed solid with visible dark gaps.
# Unequal inclination and height are intentional, while roots intersect the jaw.
for side in [-1,1]:
 for j,(x,y,z,w) in enumerate([(.32,-1.96,.91,.09),(.19,-2.13,.86,.075)]):
  loft('Ivory upper fang '+str(side)+' '+str(j),[((side*x,y,z),w,.07),((side*(x-.015),y-.035,z-.15),w*.72,.05),((side*(x-.035),y-.055,z-.26),.012,.015)],[ivory],4)
 for j,(x,y,z,w) in enumerate([(.27,-2.03,.62,.095),(.075,-2.16,.59,.09)]):
  loft('Ivory lower tooth '+str(side)+' '+str(j),[((side*x,y,z),w,.075),((side*(x+.015),y-.025,z+.09),w*.78,.055),((side*(x+.025),y-.04,z+.25+(j*.025)),.012,.015)],[ivory],4)
''' +s[end:]
# Replace the sparse two-rib frame with three uneven load-bearing wreck ribs per flank.
s=s.replace("for j,y in enumerate([-.04,.98]):", "for j,y in enumerate([-.18,.48,1.13]):")
s=s.replace("top=(side*(.72 if j==0 else .52),y+.30,3.10+(0.20 if j else -.20)+(side*.08))", "top=(side*[.91,.72,.48][j],y+[.11,.23,.19][j],[2.94,3.42,3.18][j]+side*.10)")
s=s.replace(".17,.16),((side*.90,y+.09,2.22),.18,.15)",".21,.18),((side*.90,y+.09,2.22),.20,.17)")
insert=s.index('# A central split stern plank')
s=s[:insert]+'''# Broad overlapping wreck strakes have rooted ends and unequal broken tips.
# They fill the carrier's side mass without obscuring the retained bell mouth.
for side in [-1,1]:
 loft('Lower broken side strake '+str(side),[((side*.99,-.64,1.48),.15,.20),((side*1.13,.32,1.68),.16,.21),((side*.82,1.36,1.95),.13,.16)],[wood,cut,shade],5)
 loft('Middle broken side strake '+str(side),[((side*1.0,-.41,2.08),.12,.17),((side*1.10,.49,2.31),.14,.20),((side*.76,1.36,2.51),.11,.15)],[wood,shade,cut],5)
 beam('Stern diagonal wreck plank '+str(side),(side*.78,.87,1.39),(side*.39,1.56,3.37+side*.16),.19,.13)
 # Shoulder armor overlaps the humerus in one large tapered facet mass.
 loft(('Right fore' if side>0 else 'Left fore')+' outer timber shield',[((side*.79,-.71,1.61),.29,.22),((side*1.16,-.99,1.10),.36,.26),((side*1.30,-1.22,.39),.15,.10)],[wood,cut,shade],5)
''' +s[insert:]
(here/'build_bellback_complete.py').write_text(s)
cap=(here.parent/'complete-pass2/capture_review.py').read_text()
(here/'capture_review.py').write_text(cap)
pkg=(here.parent/'complete-pass2/package_evidence.py').read_text().replace('complete-pass2','complete-pass3').replace('complete pass 2','complete pass 3')
(here/'package_evidence.py').write_text(pkg)
