"""Run from repository root; independent canonical runtime attribute check."""
import json, pathlib, numpy as np, zlib
p=pathlib.Path('art/driftwood-isle/approved-conch/runtime-admission/character-pass-native1')
meta=json.loads((p/'metadata.json').read_text()); raw=zlib.decompress((p/'payload.bin').read_bytes())
g=json.loads(pathlib.Path('tmp/conch-motion-observer-event-order1/runtime-geometry.json').read_text())[0]; offset=0
for part in meta['bodies'][0]['hard']:
 n=part['row']['count']
 for k,attr in enumerate(part['row']['attrs']):
  name,typ,num=attr[:3]
  if name not in ['position','skinIndex','skinWeight']: continue
  arr=np.frombuffer(raw,dtype='<u2' if typ=='u16' else '<f4',count=n*num,offset=part['offsets'][k]).copy().reshape(n,num)
  if name=='position': arr[:,0]=-arr[:,0]; arr[:,2]=.05-arr[:,2].astype(float)
  actual=np.array(g[{'position':'positions','skinIndex':'indices','skinWeight':'weights'}[name]]).reshape(-1,num)[offset:offset+n]
  assert np.array_equal(arr,actual),(name,offset)
 offset+=n
print('Independent canonical verification exact',offset)
