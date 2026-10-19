"""Fit existing living torso capsule and head sphere to named core mesh parts.
No tail, legs, throat petals, new shapes, body offsets or root lift. Millimeter
round-up is deterministic numeric quantization of measured core radius.
Preserves initial metadata separately. Run after build_iguana_v3.py.
"""
import json,math,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1]);d=json.loads((p/'native-source.json').read_text());m=json.loads((p/'metadata.json').read_text());old=p/'rejected-core-fit.metadata.json'
if not old.exists():old.write_text(json.dumps(m,indent=2)+'\n')
dims=m['bodies'][0]['dims'];binds={b['name']:b['pos'] for b in d['bones']};radii={}
for name in ['body','head']:
 part=next(q for q in d['parts'] if q['name']==name);c=binds[name];vals=[]
 for i in range(0,len(part['positions']),3):
  x,y,z=[part['positions'][i+j]-c[j] for j in range(3)]
  if name=='body':z=max(0,abs(z)-dims['bodyHalfLen'])
  vals.append(math.sqrt(x*x+y*y+z*z))
 radius=math.ceil(max(vals)*1000)/1000;radii[name]={'measuredMaximum':max(vals),'radius':radius,'vertices':len(vals)};dims['bodyRadius' if name=='body' else 'headRadius']=radius
(p/'metadata.json').write_text(json.dumps(m,indent=2)+'\n')
(p/'core-fit.json').write_text(json.dumps({'proof':'existing body capsule/head sphere fit to core parts only; no new volumes or root lift','parts':radii,'bodyCapsuleBottom':dims['bodyY']-dims['bodyRadius'],'rootLift':0,'excluded':['legs','tail','throat bloom'],'physicalDeathTested':False,'runtimeAcceptance':False,'nativeSha256':hashlib.sha256((p/'native-source.json').read_bytes()).hexdigest()},indent=2)+'\n')
