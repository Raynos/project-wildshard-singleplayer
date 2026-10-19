"""Read-only world-space and event analysis; never edits recorder/product evidence."""
import json, pathlib, hashlib, statistics, numpy as np
base=pathlib.Path('tmp/puffer-full-lifecycle-attempt2')
r=json.loads((base/'report.json').read_text());rows=[]
for t in r['telemetry']:rows.extend(json.loads((base/t['file']).read_text()))
if not rows:raise RuntimeError('No rendered evidence')
s=r['renderer']['runtimeSkin'];v=np.array(s['positions']).reshape(-1,3);v=np.c_[v,np.ones(len(v))];bind=np.array(s['bindMatrix']).reshape(4,4).T;v=v@bind.T
ind=np.array(s['skinIndices']).reshape(-1,4);w=np.array(s['skinWeights']).reshape(-1,4);invs=[np.array(x).reshape(4,4).T for x in s['boneInverses']];contacts=[]
for f in rows:
 mats=np.array([np.array(b['world']).reshape(4,4).T@inv for b,inv in zip(f['enemy']['bones'],invs)])
 vv=np.zeros_like(v)
 for j in range(4):vv+=np.einsum('nij,nj->ni',mats[ind[:,j]],v)*w[:,j,None]
 contacts.append({'epoch':f['epoch'],'frame':f['frame'],'frameTime':f['frameTime'],'alive':f['enemy']['alive'],'phase':f['phase'],'minY':float(vv[:,1].min()),'floorGap':float(vv[:,1].min()-900),'belowFloorVertices':int((vv[:,1]<899.999).sum()),'ragdoll':f['enemy'].get('ragdoll')})
def save(n,o):
 if (base/n).exists():
  if json.loads((base/n).read_text())!=o:raise RuntimeError('Existing derivative differs')
  return
 with (base/n).open('x')as f:json.dump(o,f,indent=2);f.write('\n')
save('world-contact.json',contacts)
summary={'vertices':len(v),'rows':len(rows),'clockNormal':all(f['clock']['captureFps'] is None and f['clock']['scale']==1 and not f['clock']['paused'] for f in rows),'contact':{},'epochs':[]}
for epoch in dict.fromkeys(f['epoch'] for f in rows):
 a=[f for f in rows if f['epoch']==epoch];summary['epochs'].append({'epoch':epoch,'rows':len(a),'first':a[0]['frame'],'last':a[-1]['frame'],'missingFrameIds':sum(max(0,y['frame']-x['frame']-1)for x,y in zip(a,a[1:])),'medianRafMs':statistics.median(y['frameRafTime']-x['frameRafTime']for x,y in zip(a,a[1:])if x['frameRafTime']is not None and y['frameRafTime']is not None)})
for name,pred in [('alive',lambda x:x['alive']),('dead',lambda x:not x['alive']),('frozen',lambda x:(x['ragdoll']or{}).get('state')=='frozen')]:
 a=[x for x in contacts if pred(x)];summary['contact'][name]={'count':len(a),'minGap':min((x['floorGap']for x in a),default=None),'maxGap':max((x['floorGap']for x in a),default=None),'penetratingRows':sum(x['floorGap']<-.001 for x in a),'first':a[0]if a else None,'last':a[-1]if a else None}
summary['changes']=[]
for x,y in zip(rows,rows[1:]):
 if x['epoch']!=y['epoch']:continue
 for path in [('enemy','hp'),('loot','coins')]:
  if x[path[0]][path[1]]!=y[path[0]][path[1]]:summary['changes'].append([y['epoch'],y['frame'],y['frameTime'],'.'.join(path),x[path[0]][path[1]],y[path[0]][path[1]]])
 if x['player']['vitals']['health']!=y['player']['vitals']['health']:summary['changes'].append([y['epoch'],y['frame'],y['frameTime'],'player.hp',x['player']['vitals']['health'],y['player']['vitals']['health']])
summary['stationaryLivingStage0Rows']=sum(f['enemy']['alive']and f['enemy']['mem']['puffer-st']==0 and f['enemy']['speed']==0 for f in rows)
summary['overview']={}
a=[f for f in rows if f['phase']=='full-body-normal-camera']
if a:summary['overview']={'rows':len(a),'stages':sorted(set(f['enemy']['mem']['puffer-st']for f in a)),'strikePhases':sorted(set(f['enemy']['controller']['strike']['phase']for f in a)),'pitchRange':[min(f['player']['pitch']for f in a),max(f['player']['pitch']for f in a)],'distanceRange':[min(np.linalg.norm(np.array(f['enemy']['position'])[[0,2]]-np.array(f['player']['position'])[[0,2]])for f in a),max(np.linalg.norm(np.array(f['enemy']['position'])[[0,2]]-np.array(f['player']['position'])[[0,2]])for f in a)]}
def empty(s):
 w=s.get('world');return all(not s[k]for k in ['local','session','cookies','caches','workers','databases'])and(w is None or(w['generation']==0 and not w['shard']and all(not d.get('keys')for d in w['docs'].values())))
summary['persistentStoresEmpty']=all(empty(s)for s in [r['storageBefore'],r['storageAfter']]+[c['stores']for c in r['checkpoints']])
summary['movieTail']=r.get('movieTail');summary['checks']=r['checks'];summary['fullScalarPoseKeys']=list(rows[0]['enemy']['poseInputs'])
save('analysis.json',summary)
print(json.dumps(summary,indent=2))
