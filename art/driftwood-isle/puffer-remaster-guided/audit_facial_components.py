"""Read-only native component inventory for explicit facial replacement scope."""
import hashlib,json
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
p=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
expected='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Guide pin changed')
r={'sourceSha256':expected,'coordinates':'Blender x,y,z after shared stance','parts':[]}
for part in json.loads(p.read_text())['parts']:
    if part['name'] not in ('Continuous mantle cheek and pouch','Dark recessed palate'):continue
    lookup={};points=[];faces=[]
    for i in range(0,len(part['positions']),9):
        face=[]
        for k in (0,6,3):
            x,y,z=part['positions'][i+k:i+k+3];point=(x,z,y)
            if point not in lookup:lookup[point]=len(points);points.append(point)
            face.append(lookup[point])
        faces.append(face)
    edges=defaultdict(list)
    for i,f in enumerate(faces):
        for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))].append(i)
    adjacent=defaultdict(set)
    for fs in edges.values():
        for i in fs:adjacent[i].update(fs)
    todo=set(range(len(faces)));components=[]
    while todo:
        first=todo.pop();queue=[first];members={first}
        while queue:
            for nxt in adjacent[queue.pop()]:
                if nxt in todo:todo.remove(nxt);members.add(nxt);queue.append(nxt)
        ids=sorted({j for i in members for j in faces[i]});ps=[points[i]for i in ids]
        components.append({'faceIds':sorted(members),'vertexIds':ids,'triangleCount':len(members),'boundsMin':[min(p[k]for p in ps)for k in range(3)],'boundsMax':[max(p[k]for p in ps)for k in range(3)]})
    r['parts'].append({'name':part['name'],'components':sorted(components,key=lambda c:-c['triangleCount'])})
out=Path(__file__).with_name('v71-facial-component-inventory.json');out.write_text(json.dumps(r,indent=2)+'\n')
for p in r['parts']:
 print(p['name'])
 for c in p['components']:print(c['triangleCount'],c['boundsMin'],c['boundsMax'])
