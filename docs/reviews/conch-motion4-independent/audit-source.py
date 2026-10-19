"""Independent source-freeze and supplied trace audit; no runtime or visual claim."""
import hashlib,json,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parent
CAND=ROOT/'art/driftwood-isle/approved-conch/runtime-admission/arena-motion4'
EXPECTED='3e4b3f77dd7597ac0d9ae40d3377b00c149a7cdca708ca3ad71ab8f5262eebd3'
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert hashfile(CAND/'freeze-manifest.json')==EXPECTED
freeze=json.loads((CAND/'freeze-manifest.json').read_text())
for name,expected in freeze['files'].items():
 assert hashfile(ROOT/name)==expected,name
source=json.loads((CAND/'source-check.json').read_text())
active=[]
for stage,windup in [('1',.6),('3',.45)]:
 rows=[p for p in source['tips'][stage] if windup-1e-9<=p[0]<=windup+.1+1e-9]
 active.append({'stage':int(stage),'windup':windup,'sampleCountIncludingEndpoints':len(rows),
 'outsideAuthoredLaneHalfWidth':[p for p in rows if abs(p[1])>.325],
 'outsideEffectiveTargetCenterHalfWidth':[p for p in rows if abs(p[1])>.725],
 'insideAuthoredLaneHalfWidth':[p for p in rows if abs(p[1])<=.325],
 'maxForward':max(rows,key=lambda p:p[3]),
 'note':'Canonical local tip samples from producer, independently classified. Target overlap includes +0.4m tolerance, not weapon collision.'})
poses={'shell.x':[-.035,-.06,.025,-.02,-.20], 'shell.y':[-.05,.09,-.025,.03,.10],
'head.x':[-.08,-.12,.05,-.045,-.24], 'head.z':[-.04,.09,-.015,.025,.12],
'shieldArm.x':[-.48,-.24,-.18,-.32,-.12], 'shieldArm.z':[-.18,.24,.16,-.08,-.12],
'shieldForearm.y':[-.38,.16,.12,-.20,-.08], 'rapierArm.x':[-.34,-.55,-.48,-.24,-.32],
'rapierArm.z':[.10,.38,-.08,.13,.12], 'rapierForearm.y':[.32,.48,-.80,.22,.22],
'rapierArm.y':[.04,.08,-.40,.03,.04]}
# Independent direct evaluation of authored smoothstep, not the SDK evaluator.
def curve(t,w,p,counter=False):
 prep=p[1 if counter else 0]
 keys=[(0,0),(w*.65,prep),(w,prep),(w+.035,p[2]),(w+.1,p[2]*.9),(w+.3,p[3]),(w+.68,p[3]*.35),(w+1,0)]
 for (a,v),(b,z) in zip(keys,keys[1:]):
  if t<=b:
   q=max(0,min(1,(t-a)/(b-a)));return v+(z-v)*q*q*(3-2*q)
 return 0
interrupts=[]
for stage,w,clock,flinch in [(1,.6,.4,0),(1,.6,.4,1),(3,.45,.485,0),(3,.45,.8,.5)]:
 before={k:curve(clock,w,p,stage==3)*(1-.65*flinch)+p[4]*flinch for k,p in poses.items()}
 after={k:p[4]*flinch for k,p in poses.items()}
 delta={k:after[k]-before[k] for k in poses}
 interrupts.append({'fromStage':stage,'clock':clock,'toStage':4 if stage==1 else 2,'constantFlinch':flinch,
 'perAxisEulerJumpRadians':delta,'largestAxisJumpRadians':max(abs(x) for x in delta.values()),
 'note':'Counterexample at equal flinch; actual event flinch may also change. Local channel discontinuity, not measured screen displacement.'})
for stage,w in [(1,.6),(3,.45)]:
 for p in poses.values():
  assert curve(0,w,p,stage==3)==0 and abs(curve(w+1,w,p,stage==3))<1e-12
report={'schema':'conch.motion4.independent-source-audit.v1','freezeSha256':EXPECTED,
'verifiedFiles':len(freeze['files']),'activeWindowTipClassification':active,'interruptionCounterexamples':interrupts,
'sourceOnly':True,'visualAcceptance':False,'runtimeAcceptance':False}
(OUT/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'verifiedFiles':len(freeze['files']),'activeOutsideNominal':[len(x['outsideAuthoredLaneHalfWidth']) for x in active],
'activeOutsideEffective':[len(x['outsideEffectiveTargetCenterHalfWidth']) for x in active],
'interruptMaxRadians':[r['largestAxisJumpRadians'] for r in interrupts]},indent=2))
