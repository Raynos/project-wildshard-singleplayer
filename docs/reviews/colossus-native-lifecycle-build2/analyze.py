"""Read-only lifecycle/cadence summary of the actual instrumented browser trace."""
import json, statistics
from pathlib import Path
p=Path('tmp/colossus-native-observer-build2')
r=json.loads((p/'report.json').read_text()); t=json.loads((p/'render-trace.json').read_text()); e=json.loads((p/'combat-events.json').read_text())
g=json.loads((p/'world-contact.json').read_text())
groups={i:[x for x in t if x['actorInstance']==i] for i in sorted({x['actorInstance'] for x in t})}
actors=[]; cycles=[]
for i,rows in groups.items():
    events=[v for v in e if v['actorInstance']==i]; deaths=[v for v in events if v['event']=='actor.died']
    dead=[x for x in rows if not x['alive']]
    actors.append({'instance':i,'actorIds':sorted({x['actorId'] for x in rows}),'meshUuids':sorted({x['meshUuid'] for x in rows}), 'frames':len(rows),'first':{k:rows[0][k] for k in ('gameTime','hp','stage','alive')},'last':{k:rows[-1][k] for k in ('gameTime','hp','stage','alive')},'deaths':deaths, 'deadStates':sorted({x['stage'] for x in dead}), 'deadStrikePhases':sorted({x['strike']['phase'] for x in dead})})
    active=None
    for x in rows:
        phase=x['strike']['phase']; ident=x['strike']['currentId']
        if phase=='windup' and (active is None or active['id']!=ident):
            active={'actorInstance':i,'id':ident,'startGame':x['gameTime'],'startWall':x['wallTime'],'phases':[]}
        if active is not None:
            if phase not in active['phases']: active['phases'].append(phase)
            if phase=='idle':
                active.update(endGame=x['gameTime'],endWall=x['wallTime'],gameSeconds=x['gameTime']-active['startGame'],wallSeconds=(x['wallTime']-active['startWall'])/1000,complete=all(v in active['phases'] for v in ('windup','active','recover','idle')))
                cycles.append(active);active=None
intervals=[b['wallTime']-a['wallTime'] for a,b in zip(t,t[1:]) if a['actorInstance']==b['actorInstance']]
sortedIntervals=sorted(intervals)
checks={
 'ownDeathReachesState6':any(a['last']['stage']==6 and a['last']['alive'] is False for a in actors),
 'noLivingDeathState6':all(x['stage']!=6 for x in t if x['alive']),
 'noDeadStrike':all(x['strike']['phase']=='idle' for x in t if not x['alive']),
 'retryFreshMesh':len({a['meshUuids'][0] for a in actors})==len(actors) and len(actors)>=4,
 'retryFreshState':all(a['first']['hp']==480 and a['first']['alive'] and a['first']['stage']!=6 for a in actors),
 'observedEnemyAndPlayerDeath':any(x['event']=='actor.died' and x['target']['isCurrentEnemy'] for x in e) and any(x['event']=='actor.died' and x['target']['isCurrentPlayer'] for x in e),
 'survivingEnemyAfterPlayerDeath':all(not any(x['stage']==6 for x in groups[a['instance']]) for a in actors if any(v['target']['isCurrentPlayer'] for v in a['deaths']))
}
deadRows=[x for x in t if not x['alive']]; firstDeathState=next(x for x in deadRows if x['stage']==6)
deathDrain={'firstDeadFrame':deadRows[0]['frame'],'firstState6Frame':firstDeathState['frame'],'gameSecondsToState6':firstDeathState['gameTime']-deadRows[0]['gameTime'],'wallMsToState6':firstDeathState['wallTime']-deadRows[0]['wallTime'],'allSubsequentDeadRowsState6':all(x['stage']==6 for x in deadRows if x['frame']>=firstDeathState['frame'])}
summary={'deathDrain':deathDrain,'checks':checks,'combatChecks':r['checks'],'actors':actors,'geometry':g['summary'],'cadence':{'frames':len(t),'medianIntervalMs':statistics.median(intervals),'p95IntervalMs':sortedIntervals[int(.95*(len(sortedIntervals)-1))],'maxIntervalMs':max(intervals),'aggregateFps':1000*len(intervals)/sum(intervals),'wallSeconds':(t[-1]['wallTime']-t[0]['wallTime'])/1000,'gameSeconds':t[-1]['gameTime']-t[0]['gameTime'],'caveat':'Cloud SwiftShader actual render cadence, not a physical-phone performance claim.'},'cycles':cycles,'events':e}
(p/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ('checks','combatChecks','actors','geometry','cadence')},indent=2))
