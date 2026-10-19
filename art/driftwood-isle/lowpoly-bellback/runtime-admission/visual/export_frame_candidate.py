"""Export one exact separate candidate with unchanged codec; never admit runtime data."""
from pathlib import Path
import json
import sys
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
import export_native as bridge
import audit_source_normals as normals
source=HERE/'build_bellback_v6_frame1.py'
glb=HERE/'bellback-study-v6-frame1.glb'
source_sha=bridge.sha(source.read_bytes());glb_sha=bridge.sha(glb.read_bytes())
assert source_sha=='8c5f87075b5e4c878b8dc766d09020a80ffb97a4e36e07f7e57ce1b3bebb78a7'
old,ob=bridge.parse_glb((HERE.parents[1]/'bellback-study-v6.glb').read_bytes());new,nb=bridge.parse_glb(glb.read_bytes())
assert old['materials']==new['materials']
assert old['nodes']==new['nodes']
def decoded(doc,buf,node):
    return [{'material':p['material'],'attrs':{k:bridge.accessor(doc,buf,v) for k,v in p['attributes'].items()},'indices':bridge.accessor(doc,buf,p['indices'])} for p in doc['meshes'][node['mesh']]['primitives']]
unchanged=[];changed=[]
for a,b in zip(old['nodes'],new['nodes']):
    if 'mesh' not in a:continue
    x=decoded(old,ob,a);y=decoded(new,nb,b)
    if a['name'] not in ['Barrel timber hull','Lower timber jaw']:
        assert x==y,a['name'];unchanged.append(a['name'])
    else:
        assert {p for r in x for p in r['attrs']['POSITION']}=={p for r in y for p in r['attrs']['POSITION']}
        assert [r['material'] for r in x]==[r['material'] for r in y]
        assert sum(len(r['indices']) for r in x)==sum(len(r['indices']) for r in y)
        changed.append(a['name'])
assert len(unchanged)==71 and len(changed)==2
# Only this process gets the new exact pins; the original bridge file stays intact.
bridge.SOURCE_SHA=source_sha;bridge.GLB_SHA=glb_sha;bridge.GLB=glb
native,mapping=bridge.export_native(source.read_bytes(),glb.read_bytes())
native['candidate']='Bellback V6 frame-correspondence candidate 1'
dims=bridge.diagnostic_dimensions(native,mapping);metadata,packed=bridge.pack_native(native,dims)
audit=normals.audit()
assert len(audit['opposedTriangles'])==1,audit
assert audit['opposedTriangles'][0]['name']=='Crown tie'
out=HERE/'frame1-native'
assert not out.exists(),'Refuse overwriting candidate native closure'
out.mkdir()
files={'bellback-v6-native.json':bridge.encoded(native),'diagnostic-dimensions.json':bridge.encoded(dims),'mesh-map.json':bridge.encoded(mapping),'metadata.json':bridge.encoded(metadata),'payload.bin':packed}
for name,raw in files.items():(out/name).write_bytes(raw)
receipt={'schema':'wildshard.bellback.frame-candidate.v1','sourceSha256':source_sha,'glbSha256':glb_sha,'unchangedMeshes':unchanged,'changedMeshes':changed,'allMeshPointSetsUnchanged':True,'nodeTransformsAndMaterialsUnchanged':True,'stats':bridge.validate_native(native),'remainingNormalCaveats':audit,'files':{k:{'sha256':bridge.sha(v),'bytes':len(v)} for k,v in files.items()},'runtimeAcceptance':False,'originalBridgeSha256':bridge.sha((HERE.parent/'export_native.py').read_bytes()),'candidateExporterSha256':bridge.sha(Path(__file__).read_bytes())}
(out/'closure.json').write_bytes(bridge.encoded(receipt));print(json.dumps(receipt,indent=2))
