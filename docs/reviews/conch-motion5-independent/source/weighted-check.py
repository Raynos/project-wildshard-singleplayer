"""Independent NumPy four-weight skinning of frozen source snapshot poses."""
import pathlib,json,zlib,hashlib,numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[4];OUT=pathlib.Path(__file__).resolve().parent
CAND=ROOT/'art/driftwood-isle/approved-conch/motion5-study'
CAN=ROOT/'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1'
f=CAND/'freeze-manifest.json';assert hashlib.sha256(f.read_bytes()).hexdigest()=='47025e87c28ceb164115df26348d3994153b3aaa32bc4ef0bbf59de2e87b0c44'
for name,h in json.loads(f.read_text())['files'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==h,name
meta=json.loads((CAN/'metadata.json').read_text());data=zlib.decompress((CAN/'payload.bin').read_bytes());body=meta['bodies'][0];defs=body['bones'];idx={d['name']:i for i,d in enumerate(defs)}
parts=[]
for part in body['hard']:
 attrs={name:np.frombuffer(data,dtype={'f32':'<f4','u16':'<u2'}[typ],count=part['row']['count']*size,offset=offset).reshape(-1,size) for (name,typ,size,_),offset in zip(part['row']['attrs'],part['offsets'])}
 parts.append(attrs)
inverse=np.repeat(np.eye(4)[None],len(defs),axis=0)
for i,d in enumerate(defs):inverse[i,:3,3]=-np.array(d['pos'])
def matrix(row):
 px,py,pz,x,y,z,w=row;m=np.eye(4)
 m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)], [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)], [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=[px,py,pz];return m
proof=json.loads((ROOT/'tmp/conch-motion5-offline/report.json').read_text());out=[];tip=int(np.argmax(parts[8]['position'][:,2]))
for row in proof['keyPoses']:
 world=[]
 for d in defs:
  local=matrix(row['bones'][d['name']]);world.append(local if d['parent'] is None else world[idx[d['parent']]]@local)
 skin=np.stack(world)@inverse;transformed=[]
 for p in parts:
  verts=np.concatenate([p['position'],np.ones((len(p['position']),1))],axis=1)
  weighted=np.einsum('nkij,nj,nk->ni',skin[p['skinIndex']],verts,p['skinWeight'])[:,:3];transformed.append(weighted)
 minimum=min(float(p[:,1].min()) for p in transformed);assert minimum>=0 and minimum<.02
 result={'stage':row['stage'],'clock':row['clock'],'floorMinimum':minimum,'tip':transformed[8][tip].tolist()}
 if row['stage'] in [1,3]:
  reported=next(p for p in proof['tips'][str(row['stage'])] if abs(p[0]-row['clock'])<1e-9)
  result['tipMaxError']=float(np.max(np.abs(transformed[8][tip]-reported[1:])));assert result['tipMaxError']<1e-10
 out.append(result)
result={'schema':'conch.motion5.independent-weighted-snapshots.v1','vertices':sum(len(p['position']) for p in parts),'poseCount':len(out),'minimumFloor':min(r['floorMinimum'] for r in out),'maximumFloor':max(r['floorMinimum'] for r in out),'maxTipError':max(r.get('tipMaxError',0) for r in out),'poses':out,'scope':'Saved producer source bone snapshots independently skinned with original packed vertices/all four weights; not runtime world poses or independent curve evaluation.'}
(OUT/'weighted-snapshots.json').write_text(json.dumps(result,indent=2)+'\n');print({k:v for k,v in result.items() if k!='poses'})
