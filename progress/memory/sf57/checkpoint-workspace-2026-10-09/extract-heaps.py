import json,hashlib,pathlib,collections
r=pathlib.Path('/private/tmp/claude-501/sp-builders/sp-x3/checkpoint-save-2026-10-09')
result={}
for name in ['before-chromium-before.heapsnapshot','before-chromium-after.heapsnapshot','after-chromium-before.heapsnapshot','after-chromium-after.heapsnapshot']:
 p=r/name;raw=p.read_bytes();h=json.loads(raw);digest=hashlib.sha256(raw).hexdigest();del raw
 fields=h['snapshot']['meta']['node_fields'];width=len(fields);types=h['snapshot']['meta']['node_types'][0];ns=h['nodes'];strings=h['strings']
 offsets={f:fields.index(f) for f in fields};large=[];bytype=collections.Counter();total=0
 for at in range(0,len(ns),width):
  size=ns[at+offsets['self_size']];total+=size;bytype[types[ns[at+offsets['type']]]]+=size
  if size>=65536:large.append({'nodeOffset':at,'id':ns[at+offsets['id']],'type':types[ns[at+offsets['type']]],'name':strings[ns[at+offsets['name']]],'selfSize':size,'owners':[]})
 targets={n['nodeOffset']:n for n in large};edgefields=h['snapshot']['meta']['edge_fields'];ew=len(edgefields);et=h['snapshot']['meta']['edge_types'][0];edges=h['edges'];eindex=0
 for at in range(0,len(ns),width):
  for i in range(ns[at+offsets['edge_count']]):
   typ=et[edges[eindex]];label=edges[eindex+1];to=edges[eindex+2];eindex+=ew
   if to in targets and len(targets[to]['owners'])<8:targets[to]['owners'].append({'type':types[ns[at+offsets['type']]],'name':strings[ns[at+offsets['name']]],'id':ns[at+offsets['id']],'edgeType':typ,'edgeName':label if typ in ['element','hidden'] else strings[label]})
 result[name]={'sha256':digest,'rawBytes':p.stat().st_size,'nodeCount':h['snapshot']['node_count'],'edgeCount':h['snapshot']['edge_count'],'selfBytes':total,'selfBytesByType':dict(bytype),'largeNodes':large}
 del h,ns,edges,strings
 print(name,len(large),flush=True)
(r/'heap-extract.json').write_text(json.dumps(result,indent=2)+'\n')
