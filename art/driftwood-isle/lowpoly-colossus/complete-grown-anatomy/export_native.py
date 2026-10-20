"""Exact rest conversion using the established packed native consumer codec.
Derived rig preparation only: no motion/contact or runtime promotion.
"""
from pathlib import Path
import importlib.util,json,hashlib,math
B=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('prior_codec',B.parent/'runtime-admission/export_native.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def enc(x):return (json.dumps(x,separators=(',',':'))+'\n').encode()
raw=(B/'tide-root-colossus-complete-grown-anatomy.glb').read_bytes();doc,buf=m.parse_glb(raw)
bones=json.loads((B.parent/'complete-character-next/native-source.json').read_text())['bones']
parts={n:{'name':n,**{k:[] for _,_,_,k in m.codec.ATTRS}} for n in m.PARTS};mapping=[]
for ni,node,parent,world in m.scene_nodes(doc):
 name=node['name'];mesh=doc['meshes'][node['mesh']]
 points=[p for pr in mesh['primitives'] for p in m.accessor(doc,buf,pr['attributes']['POSITION'])]
 center=[sum(p[i] for p in points)/len(points) for i in range(3)]
 lower=name.lower();side='-1' if center[0]<0 else '1'
 foliage=all(doc['materials'][pr['material']]['name'].startswith('leaf') for pr in mesh['primitives'])
 if any(k in lower for k in ('crown','brow','cheek','jaw','eye','neck','nasal')):region='head'
 elif any(k in lower for k in ('shoulder','scapula','clavicle','back','nape','collar')):region='body'
 elif any(k in lower for k in ('arm','elbow','digit','thumb')):region='arm'+side
 elif any(k in lower for k in ('thigh','shin','knee','calf','ankle','toe','foot','heel','hip','leg','grounded stone')):region='leg'+side
 else:region='body'
 part=parts[('foliage-' if foliage else '')+region];start=len(part['positions'])//3
 for pr in mesh['primitives']:
  pts=m.accessor(doc,buf,pr['attributes']['POSITION']);idx=[x[0] for x in m.accessor(doc,buf,pr['indices'])]
  color=doc['materials'][pr['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
  for i in idx:
   point=[v+w for v,w in zip(pts[i],world)];ids,weights=m.weights(name,region,point)
   part['positions'].extend(point);part['colorsLinear'].extend(color);part['skinIndices'].extend(ids);part['skinWeights'].extend(weights);part['furLen'].append(0)
 mapping.append({'node':ni,'name':name,'joint':part['name'],'vertexStart':start,'vertexCount':len(part['positions'])//3-start})
# Empty region batches are harmless but omitted rather than claimed present.
data={'schema':m.codec.SCHEMA,'bones':bones,'parts':[p for p in parts.values() if p['positions']]}
stats=m.codec.validate_native(data)
dims={'bodyY':bones[0]['pos'][1],'bodyHalfLen':1.7,'bodyRadius':3.8,'headRadius':2.3,'legLen':2.5,'feet':[[-1,0],[1,0]],'halfWidth':2.8,'capsuleAxis':'z'}
meta,payload=m.codec.pack_native_puffer(data,dims,'/assets/unaccepted/colossus-complete-grown-anatomy');meta['bodies'][0].update(kind='tideRootColossus',variant='tide-root-colossus')
data['schema']='wildshard.colossus.mesh.v1'
for name,value in [('native-source.json',data),('metadata.json',meta),('mesh-map.json',mapping),('rig-provenance.json',{'status':'Derived preparation, not animation acceptance','bones':bones,'weights':'Existing analytical fields applied to new rest geometry. Joint deformation/contact not verified.','materials':'Packed consumer retains linear color; source GLB emission is not represented in packed consumer.','stats':stats,'sourceSHA256':hashlib.sha256(raw).hexdigest()})]:(B/name).write_bytes(enc(value))
(B/'payload.bin').write_bytes(payload)
print(stats, len(payload))
