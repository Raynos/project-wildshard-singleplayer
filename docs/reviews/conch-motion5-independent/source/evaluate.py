"""Independent scalar interpreter of exact frozen numeric pose, without SDK evaluator."""
import json, math, pathlib, hashlib
R=pathlib.Path(__file__).resolve().parents[4]; O=pathlib.Path(__file__).resolve().parent
M=R/'art/driftwood-isle/approved-conch/motion5-study'; clip=json.loads((M/'poses.json').read_text())
def evaluate(stage,clock,flinch=0,death=-1):
 frame={'scalars.stage':stage,'scalars.clock':clock,'scalars.guard':int(stage==1 and clock<.6),'frame.flinch':flinch,'frame.deathT':death,'frame.t':.4,'frame.speed':.8,'frame.phase':.21,'frame.dims.bodyY':1.04}; out={}
 for p in clip['programs']:
  vals=[]
  for n in p['nodes']:
   op=n['op']
   if op=='constant':v=n['value']
   elif op=='read':v=frame[p['reads'][n['index']]]
   elif op=='select':v=vals[n['yes']] if vals[n['test']] else vals[n['no']]
   elif op=='sin':v=math.sin(vals[n['a']])
   elif op=='sample':
    x=vals[n['a']];keys=n['keys'];v=keys[-1][1]
    if x<=keys[0][0]:v=keys[0][1]
    else:
     for (a,va),(b,vb) in zip(keys,keys[1:]):
      if x<=b:
       t=(x-a)/(b-a)
       if n['interpolation']=='smoothstep':t=t*t*(3-2*t)
       v=va+(vb-va)*t;break
   else:
    a=vals[n['a']];b=vals[n['b']]
    if op=='add':v=a+b
    elif op=='sub':v=a-b
    elif op=='mul':v=a*b
    elif op=='div':v=a/b
    elif op=='gt':v=float(a>b)
    elif op=='max':v=max(a,b)
    elif op=='min':v=min(a,b)
    else:raise ValueError(op)
   vals.append(v)
  target=p['numeric']['outputs'][0];out[target['target']+'.'+'.'.join(target['path'])]=vals[p['channels'][0]['value']]
 return out
maximum=(-1,None); count=0; lethal=(-1,None)
for stage,end in [(1,320),(3,290)]:
 for i in range(end+1):
  clock=i/200
  for before in [0,.25,.5,.75,1]:
   a=evaluate(stage,clock,before)
   for actual in [False,True]:
    after=1 if actual else before;b=evaluate(4 if stage==1 and clock<.6 else 2,0,after)
    deltas={k:abs(a[k]-b[k]) for k in a if '.rotation.' in k};key=max(deltas,key=deltas.get);jump=deltas[key];count+=1
    if jump>maximum[0]:maximum=(jump,dict(stage=stage,clock=clock,before=before,after=after,axis=key))
   b=evaluate(5,0,1,0);deltas={k:abs(a[k]-b[k]) for k in a if '.rotation.' in k};key=max(deltas,key=deltas.get)
   if deltas[key]>lethal[0]:lethal=(deltas[key],dict(stage=stage,clock=clock,before=before,axis=key))
proof=json.loads((R/'tmp/conch-motion5-offline/report.json').read_text())
assert count==proof['interruptionCases'];assert abs(maximum[0]-proof['maximumJump'])<1e-12
comparison=[]
for row in proof['denseInterruptions']:
 a=evaluate(row['stage'],row['clock'],row['before']);b=evaluate(4 if row['stage']==1 and row['clock']<.6 else 2,0,row['after']);actual=max(abs(a[k]-b[k]) for k in a if '.rotation.' in k);assert abs(actual-row['next'])<1e-12
 if row['next']>row['old']+1e-10:comparison.append(row)
inputs=sorted(set(r for p in clip['programs'] for r in p['reads']))
result={'scope':'Independent frozen-numeric evaluator, legal same/actual-hit source snapshots; no rendered/runtime continuity claim','cases':count,'maximumJump':maximum,'lethalOnsetMaximum':lethal,'inputs':inputs,'maximumNodes':max(len(p['nodes']) for p in clip['programs']),'sampledRegressionCount':len(comparison),'sampledRegressions':comparison[:12]}
(O/'independent-evaluation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
