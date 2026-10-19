"""Light read-only facial patch feasibility against frozen V71 core."""
import json,math,hashlib
from pathlib import Path
from collections import Counter,defaultdict
ROOT=Path(__file__).resolve().parents[3]
p=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
if hashlib.sha256(p.read_bytes()).hexdigest()!='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338':raise RuntimeError('Guide changed')
part=json.loads(p.read_text())['parts'][0];points=[];lookup={};faces=[]
for i in range(0,len(part['positions']),9):
 f=[]
 for k in (0,6,3):
  x,y,z=part['positions'][i+k:i+k+3];q=(x,z,y)
  if q not in lookup:lookup[q]=len(points);points.append(q)
  f.append(lookup[q])
 faces.append(f)
inv=json.loads(Path(__file__).with_name('v71-facial-component-inventory.json').read_text());core=inv['parts'][0]['components'][0]['faceIds']
def normal(f):
 a,b,c=[points[i]for i in f];u=[b[k]-a[k]for k in range(3)];v=[c[k]-a[k]for k in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];l=math.sqrt(sum(x*x for x in n));return [x/l for x in n]
rows=[]
for sign in (-1,1):
 for rx,rz in ((.18,.15),(.20,.18),(.23,.21)):
  selected=[]
  for fi in core:
   f=faces[fi];c=[sum(points[i][k]for i in f)/3 for k in range(3)]
   if normal(f)[1]>.15 and c[1]>.20 and ((c[0]-sign*.34)/rx)**2+((c[2]-.91)/rz)**2<1:selected.append(fi)
  count=Counter(tuple(sorted((a,b)))for i in selected for a,b in zip(faces[i],faces[i][1:]+faces[i][:1]));boundary=[e for e,n in count.items()if n==1];degree=Counter(i for e in boundary for i in e)
  edges=set(boundary);loops=[]
  while edges:
   first=next(iter(edges));edges.remove(first);loop=list(first)
   while loop[-1]!=loop[0]:
    candidates=[e for e in edges if loop[-1]in e]
    if len(candidates)!=1:break
    e=candidates[0];edges.remove(e);loop.append(e[1]if e[0]==loop[-1]else e[0])
   loops.append(loop)
  rows.append({'sign':sign,'ellipse':[rx,rz],'faces':selected,'boundaryEdges':boundary,'branchVertices':[i for i,n in degree.items()if n!=2],'loops':loops,'loopBounds':[{'min':[min(points[i][k]for i in loop)for k in range(3)],'max':[max(points[i][k]for i in loop)for k in range(3)]}for loop in loops]})
out=Path(__file__).with_name('orbital-patch-feasibility.json');out.write_text(json.dumps({'status':'read-only candidate regions; no accepted mesh','regions':rows},indent=2)+'\n')
for r in rows:print(r['sign'],r['ellipse'],'faces',len(r['faces']),'loops',[len(x)for x in r['loops']],'branches',r['branchVertices'])
