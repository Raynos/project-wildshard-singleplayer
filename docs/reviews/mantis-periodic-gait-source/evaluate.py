"""Dense source-only checks of the single fit; failures are retained, not tuned away."""
import json
import numpy as np
from fit import OUT,N,BONES,basis,posed,target,geometry,rotation,DISTANCE,STANCE

def run():
 fit=json.loads((OUT/'fit.json').read_text());results={};count=512;p=np.arange(count)/count
 for name,f in fit['fits'].items():
  co=np.array(f['coefficients']);q=basis(p)@co;v,ids,hip,knee,side=geometry(name);vv=posed(q,name);cc=vv[:,ids].mean(1);desired,bob=target(p,name)
  actual=np.stack([cc[:,0],vv[:,:,1].min(1),cc[:,2]],-1);err=np.linalg.norm(actual-desired,axis=1);stance=p<STANCE
  # Physical normalized cycle frequency is speed / unchanged distance per authored cycle.
  dt=1/60;dp=1.15/DISTANCE*dt;r,k=rotation(q,side);rr,kk=rotation(basis(p+dp)@co,side)
  relative=np.swapaxes(r,-1,-2)@rr;relativeK=np.swapaxes(k,-1,-2)@kk
  angle=lambda mat:np.arccos(np.clip((np.trace(mat,axis1=-2,axis2=-1)-1)/2,-1,1))
  # Coherent straight stalk: fixed actor X, actor Z advances DISTANCE each cycle.
  world=cc.copy();world[:,2]+=p*DISTANCE;velocity=np.linalg.norm(np.diff(world,axis=0)[:,[0,2]],axis=1)*count*1.15/DISTANCE
  interior=(p[:-1]>.03)&(p[1:]<STANCE-.03)
  results[name]={'angleMin':q.min(0).tolist(),'angleMax':q.max(0).tolist(),'stanceErrorMax':float(err[stance].max()),'swingErrorMax':float(err[~stance].max()),'angleSeam':float(np.max(np.abs((basis([1])-basis([0]))@co))),'derivativeSeam':float(np.max(np.abs((basis([1],1)-basis([0],1))@co))),'maxHipQuaternionStep60Hz':float(angle(relative).max()),'maxKneeQuaternionStep60Hz':float(angle(relativeK).max()),'stanceMinWithBreath':float((actual[:,1]+bob)[stance].min()-.008),'stanceMaxWithBreath':float((actual[:,1]+bob)[stance].max()+.008),'swingPeakClearanceWithoutBreath':float((actual[:,1]+bob)[~stance].max()),'interiorStanceFootRootRatio':float(velocity[interior].mean()/1.15),'interiorStanceMedianFootSpeed':float(np.median(velocity[interior]))}
 # Native full skinning, every vertex and influence, with unchanged living idle/bob.
 worst={'minimum':1e9};negative=0;poses=0;alphaValues=np.unique(np.r_[np.linspace(0,1,21),.05,.15,.3,.7]);phase=np.arange(512)/512
 for alpha in alphaValues:
  for breath in [-.008,.008]:
   matrices={};idle=breath/.008
   for bone in N['bones']:
    name=bone['name'];local=np.broadcast_to(np.eye(4),(len(phase),4,4)).copy();local[:,:3,3]=np.array(bone['pos'])-(BONES[bone['parent']]['pos'] if bone['parent'] else np.zeros(3))
    if name=='body':local[:,1,3]+=breath+.02*alpha*np.abs(np.sin(2*np.pi*phase))
    if name.startswith('leg'):
     kn=name if name.endswith('_knee') else name+'_knee';offset=0 if kn in ['leg-1_0_knee','leg1_1_knee'] else .5
     q=basis(2*phase+offset)@np.array(fit['fits'][kn]['coefficients'])*alpha
     r,k=rotation(q,-1 if name.startswith('leg-') else 1);local[:,:3,:3]=k if name.endswith('_knee') else r
    elif name in ['neck','head','abdomen']:
     a={'neck':.015,'head':-.02,'abdomen':.018}[name]*idle;local[:,1,1]=local[:,2,2]=np.cos(a);local[:,1,2]=-np.sin(a);local[:,2,1]=np.sin(a)
    elif name.startswith('wing'):
     a=(-1 if name.startswith('wing-') else 1)*.025*idle;local[:,0,0]=local[:,1,1]=np.cos(a);local[:,0,1]=-np.sin(a);local[:,1,0]=np.sin(a)
    matrices[name]=matrices[bone['parent']]@local if bone['parent'] else local
   minimum=np.full(len(phase),np.inf);partnames=np.full(len(phase),'',dtype=object)
   for part in N['parts']:
    v=np.array(part['positions']).reshape(-1,3);ix=np.array(part['skinIndices']).reshape(-1,4);ww=np.array(part['skinWeights']).reshape(-1,4);deformed=np.zeros((len(phase),len(v)))
    for j in np.unique(ix):
     bone=N['bones'][int(j)];h=np.column_stack((v-np.array(bone['pos']),np.ones(len(v))));deformed+=np.einsum('pi,vi->pv',matrices[bone['name']][:,1,:],h)*(ww*(ix==j)).sum(1)[None]
    value=deformed.min(1);replace=value<minimum;minimum=np.minimum(minimum,value);partnames[replace]=part['name']
   poses+=len(phase);negative+=int((minimum< -1e-6).sum());i=minimum.argmin()
   if minimum[i]<worst['minimum']:worst={'minimum':float(minimum[i]),'phase':float(phase[i]),'blend':float(alpha),'breath':breath,'part':partnames[i]}
 report={'sourceOnly':True,'accepted':False,'perFoot':results,'wholeWeightedGeometry':{'poses':poses,'negativePoses':negative,'worst':worst},'pending':'Exact channel DAG/evaluator, actual trace replay, ramps/turning, attack/flinch/death transition and visual anatomy. No product module unless source gates pass.'}
 (OUT/'evaluation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':run()
