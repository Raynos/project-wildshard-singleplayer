from pathlib import Path
exec(Path('art/driftwood-isle/approved-puffer/audit_v57_gait5_continuity.py').read_text().split("worst={'y':1e9}")[0])
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--telemetry',required=True);args=parser.parse_args();source=Path(args.telemetry);rows=json.loads(source.read_text())['capture']['samples'];history=None;blend=None;records=[];maxlift=0.;worst=1e9
for row in rows:
 if not row['bones']:continue
 bs={b['name']:b for b in row['bones']};t=row['t'];dt=0 if history is None else t-history['t'];stage=row['stage'];moving=abs(row['speed'])>.001
 raw={'bodyY':bs['body']['p'][1],'bodyR':np.array(bs['body']['r']),'feet':{name:(np.array(bs[name]['p'])-(bones[name]-B),np.array(bs[name]['r']))for name,_,_,_ in feet}}
 shown={**raw,'feet':{n:(p.copy(),r.copy())for n,(p,r)in raw['feet'].items()}}
 if history is None or not row['alive'] or dt>.25 or dt<0:blend=None
 else:
  stop=history['moving']and not moving;enter=history['stage']!=1 and stage==1;resume=not history['moving']and moving and stage==0
  if stop or enter or resume:blend={'from':history['shown'],'elapsed':0,'duration':.12 if resume else .22}
  elif blend is not None and dt>0:blend['elapsed']+=dt
  if blend is not None:
   u=min(1,blend['elapsed']/blend['duration']);a=u*u*(3-2*u);old=blend['from'];angle=abs(old['bodyR']-raw['bodyR']).sum();up=max(.8,abs(math.cos(raw['bodyR'][0])*math.cos(raw['bodyR'][2])))
   for name,(p,r)in raw['feet'].items():
    op,orr=old['feet'][name];np_=op*(1-a)+p*a;nr=orr+(r-orr)*a;np_[1]+=(1-a)*(old['bodyY']-raw['bodyY']+2*(angle+a*abs(orr-r).sum()))/up;shown['feet'][name]=(np_,nr)
   if u>=1:blend=None
 bodymatrix=np.array(bs['body']['world']).reshape(4,4).T;bellymatrix=np.array(bs['belly']['world']).reshape(4,4).T;floor=1e9;lift=0.;delta=0.
 for name,v,fw,area in feet:
  p,r=shown['feet'][name];relative=(v-bones[name])@rot(r).T+(bones[name]-B)+p
  distal=relative@bodymatrix[:3,:3].T+bodymatrix[:3,3];belly=(v-B)@bellymatrix[:3,:3].T+bellymatrix[:3,3];w=distal*fw[:,None]+belly*(1-fw[:,None]);floor=min(floor,float(w[:,1].min()-row['position'][1]));lift=max(lift,float(p[1]-raw['feet'][name][0][1]))
  if history is not None:delta=max(delta,float(np.linalg.norm(p-history['shown']['feet'][name][0])))
 records.append({'t':t,'floorAboveActorY':floor,'addedY':lift,'maxFootLocalDelta':delta,'stage':stage,'speed':row['speed']});maxlift=max(maxlift,lift);worst=min(worst,floor);history={'shown':shown,'moving':moving,'stage':stage,'t':t}
receipt={'status':'sampled telemetry replay, not full-cadence wrapper recording','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'samples':len(records),'maximumAddedY':maxlift,'minimumFloorAboveActorY':worst,'stopWindow':[r for r in records if 19.9<r['t']<20.5],'resumeWindow':[r for r in records if 33.7<r['t']<34.1]}
Path('tmp/puffer-v57-gait5-stop-replay.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items()if k not in ('stopWindow','resumeWindow')},indent=2));print('stop max',max(r['addedY']for r in receipt['stopWindow']),'resume max',max(r['addedY']for r in receipt['resumeWindow']))
