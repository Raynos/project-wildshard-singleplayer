"""Exact-coordinate connected-surface diagnostics; preserves failed preflight."""
import hashlib,json,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[2]/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import components,triangles,topology,area
paths={'pass2':HERE.parents[1]/'pass2/pass2-native.json','pass3':HERE/'pass3-native.json'}
report={'method':'Exact geometric edges; no weld tolerance, repair, or waiver','sources':{},'runtimeAdmission':False}
for label,path in paths.items():
 native=json.loads(path.read_text());results=[]
 for part in native['parts']:
  ts=triangles(part);cs=components(ts);groups=[]
  for c in cs:
   group={'triangles':len(c),'minArea':min(area(ts[i]) for i in c)}
   try:group.update(closedOriented=True,signedVolume=topology([ts[i] for i in c]))
   except RuntimeError as e:group.update(closedOriented=False,error=str(e),triangleIndices=sorted(c))
   groups.append(group)
  results.append({'name':part['name'],'components':groups})
 report['sources'][label]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'parts':results}
report['verdict']='FAIL: retained head-part exact-edge defects require diagnosis before runtime admission'
with (HERE/'topology-preflight-failure.json').open('x') as f:json.dump(report,f,indent=2);f.write('\n')
for label,entry in report['sources'].items():
 print(label,[(p['name'],[(c['triangles'],c.get('error')) for c in p['components'] if not c['closedOriented']]) for p in entry['parts'] if any(not c['closedOriented'] for c in p['components'])])
