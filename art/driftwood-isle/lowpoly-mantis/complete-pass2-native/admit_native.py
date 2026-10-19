"""Strict candidate tuple and clean-normal admission, no V7/engine exemptions."""
import json
from pathlib import Path
import export_native as bridge

def inspect():
    bridge.verify_inputs()
    closure=bridge.read_json(bridge.HERE/'closure.json')
    bridge.require(closure['schema']=='wildshard.mantis.complete-pass2.preparation.v1','Wrong candidate closure')
    bridge.require(closure['exporterSha256']==bridge.sha(Path(bridge.__file__).read_bytes()),'Exporter hash mismatch')
    bridge.require(set(closure['files']) == {'mantis-native.json','mesh-map.json','normal-audit.json','diagnostic-dimensions.json','metadata.json','payload.bin'}, 'Incomplete native tuple')
    bridge.require(closure['inputs'] == bridge.read_json(bridge.HERE/'input-pins.json'), 'Input tuple mismatch')
    for name,expected in closure['files'].items():
        bridge.require('/' not in name and '\\' not in name,'Foreign output path')
        raw=(bridge.HERE/name).read_bytes()
        bridge.require(expected==dict(bytes=len(raw),sha256=bridge.sha(raw)),'Native tuple mismatch: '+name)
    data,mapping,audit=bridge.export_native()
    bridge.require(bridge.encoded(data)==(bridge.HERE/'mantis-native.json').read_bytes(),'Native source mismatch')
    bridge.require(bridge.encoded(mapping)==(bridge.HERE/'mesh-map.json').read_bytes(),'Geometry correspondence mismatch')
    bridge.require(bridge.encoded(audit)==(bridge.HERE/'normal-audit.json').read_bytes(),'Source normal audit mismatch')
    dims=bridge.readers.diagnostic_dimensions(data,mapping)
    meta,payload=bridge.pack_native(data,dims)
    bridge.require(bridge.encoded(dims)==(bridge.HERE/'diagnostic-dimensions.json').read_bytes(),'Diagnostic dimensions changed')
    bridge.require(bridge.encoded(meta)==(bridge.HERE/'metadata.json').read_bytes(),'Packed metadata changed')
    bridge.require(payload==(bridge.HERE/'payload.bin').read_bytes(),'Packed six-channel payload changed')
    failures=[]
    if audit['opposedTriangles']:
        failures.append(dict(gate='source-normal-orientation',cause='Four unchanged curved cervical arch triangles have stored source normals opposing their triangle winding.',triangles=audit['opposedTriangles']))
    return dict(schema='wildshard.mantis.complete-pass2.admission.v1',candidate='complete-pass2-native22',status='FAIL' if failures else 'STRUCTURAL_ONLY',geometryCorrespondence='PASS',nativeTuple='PASS',normalPreservation='PASS',cleanNormalOrientation='FAIL' if failures else 'PASS',failures=failures,visualAcceptance=False,animationAcceptance=False,worldContactAcceptance=False,runtimeAcceptance=False,promotion=False)

def admit():
    result=inspect()
    bridge.require(not result['failures'],'Clean-normal admission failed: four opposed source cervical arch triangles')
    return result

if __name__=='__main__':
    result=inspect()
    (bridge.HERE/'admission.json').write_bytes(bridge.encoded(result))
    print(json.dumps(result,indent=2))
    raise SystemExit(1 if result['failures'] else 0)
