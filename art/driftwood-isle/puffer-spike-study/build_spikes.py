"""One independent V71 spike-hierarchy proposal. No Blender or runtime mutation.

The inherited primary wedge and hidden rear accent remain EXACT. Six subordinate
wedges use the same five-vertex topology and paint, with broader seated roots.
Native coordinates: x-right, y-up, z-forward. No new spikes are inferred.
"""
import copy
import hashlib
import json
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'approved-puffer/unaccepted-native-v71.json'
BASE_SHA='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
# index: (root width multiplier, tip distance multiplier).
PARAMETERS={0:(1.05,.88),2:(1.12,.78),3:(1.22,1.),4:(1.22,1.),5:(1.15,.94),6:(1.15,.94)}

def winding(points,triangles):
    result=[]
    for point in points:
        a,b,c=(triangles-point).transpose(1,0,2)
        la=np.linalg.norm(a,axis=1);lb=np.linalg.norm(b,axis=1);lc=np.linalg.norm(c,axis=1)
        numerator=np.einsum('ij,ij->i',a,np.cross(b,c))
        denominator=la*lb*lc+np.einsum('ij,ij->i',a,b)*lc+np.einsum('ij,ij->i',b,c)*la+np.einsum('ij,ij->i',c,a)*lb
        result.append(float(np.sum(2*np.arctan2(numerator,denominator))/(4*np.pi)))
    return result

def distance(point,triangles):
    a,b,c=triangles.transpose(1,0,2);ab=b-a;ac=c-a;ap=point-a
    n=np.cross(ab,ac);n2=np.einsum('ij,ij->i',n,n)
    t=np.einsum('ij,ij->i',ap,n)/n2;projected=point-t[:,None]*n
    v=projected-a;aa=np.einsum('ij,ij->i',ab,ab);bb=np.einsum('ij,ij->i',ab,ac);cc=np.einsum('ij,ij->i',ac,ac)
    va=np.einsum('ij,ij->i',v,ab);vc=np.einsum('ij,ij->i',v,ac);den=aa*cc-bb*bb
    u=(va*cc-vc*bb)/den;w=(vc*aa-va*bb)/den
    face=np.where((u>=0)&(w>=0)&(u+w<=1),t*t*n2,np.inf)
    ds=[face]
    for x,y in ((a,b),(b,c),(c,a)):
        edge=y-x;f=np.clip(np.einsum('ij,ij->i',point-x,edge)/np.einsum('ij,ij->i',edge,edge),0,1)
        delta=point-(x+f[:,None]*edge);ds.append(np.einsum('ij,ij->i',delta,delta))
    return float(np.sqrt(np.min(ds)))

def clearance(points,body):
    ws=winding(points,body)
    if any(min(abs(w),abs(abs(w)-1))>1e-4 for w in ws):raise ValueError('Ambiguous closed-hull winding')
    return [distance(p,body)*(-1 if abs(w)>.5 else 1)for p,w in zip(points,ws)]

def build():
    assert hashlib.sha256(BASE.read_bytes()).hexdigest()==BASE_SHA,'V71 source changed'
    base=json.loads(BASE.read_text());part=base['parts'][0];native=copy.deepcopy(base)
    native['status']='Unaccepted independent spike-hierarchy study on unchanged V71; not runtime tested'
    positions=np.array(part['positions']).reshape(-1,3)
    body=positions[:1022*3].reshape(-1,3,3)
    meshes=[]
    for index in range(8):
        start=(1426+index*6)*3;old=positions[start:start+18]
        verts=[];faces=[]
        for tri in old.reshape(-1,3,3):
            face=[]
            for p in tri:
                pt=p.tolist()
                if pt not in verts:verts.append(pt)
                face.append(verts.index(pt))
            faces.append(face)
        assert len(verts)==5
        verts=np.array(verts);tip=int(np.argmax(verts[:,1]));roots=[i for i in range(5)if i!=tip]
        center=verts[roots].mean(axis=0);original=verts.copy();burial=0.
        if index in PARAMETERS:
            width,length=PARAMETERS[index]
            verts[roots]=center+(verts[roots]-center)*width
            verts[tip]=center+(verts[tip]-center)*length
            direction=np.array([0.,.69,center[2]])-center;direction/=np.linalg.norm(direction)
            while max(clearance(verts[roots],body))>-.002:
                verts[roots]+=direction*.002;burial+=.002
                if burial>.16:raise ValueError('Root requires excessive burial')
        out=verts[np.array(faces)].reshape(-1).tolist()
        native['parts'][0]['positions'][start*3:(start+18)*3]=out
        meshes.append({'name':f'Cream crown spine {index}','sourceTriangleRange':[1426+index*6,1432+index*6],
          'role':'dominant left-biased crown, exact' if index==1 else 'hidden inherited accent, exact' if index==7 else 'supporting shoulder' if index in (3,4) else 'subordinate accent',
          'vertices':verts.tolist(),'triangles':faces,'rootVertexIndices':roots,'tipVertexIndex':tip,
          'originalVertices':original.tolist(),'rootWidthMultiplier':PARAMETERS.get(index,(1,1))[0],
          'tipDistanceMultiplier':PARAMETERS.get(index,(1,1))[1],'rootInwardTranslation':burial,
          'originalRootClearance':clearance(original[roots],body),'rootClearance':clearance(verts[roots],body),
          'baselineExact':bool(np.array_equal(original,verts))})
    indexed={'schema':'wildshard.editable-spikes.v1','status':native['status'],'coordinates':base['coordinates'],
       'baseSha256':BASE_SHA,'scope':'Only six inherited subordinate spikes; all other native arrays exact',
       'attachmentPolicy':'Separate closed wedge components, seated in actual V71 main hull; no Boolean union. Primary and hidden rear accent retained exactly, including any inherited exposed root corners.',
       'meshes':meshes}
    return indexed,native

if __name__=='__main__':
    mesh,native=build()
    (HERE/'spikes-indexed.json').write_text(json.dumps(mesh,indent=2)+'\n')
    (HERE/'spike-native-study.json').write_text(json.dumps(native,separators=(',',':'))+'\n')
    print('Wrote one indexed study and full native payload')
