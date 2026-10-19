"""Independent original-vertex support under actual captured collider world poses."""
import json,pathlib,sys,numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission');cap=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
n=json.loads((base/'visual/frame2-native/bellback-v6-native.json').read_text());trace=json.loads((cap/'fixed-trace.json').read_text());recipe=json.loads((base/'arena-candidate5/metadata.json').read_text())['bodies'][0]['dims']['rigidCorpse']
v={p['name']:np.array(p['positions']).reshape(-1,3)-np.array(next(b['pos'] for b in n['bones'] if b['name']==p['name'])) for p in n['parts']}
def pose(s):
 x,y,z,w=[s['rotation'][k] for k in ['x','y','z','w']];assert abs(x*x+y*y+z*z+w*w-1)<1e-5
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]),np.array([s['position'][k] for k in ['x','y','z']])
rows=[];maxgap=0
for r in trace:
 assert len(r['shapes'])==8;mins={}
 for i,s in enumerate(r['shapes']):
  name=recipe['parts'][i]['bone'];assert s['bone']==name and not s['sensor']
  rot,p=pose(s);original=(v[name]@rot.T+p)[:,1].min()-900;hull=(np.array(recipe['parts'][i]['points'])@rot.T+p)[:,1].min()-900
  maxgap=max(maxgap,abs(original-hull));mins[name]=float(original)
 rows.append({'frame':r['frame'],'time':r['gameTime'],'deathT':r['deathT'],'scenario':r['scenario'],'phase':r['phase'],'minimum':min(mins.values()),'parts':mins})
summary={}
for scenario in sorted(set(r['scenario'] for r in rows)):
 for phase in ['fixedPre','fixedPost']:
  rr=[r for r in rows if r['scenario']==scenario and r['phase']==phase]
  summary[scenario+'/'+phase]={'count':len(rr),'penetrating':sum(r['minimum']<-.005 for r in rr),'minimum':min(r['minimum'] for r in rr),'worst':min(rr,key=lambda r:r['minimum'])}
result={'method':'Original bind-local rigid vertices transformed by actual captured collider world poses; equality to original recipe hull support independently checked. fixedPre world getters can retain prior cached world poses after local updates and are NOT a new target-pose measurement; fixedPost is advanced post-solver geometry. Candidate5 wraps startRagdoll before lethal input and captures initial native cases plus each observed fixed step; initial shape record and terminal result state are retained in separate native-case files.','maximumOriginalVsHullSupportDifference':maxgap,'summary':summary,'rows':rows};out.write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in result.items() if k!='rows'},indent=2))
