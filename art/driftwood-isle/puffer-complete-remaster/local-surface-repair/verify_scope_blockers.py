"""Verify newly detected blockers against untouched selected source, without imports that run producers."""
import ast,json
from pathlib import Path
from collections import defaultdict,Counter
import numpy as np
from intersections import bary
H=Path(__file__).resolve().parent
module=ast.parse((H/'validate.py').read_text());ns=dict(np=np,defaultdict=defaultdict,Counter=Counter,bary=bary)
for node in module.body:
 if isinstance(node,ast.FunctionDef):exec(compile(ast.Module(body=[node],type_ignores=[]),'<validator functions>','exec'),ns)
b=json.loads((H.parent/'closed-anatomy-study/closed-anatomy-native.json').read_text());n=json.loads((H/'local-repair-native.json').read_text())
result={}
for label,model in [('selected',b),('candidate',n)]:
 hull=np.array(model['parts'][0]['positions'][:9198]).reshape(-1,3,3)
 cs=ns['contacts'](hull)
 palate=np.array(model['parts'][1]['positions']).reshape(-1,3,3);v,f=ns['indexed'](palate);links=defaultdict(list)
 for i,face in enumerate(f):
  for k,x in enumerate(face):links[int(x)].append((i,tuple(face[[(k+1)%3,(k+2)%3]])))
 bad=[]
 for vertex,es in links.items():
  adj=defaultdict(set)
  for _,(x,y)in es:adj[x].add(y);adj[y].add(x)
  todo=set(adj);groups=[]
  while todo:
   group={todo.pop()};q=list(group)
   while q:
    for j in adj[q.pop()]:
     if j in todo:todo.remove(j);group.add(j);q.append(j)
   groups.append(sorted(int(x)for x in group))
  if len(groups)!=1 or any(len(x)!=2 for x in adj.values()):bad.append({'vertex':vertex,'position':v[vertex].tolist(),'faceIds':[i for i,_ in es],'linkComponentCount':len(groups),'linkVertexDegrees':{int(k):len(s)for k,s in adj.items()}})
 result[label]={'hullContacts':cs,'palateVertexLinkFailures':bad,'palateTopology':ns['topology'](palate)}
result['outsideOverlapFacesExact']=all(b['parts'][0]['positions'][i*9:(i+1)*9]==n['parts'][0]['positions'][i*9:(i+1)*9]for i in range(1009,1014))
result['palateExact']=b['parts'][1]==n['parts'][1]
(H/'scope-blockers.json').write_text(json.dumps(result,indent=2)+'\n')
print('selected contacts',{k:len(v)for k,v in result['selected']['hullContacts'].items()});print('palate failures',result['selected']['palateVertexLinkFailures']);print('palate components',result['selected']['palateTopology']['components'])
