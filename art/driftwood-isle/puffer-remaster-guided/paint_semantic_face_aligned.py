"""Surface-preserving flat semantic regions for the retained seated-mouth study."""
import argparse,copy,hashlib,json,math
from collections import Counter,defaultdict
from pathlib import Path
PALETTE={'teal':(.12,.39,.38),'ochre':(.91,.43,.075),'ivory':(1,.91,.70),'socket':(.39,.24,.09),'mouth':(.21,.058,.022)}
def linear(x):return x/12.92 if x<=.04045 else((x+.055)/1.055)**2.4
COLORS={k:tuple(linear(x)for x in v)for k,v in PALETTE.items()}
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def area(t):return math.sqrt(dot(cross(sub(t[1],t[0]),sub(t[2],t[0])),cross(sub(t[1],t[0]),sub(t[2],t[0]))))*.5
def clip(poly,plane,positive):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da,db=plane(a),plane(b);ia=da>=-1e-10 if positive else da<=1e-10;ib=db>=-1e-10 if positive else db<=1e-10
  if ia:out.append(a)
  if ia!=ib and abs(da-db)>1e-12:
   t=da/(da-db);out.append(tuple(x+(y-x)*t for x,y in zip(a,b)))
 clean=[]
 for p in out:
  if not clean or sum((a-b)**2 for a,b in zip(p,clean[-1]))>1e-18:clean.append(p)
 if len(clean)>1 and sum((a-b)**2 for a,b in zip(clean[0],clean[-1]))<1e-18:clean.pop()
 return clean
HOOD=[(.19,.8944),(.46,.958),(.435,1.020),(.205,.954)]
def inside(x,z):
 yes=False
 for a,b in zip(HOOD,HOOD[1:]+HOOD[:1]):
  if(a[1]>z)!=(b[1]>z)and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:yes=not yes
 return yes
def triangles(part):
 raw=part['positions'];return [tuple((raw[i+k],raw[i+k+2],raw[i+k+1])for k in(0,6,3))for i in range(0,len(raw),9)]
def components(tris):
 edges=defaultdict(list)
 for i,t in enumerate(tris):
  for a,b in zip(t,t[1:]+t[:1]):edges[tuple(sorted((a,b)))].append(i)
 links=defaultdict(set)
 for ids in edges.values():
  for i in ids:links[i].update(ids)
 todo=set(range(len(tris)));result=[]
 while todo:
  i=todo.pop();queue=[i];part={i}
  while queue:
   for j in links[queue.pop()]:
    if j in todo:todo.remove(j);part.add(j);queue.append(j)
  result.append(part)
 return sorted(result,key=len,reverse=True)
def topology(tris):
 edges=Counter();directions=Counter();volume=0
 for t in tris:
  if area(t)<1e-12:raise RuntimeError('Degenerate paint triangle')
  volume+=dot(t[0],cross(t[1],t[2]))/6
  for a,b in zip(t,t[1:]+t[:1]):edges[tuple(sorted((a,b)))]+=1;directions[(a,b)]+=1
 bad=sum(n!=2 for n in edges.values());orientation=sum(directions[(a,b)]!=directions[(b,a)]for a,b in edges)
 if bad or orientation:raise RuntimeError('Paint topology mismatch '+str((bad,orientation)))
 return volume

def paint(source):
 result=copy.deepcopy(source);body=source['parts'][0];tris=triangles(body);core=components(tris)[0];before=topology([tris[i]for i in core])
 global HOOD
 candidates={p for i in core for p in tris[i]if p[0]>0}
 HOOD=[(p[0],p[2])for x,z in HOOD for p in[min(candidates,key=lambda p:(p[0]-x)**2+(p[2]-z)**2)]]
 original=json.loads((Path(__file__).resolve().parents[3]/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json').read_text());oldkeys={tuple(sorted(t))for t in triangles(original['parts'][0])}
 n=len(tris);cavity=set(range(n-184+45,n-184+93))|set(range(n-48,n))
 planes=[lambda p:p[0],lambda p:p[1]-.45,lambda p:p[2]-.60]
 for sign in(-1,1):
  planes.extend([lambda p,s=sign:s*p[0]-.16,lambda p,s=sign:s*p[0]-.55,lambda p,s=sign:p[2]-.82+.20*s*p[0]-.05*p[1],lambda p,s=sign:p[2]-.96-.12*s*p[0]+.02*p[1]])
  for a,b in zip(HOOD,HOOD[1:]+HOOD[:1]):planes.append(lambda p,a=a,b=b,s=sign:(b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(s*p[0]-a[0]))
 canonical={tuple(round(x,8)for x in p):p for i in core for p in tris[i]}
 def canon(p):
  key=tuple(round(x,8)for x in p)
  if key not in canonical:canonical[key]=p
  return canonical[key]
 out={k:[]for k in ['positions','colorsLinear','skinIndices','skinWeights','furLen']};out['name']=body['name'];newtris=[];counts=Counter();relabels=Counter()
 def append_exact(fi):
  for key,size in [('positions',9),('colorsLinear',9),('skinIndices',12),('skinWeights',12),('furLen',3)]:out[key].extend(body[key][fi*size:(fi+1)*size])
 for fi,t in enumerate(tris):
  if fi not in core:append_exact(fi);continue
  pieces=[list(t)]
  for plane in planes:
   pieces=[q for p in pieces for q in(clip(p,plane,True),clip(p,plane,False))if len(q)>=3 and sum(area((q[0],q[j],q[j+1]))for j in range(1,len(q)-1))>1e-12]
  partition_area=sum(area((poly[0],poly[j],poly[j+1]))for poly in pieces for j in range(1,len(poly)-1))
  if abs(partition_area-area(t))>max(1e-10,area(t)*1e-6):raise RuntimeError('Paint partition altered triangle area')
  oldrgb=body['colorsLinear'][fi*9:fi*9+3];exact=tuple(sorted(t))in oldkeys
  for poly in pieces:
   c=tuple(sum(p[k]for p in poly)/len(poly)for k in range(3));x,y,z=c;key=None
   if fi in cavity:key='socket'
   elif y>.45 and abs(x)<.55:
    if inside(abs(x),z):key='ochre'
    elif z<.82-.20*abs(x)+.05*y:key='ivory'
    elif z<.96+.12*abs(x)-.02*y and z>.60:key='ochre'
    else:key='teal'
   elif not exact:key='ivory'if z<.80 and y>.1 else 'teal'
   rgb=COLORS[key]if key else tuple(oldrgb);counts[key or 'retained']+=1
   if key:relabels[key]+=1
   ps=[canon(p)for p in poly]
   for j in range(1,len(ps)-1):
    tri=(ps[0],ps[j],ps[j+1])
    if area(tri)<1e-12:continue
    newtris.append(tri)
    for p in(tri[0],tri[2],tri[1]):out['positions'].extend((p[0],p[2],p[1]));out['colorsLinear'].extend(rgb);out['skinIndices'].extend((1,0,0,0));out['skinWeights'].extend((1,0,0,0));out['furLen'].append(0)
 after=topology(newtris)
 if abs(after-before)>max(1e-7,abs(before)*1e-6):raise RuntimeError('Paint changed core volume')
 result['parts'][0]=out
 # Explicit new mouth ring semantics; original eyes/tongue/nostrils remain exact.
 head=result['parts'][1];total=len(head['positions'])//9
 for fi in range(total-64,total):
  local=fi-(total-64);key='mouth'if 16<=local<32 else 'ivory'
  head['colorsLinear'][fi*9:(fi+1)*9]=list(COLORS[key])*3
 result['status']='unaccepted flat semantic face palette study; geometry surface preserved, intended region relabeling'
 return result,{'status':'passed surface-preserving partition','coreVolumeBefore':before,'coreVolumeAfter':after,'oldCoreTriangles':len(core),'newCoreTriangles':len(newtris),'flatRegionPieces':dict(counts),'intentionalRelabeling':dict(relabels),'paletteSrgb':PALETTE,'actualHoodBoundaryXZ':HOOD,'perSourceTriangleAreaPreserved':True,'paletteValuesChanged':False,'oldPerCornerColorsPreservedWhereRelabeled':False,'untouchedPartsExact':result['parts'][2:]==source['parts'][2:],'bonesExact':result['bones']==source['bones'],'note':'All cavity faces receive explicit socket tag; no barycentric cross-region paint on new face. Original eight spike components copied exactly outside main core.'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();data=a.input.read_bytes()
 if hashlib.sha256(data).hexdigest()!='030dbb8c40bf2507429b6017ad4c8d36a15eb5f5ca839c630e14189c51c8424b':raise RuntimeError('Seated native pin changed')
 output,receipt=paint(json.loads(data));a.out.mkdir(parents=True,exist_ok=True);dest=a.out/'semantic-face-native.json';dest.write_text(json.dumps(output,separators=(',',':'))+'\n');receipt.update(inputSha256=hashlib.sha256(data).hexdigest(),outputSha256=hashlib.sha256(dest.read_bytes()).hexdigest());(a.out/'semantic-paint-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
