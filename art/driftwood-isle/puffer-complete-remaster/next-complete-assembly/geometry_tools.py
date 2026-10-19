"""Pinned read-only diagnostic functions, plus explicit indexed surface helpers."""
import ast,hashlib,json
from pathlib import Path
from collections import defaultdict,Counter
import numpy as np
H=Path(__file__).resolve().parent
# Extract only function definitions: predecessor validation has producer-specific
# top-level I/O which must never execute against new or selected sources.
for filename in ['intersections.py','validate.py']:
 p=H.parent/'local-surface-repair'/filename
 for node in ast.parse(p.read_text()).body:
  if isinstance(node,ast.FunctionDef):exec(compile(ast.Module(body=[node],type_ignores=[]),str(p),'exec'),globals())
def component_ids(f):
 uses=defaultdict(list)
 for i,t in enumerate(f):
  for a,b in zip(t,np.roll(t,-1)):uses[tuple(sorted((int(a),int(b))))].append(i)
 adj=defaultdict(set)
 for group in uses.values():
  for i in group:adj[i].update(group)
 todo=set(range(len(f)));out=[]
 while todo:
  group={todo.pop()};q=list(group)
  while q:
   for j in adj[q.pop()]:
    if j in todo:todo.remove(j);group.add(j);q.append(j)
  out.append(sorted(group))
 return sorted(out,key=len,reverse=True)
def ordered_indexed(t):
 lookup={};v=[];f=[]
 for tri in t:
  row=[]
  for p in tri:
   key=tuple(p)
   if key not in lookup:lookup[key]=len(v);v.append(p)
   row.append(lookup[key])
  f.append(row)
 return np.array(v),np.array(f)
def patch_boundary(f,ids):
 uses=Counter();direct={}
 for i in ids:
  for a,b in zip(f[i],np.roll(f[i],-1)):
   key=tuple(sorted((int(a),int(b))));uses[key]+=1;direct[key]=(int(a),int(b))
 edges=[direct[e] for e,c in uses.items() if c==1];nxt=dict(edges)
 if len(nxt)!=len(edges):raise ValueError('Branched patch boundary')
 loops=[]
 while nxt:
  start=next(iter(nxt));row=[start];p=nxt.pop(start)
  while p!=start:
   row.append(p);p=nxt.pop(p)
  loops.append(row)
 return loops
def earclip(v,loop,axes):
 """Constrained polygon triangulation retaining every boundary vertex exactly."""
 uv=v[:,axes];poly=list(loop);out=[]
 ar=sum(cross2(uv[a],uv[b]) for a,b in zip(poly,poly[1:]+poly[:1]));sgn=1 if ar>0 else -1
 def inside(p,a,b,c):return min(sgn*cross2(b-a,p-a),sgn*cross2(c-b,p-b),sgn*cross2(a-c,p-c))>=-1e-13
 while len(poly)>3:
  choices=[]
  for k,b in enumerate(poly):
   a,c=poly[k-1],poly[(k+1)%len(poly)]
   area=sgn*cross2(uv[b]-uv[a],uv[c]-uv[b])
   if area<=1e-13:continue
   if any(inside(uv[j],uv[a],uv[b],uv[c]) for j in poly if j not in (a,b,c)):continue
   choices.append((area/(np.linalg.norm(uv[a]-uv[c])**2+1e-20),k,[a,b,c]))
  if not choices:raise ValueError('Non-simple projection or degenerate polygon')
  _,k,tri=max(choices);out.append(tri);poly.pop(k)
 out.append(poly);return out
def triangulate_with_controls(v,loop,axes,points):
 fs=earclip(v,loop,axes);vertices=v.tolist();added=[]
 for point in points:
  p=np.array(point);q=p[axes];found=[]
  for k,face in enumerate(fs):
   uv=np.array(vertices)[face][:,axes];w=np.linalg.solve(np.vstack([uv.T,np.ones(3)]),np.r_[q,1.])
   if min(w)>1e-8:found.append(k)
  if len(found)!=1:raise ValueError('Authored control outside strict patch interior '+str(point))
  k=found[0];a,b,c=fs.pop(k);j=len(vertices);vertices.append(point);added.append(j);fs.extend([[a,b,j],[b,c,j],[c,a,j]])
 # Local diagonal flips improve broad-plane tessellation without changing the
 # explicit boundary or authored control coordinates. No vertex smoothing.
 vv=np.array(vertices);uv=vv[:,axes]
 for iteration in range(1000):
  uses=defaultdict(list)
  for i,t in enumerate(fs):
   for a,b in zip(t,t[1:]+t[:1]):uses[tuple(sorted((a,b)))].append((i,a,b))
  flipped=False
  for (a,b),rows in uses.items():
   if len(rows)!=2:continue
   (i,a,b),(j,_,_)=rows;c=next(k for k in fs[i]if k not in (a,b));d=next(k for k in fs[j]if k not in(a,b))
   # Valid convex alternative, and an angle sum strictly over pi.
   if cross2(uv[d]-uv[c],uv[a]-uv[c])*cross2(uv[d]-uv[c],uv[b]-uv[c])>=-1e-15:continue
   def angle(p,q,r):
    u=uv[p]-uv[q];w=uv[r]-uv[q];return np.arccos(np.clip(u@w/np.linalg.norm(u)/np.linalg.norm(w),-1,1))
   if angle(a,c,b)+angle(a,d,b)<=np.pi+1e-9:continue
   fs[i]=[c,d,b];fs[j]=[d,c,a];flipped=True;break
  if not flipped:break
 return vv,fs,added
