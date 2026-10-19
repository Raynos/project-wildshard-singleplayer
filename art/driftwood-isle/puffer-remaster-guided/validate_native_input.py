"""Cheap native v2 shape/linear-color/weight validation before Blender jobs."""
import argparse,hashlib,json,math
from pathlib import Path

def validate(path):
    raw=path.read_bytes();data=json.loads(raw);bones=data['bones'];rows=[]
    for part in data['parts']:
        required=('positions','colorsLinear','skinIndices','skinWeights','furLen')
        missing=[key for key in required if key not in part]
        if missing:raise ValueError('Missing native fields: '+str(missing))
        count=len(part['positions'])//3
        if len(part['positions'])!=3*count or count%3:raise ValueError('Incomplete native triangle positions')
        for key,multiple in [('colorsLinear',3),('skinIndices',4),('skinWeights',4),('furLen',1)]:
            if len(part[key])!=multiple*count:raise ValueError('Native attribute length mismatch: '+key)
        for key in('positions','colorsLinear','skinWeights','furLen'):
            if not all(math.isfinite(v)for v in part[key]):raise ValueError('Non-finite '+key)
        if not all(0<=x<=1 for x in part['colorsLinear']):raise ValueError('Linear colors outside0..1')
        if not all(isinstance(i,int)and 0<=i<len(bones)for i in part['skinIndices']):raise ValueError('Invalid bone index')
        if not all(0<=w<=1 for w in part['skinWeights']):raise ValueError('Invalid skin weight')
        if not all(abs(sum(part['skinWeights'][i:i+4])-1)<1e-6 for i in range(0,4*count,4)):raise ValueError('Unnormalized weights')
        rows.append({'name':part['name'],'vertices':count})
    return {'status':'passed','sha256':hashlib.sha256(raw).hexdigest(),'parts':rows,'colorEncoding':'native colorsLinear copied directly; no gamma conversion'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('native',type=Path);parser.add_argument('--receipt',type=Path);args=parser.parse_args();result=validate(args.native)
    if args.receipt:args.receipt.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
