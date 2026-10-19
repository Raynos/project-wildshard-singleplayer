"""Read-only analysis of immutable recording outputs; writes new summary once."""
import json,pathlib,hashlib,statistics,subprocess
out=pathlib.Path('tmp/puffer-closed-rig1-cycle-attempt2')
r=json.loads((out/'report.json').read_text())
frames=[]; epochs=[]
for filename in ['initial-frames.json','reload-frames.json','interrupted-frames.json']:
 p=out/filename
 if not p.exists():continue
 rows=json.loads(p.read_text());frames.extend(rows)
 gaps=[b['frame']-a['frame'] for a,b in zip(rows,rows[1:])]
 cadence=[(b['t']-a['t'])*1000 for a,b in zip(rows,rows[1:])]
 epochs.append({'file':filename,'rows':len(rows),'first':rows[0]['frame'] if rows else None,'last':rows[-1]['frame'] if rows else None,'frameGaps':sum(max(0,g-1)for g in gaps),'cadenceMs':{'median':statistics.median(cadence),'max':max(cadence)}if cadence else {}})
def empty(s):
 if not s:return False
 browser=all(not s[k]for k in ['local','session','cookies','caches','workers','databases'])
 w=s.get('world')
 return browser and (w is None or (w['generation']==0 and not w['shard'] and all(not d.get('keys')for d in w['docs'].values())))
stores=[r.get('storageBefore'),r.get('storageAfter'),r.get('reloadBeforeBoot',{}).get('stores')]+[p['stores']for p in r['checkpoints']]
phases={}
for f in frames:
 p=phases.setdefault(f['phase'],{'frames':0,'states':set(),'hp':set(),'playerHp':set(),'speedRange':[],'poseKeys':set()});p['frames']+=1
 e=f['enemy'];p['states'].add(e['mem'].get('puffer-st'));p['hp'].add(e['hp']);p['playerHp'].add(f['player']['vitals']['health']);p['speedRange'].append(e['speed']);p['poseKeys'].update((e.get('poseInputs')or{}).keys())
for p in phases.values():
 for k in ['states','hp','playerHp','poseKeys']:p[k]=sorted(p[k])
 p['speedRange']=[min(p['speedRange']),max(p['speedRange'])]
normal=bool(frames)and all(f['clock']['scale']==1 and f['clock']['captureFps'] is None and not f['clock']['paused']for f in frames)
checks={**r['checks'],'normalClockAllSamples':normal,'persistentStoresEmpty':all(empty(s)for s in stores),'fullPoseInputsPresent':bool(frames)and all(set(['dt','t','seed','scale','speed','strafe','phase','alive','deathT','flinch','brace','attack','lookWeight','yaw']).issubset((f['enemy'].get('poseInputs')or{}))for f in frames)}
cp={p['name']:p for p in r['checkpoints']}
if 'reload-damage'in cp and 'reload-visible-final-outcome'in cp:
 a,b=cp['reload-damage'],cp['reload-visible-final-outcome'];hold={'renderedSimulationSeconds':b['frameTime']-a['frameTime'],'wallSeconds':b['t']-a['t'],'renderedFrames':b['frame']-a['frame']};checks['reloadOutcomeVisibleTwoRenderedSeconds']=hold['renderedSimulationSeconds']>=2
else:hold=None;checks['reloadOutcomeVisibleTwoRenderedSeconds']=False
files={p.relative_to(out).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in out.rglob('*')if p.is_file()}
summary={'schema':'wildshard.puffer.closed-rig1-analysis.v1','checks':checks,'fatal':r.get('fatal'),'epochs':epochs,'phases':phases,'reloadOutcomeHold':hold,'rawBytes':sum(x['bytes']for x in files.values()),'files':files,'acceptance':{'visual':False,'animation':False,'physical':False,'gameplay':False},'caveat':'Checks are functional evidence only. Cloud cadence is not physical phone performance; independent complete-frame review remains required.'}
if r.get('video'):
 summary['movie']=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames:format=duration,size','-of','json',r['video']]))
p=out/'analysis.json';p.write_text(json.dumps(summary,indent=2)+'\n')if not p.exists()else (_ for _ in ()).throw(RuntimeError('Refusing overwrite'))
print(json.dumps({k:summary[k]for k in ['checks','fatal','epochs','reloadOutcomeHold','rawBytes']},indent=2))
