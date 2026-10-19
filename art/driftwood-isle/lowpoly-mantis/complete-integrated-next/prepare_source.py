"""One-shot derivation of a complete editable source. Never writes predecessors."""
from pathlib import Path
H=Path(__file__).resolve().parent
s=(H.parent/'complete-proportion-study/build_mantis_complete.py').read_text().replace('complete-proportion-study','complete-integrated-next')
s=s.replace("(.43,.235,.095)","(.47,.255,.105)").replace("(.65,.37,.155)","(.70,.405,.18)").replace("(.89,.61,.29)","(.94,.66,.34)")
s=s.replace("(.26,.45,.045)","(.29,.47,.055)").replace("(.57,.72,.09)","(.64,.76,.115)").replace("(.13,.27,.035)","(.14,.29,.035)")
# Less engineered leaf folding: asymmetric shoulders, broad staggered facets.
s=s.replace("[(.12,.32,.45,.12,-.18),(.32,.86,1.10,-.26,.19),(.55,1,.90,.22,-.29),(.73,.77,1.15,-.16,.15),(.90,.23,.40,.10,-.10)]", "[(.12,.30,.42,.12,-.20),(.31,.90,1.05,-.26,.15),(.56,1.0,.78,.18,-.34),(.76,.66,1.10,-.16,.12),(.91,.22,.40,.10,-.10)]")
a=s.index("loft('Abdomen core'");b=s.index('# Curved insect prothorax',a)
s=s[:a]+'''# A tapered bark abdomen with a peaked spine and imbricated flanks.
loft('Abdomen core',[((0,.14,1.47),.24,.25),((0,.65,1.43),.33,.26),((0,1.17,1.36),.26,.18),((0,1.80,1.31),.014,.018)],[wood,warm,light],n=7)
for i in range(4):
 y=.29+i*.32
 loft('Abdominal tergite '+str(i),[((0,y,1.49-i*.025),.27-i*.027,.20),((0,y+.16,1.53-i*.025),.33-i*.034,.24),((0,y+.43,1.40-i*.025),.18-i*.028,.12)],[wood,warm,light],n=5,continuous_frame=True)
''' +s[b:]
a=s.index('neck=[');b=s.index("loft('Rising prothorax",a)
s=s[:a]+'''neck=[((0,.36,1.40),.265,.23),((0,.19,1.69),.235,.205),
      ((0,.01,1.98),.205,.18),((0,-.14,2.24),.18,.155),
      ((0,-.33,2.48),.165,.145),((0,-.53,2.66),.155,.13),
      ((0,-.70,2.64),.125,.105)]
''' +s[b:]
a=s.index("loft('Integrated pale throat'");b=s.index('for side in [-1,1]:',a)
s=s[:a]+'''loft('Integrated pale throat',[((0,-.025,1.72),.08,.047),((0,-.18,1.99),.09,.045),((0,-.33,2.23),.082,.04),((0,-.48,2.43),.052,.035),((0,-.68,2.54),.02,.018)],[light,ivory,warm],n=5)
''' +s[b:]
s=s.replace("range(5):\n  p=Vector(neck[j+1]", "range(5):\n  p=Vector(neck[j+1]") # retain anchored plate count
s=s.replace("side*(.25-j*.024)","side*(.29-j*.027)").replace(".105-j*.008,.062", ".125-j*.008,.075")
s=s.replace("(side*.08,-.69,2.58),(side*.23,-.40,2.72)","(side*.08,-.54,2.66),(side*.28,-.28,2.82)")
# The eyes keep their socket perimeter, but gain a modest convex central facet.
s=s.replace("(s*.212,-.655,2.565)","(s*.212,-.695,2.570)")
s=s.replace("(s*.24,.04,2.78),.065,.045", "(s*.31,.08,2.86),.085,.055")
# Bent antennae retain common roots and diverge in a twig-like gesture.
s=s.replace("((s*.30,-.32,2.99),.032,.025),((s*.46,-.30,3.34),.024,.018),((s*.62,-.37,3.60),.011,.009)", "((s*.27,-.29,2.99),.032,.025),((s*.43,-.37,3.34),.024,.018),((s*.64,-.48,3.60),.011,.009)")
s=s.replace("(s*.60,-.36,3.56),(s*.82,-.34,3.89),.085,.025", "(s*.62,-.47,3.57),(s*.98,-.52,3.75),.10,.031")
# Four dissimilar leaf masses, each with its ridge seated in the actual volume.
s=s.replace("(-.55,1.45,3.40)","(-.62,1.48,3.36)").replace("(.40,1.60,2.98)","(.46,1.67,2.99)").replace("(-1.05,1.85,2.50)","(-1.18,1.94,2.42)").replace("(.88,1.85,2.12)","(1.04,2.02,2.08)")
s=s.replace("(-1,0):.35,(1,0):.27,(-1,1):.32,(1,1):.24", "(-1,0):.39,(1,0):.29,(-1,1):.34,(1,1):.27")
s=s.replace("rib=[(base,.036,.027)]","rib=[(base,.027,.022)]").replace("ridge-normal*.012),.027,.024","ridge-normal*.018),.018,.017")
# Thicker angular shoulders and shins, narrower feet, retaining the four ground contacts.
s=s.replace("(hip,.17,.14)","(hip,.18,.15)").replace("1.34),.19,.145)","1.34),.205,.155)")
s=s.replace("1.15),.19,.13)","1.15),.16,.12)")
s=s.replace(".84),.125,.095)",".84),.145,.105)")
s=s.replace(".39),.065,.055)",".39),.073,.055)")
s=s.replace(".73),.13,.07", ".73),.16,.082")
# Lift and bring back the raptor elbow: genuine folded elbow, not an outstretched bar.
s=s.replace("sh=(s*.12,.10,1.94);el=(s*.59,-.76,1.62);wr=(s*1.03,-.95,2.30)","sh=(s*.14,.00,2.04);el=(s*.59,-.56,1.72);wr=(s*1.03,-.97,2.36)")
s=s.replace("[(sh,.085,.075),((s*.26,-.42,1.85),.095,.08),((s*.44,-.66,1.66),.073,.06),(el,.064,.055)]", "[(sh,.105,.09),((s*.29,-.27,1.98),.14,.105),((s*.48,-.48,1.78),.09,.075),(el,.073,.064)]")
s=s.replace("[(el,.065,.055),((s*.75,-.86,1.83),.08,.063),((s*.94,-.94,2.12),.10,.075),(wr,.085,.065)]", "[(el,.076,.064),((s*.73,-.73,1.88),.095,.08),((s*.93,-.91,2.20),.135,.095),(wr,.10,.085)]")
s=s.replace("outer=[(1.03,2.30),(1.21,2.10),(1.34,1.78),(1.31,1.40),(1.12,1.02),(.82,.73)]", "outer=[(1.03,2.36),(1.24,2.13),(1.40,1.78),(1.39,1.37),(1.20,.97),(.88,.61)]")
s=s.replace("inner=[(1.03,2.30),(1.08,2.04),(1.12,1.73),(1.08,1.39),(.97,1.08),(.82,.73)]", "inner=[(1.03,2.36),(1.09,2.06),(1.15,1.75),(1.12,1.38),(1.03,1.04),(.88,.61)]")
s=s.replace("thickness=[.055,.075,.066,.05,.033,.002]", "thickness=[.075,.12,.105,.085,.052,.003]")
s=s.replace("contour=inner+[(.86,1.25),(1.02,1.32),(.83,1.58),(1.05,1.66),(.88,1.93),(1.03,2.01)]", "contour=inner+[(.92,.91),(.78,1.12),(1.04,1.20),(.82,1.43),(1.10,1.51),(.86,1.78),(1.11,1.84),(.92,2.09),(1.07,2.12)]")
s=s.replace("(z-.73)/.35", "(z-.61)/.35")
s=s.replace("(side*.30,1.72,1.20),.13,.075", "(side*.26,1.86,1.31),.15,.085")
# Raised narrow face, preserving predatory downward mask rather than broadening eyes.
s=s.replace("angle=.24", "angle=.19")
s=s.replace("v.co.x*=.88;v.co.y=-.88+y*co-z*si;v.co.z=2.57+y*si+z*co", "v.co.x*=.98;v.co.y=-.71+y*co-z*si;v.co.z=2.66+y*si+z*co")
s=s.replace("pivots['head'].location=(0,-.88,2.57)","pivots['head'].location=(0,-.71,2.66)")
s=s.replace("y += .36*upper", "y += .19*upper")
s=s.replace("(2.61-z)/.39", "(2.72-z)/.46").replace("x*(1-.28*lower),y-.075*lower,z-.09*lower", "x*(1-.26*lower),y-.055*lower,z-.10*lower")
s=s.replace("p.z+=.22*rear;p.y-=.07*rear", "p.z+=.10*rear;p.y-=.02*rear")
# true facets everywhere, exactly as the successful character-pass export correction.
a=s.index('tri=0;boundary_edges=0;')
s=s[:a]+'''# Explicit triangles ensure GLB and native data share actual flat facet normals.
for o in objects:
 d=o.data;d.calc_loop_triangles()
 vs=[tuple(v.co) for v in d.vertices];fs=[tuple(t.vertices) for t in d.loop_triangles]
 mi=[d.polygons[t.polygon_index].material_index for t in d.loop_triangles]
 d.clear_geometry();d.from_pydata(vs,[],fs);d.update()
 for f,i in zip(d.polygons,mi):f.material_index=i
''' +s[a:]
(H/'build_mantis_complete.py').write_text(s)
