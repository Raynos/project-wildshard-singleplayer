import json,hashlib,collections,pathlib
p=pathlib.Path('tmp/bellback-anatomy3-full-combat'); t=json.loads((p/'render-trace.json').read_text());r=json.loads((p/'report.json').read_text())
runs=[]
for x in t:
 key=[x['scenario'],x['stage'],x['strike']['currentId'],x['strike']['phase'],x['alive']]
 if not runs or runs[-1]['key']!=key:runs.append({'key':key,'firstFrame':x['frame'],'firstGameTime':x['gameTime'],'firstWallTime':x['wallTime'],'count':0})
 runs[-1].update(lastFrame=x['frame'],lastGameTime=x['gameTime'],lastWallTime=x['wallTime']);runs[-1]['count']+=1
summary={'schema':'wildshard.bellback.full-combat-analysis.v1','checks':r['checks'],'observations':len(t),'scenarios':dict(collections.Counter(x['scenario'] for x in t)), 'runs':runs,'enemyAtPlayerDefeat':r.get('playerDefeat',{}).get('enemy'),'nativeObserver':'Eight-bone world-transform trace; exact existing product/host; diagnostic player placement logged; full-body camera offset only during render. No simulation time/health/AI edits.'}
summary['playerDeathWronglyReachedLivingEnemy']=r.get('playerDefeat',{}).get('enemy',{}).get('alive') is True and r.get('playerDefeat',{}).get('enemy',{}).get('mem',{}).get('tg-state')==6
(p/'analysis.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['runs','enemyAtPlayerDefeat']},indent=2))
