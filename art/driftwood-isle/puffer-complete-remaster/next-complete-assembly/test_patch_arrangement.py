import sys,json,numpy as np
from pathlib import Path
from geometry_tools import *
H=Path(__file__).resolve().parent;A=H.parents[1]
n=json.loads((A/'puffer-remaster-guided/seated-mouth-diagnostic-native.json').read_text());v,f=ordered_indexed(np.array(n['parts'][0]['positions']).reshape(-1,3,3));core=set(component_ids(f)[0]);old=f.copy();records=[];removed=set();new=[]
seeds={301,573,616,623};vertices=set(f[list(seeds)].flat);patch={i for i in core if vertices&set(f[i])}
patches=[('lower-left-sheet',patch,[1,2])]
for side in [-1,1]:
 ids={i for i in core if all(abs(v[j,2]-.675000011920929)<1e-9 and side*v[j,0]>0 for j in f[i])};patches.append(('orbital-back-wall-'+str(side),ids,[0,1]))
for name,ids,axes in patches:
 loops=patch_boundary(f,ids);assert len(loops)==1
 try:fs=earclip(v,loops[0],axes)
 except ValueError:
  if name!='lower-left-sheet':raise
  axes=[0,2];fs=earclip(v,loops[0],axes)
 removed|=ids;new.extend(fs);records.append({'name':name,'sourceFaces':sorted(ids),'boundary':loops[0],'projectionAxes':axes,'replacement':fs})
newf=np.array([x for i,x in enumerate(f)if i not in removed]+new);t=v[newf];c=component_ids(newf)[0];hits=audit(t[c]);cs=contacts(t[c]);print('core',len(c),'hits',hits,'contacts',cs);print(topology(t));(H/'repair-arrangement-diagnostic.json').write_text(json.dumps({'patches':records,'properCrossings':hits,'contacts':cs,'topology':topology(t)},indent=2)+'\n')
