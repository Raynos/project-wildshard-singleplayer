"""Recover exact earlier unseated prepaint state and reproduce failed paint.
Only temporary owned files are created; frozen candidate files are never changed.
"""
import hashlib,importlib.util,json,tempfile
from pathlib import Path
H=Path(__file__).resolve().parent;ROOT=H.parents[3]
spec=importlib.util.spec_from_file_location('retained_failed_partition',H/'failed_partition_paint.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
n=json.loads((H/'prepaint-native.json').read_text());rows=json.loads((H/'shoulder-controls.json').read_text());mapping={tuple(after):before for row in rows if 'rootBefore'in row for before,after in zip(row['rootBefore'],row['rootAfter'])};positions=n['parts'][0]['positions'];restored=[]
for i in range(0,len(positions),3):restored.extend(mapping.get(tuple(positions[i:i+3]),positions[i:i+3]))
n['parts'][0]['positions']=restored
expected=json.loads((H/'failed-partition-receipt.json').read_text());temporary=ROOT/'tmp/puffer-next-complete-assembly';temporary.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='failed-paint-reproduction-',dir=temporary)as td:
 p=Path(td);(p/'prepaint-native.json').write_text(json.dumps(n,separators=(',',':'),allow_nan=False)+'\n');(p/'surface-ownership.json').write_bytes((H/'surface-ownership.json').read_bytes());module.H=p;module.build();actual=hashlib.sha256((p/'candidate-native.json').read_bytes()).hexdigest()
 result={'status':'exact failed native reproduced'if actual==expected['nativeSha256']else'failed native hash differs; do not claim exact reproduction','expectedFailedNativeSha256':expected['nativeSha256'],'reproducedFailedNativeSha256':actual,'matches':actual==expected['nativeSha256'],'reconstruction':'Restore only rootAfter coordinates to their rootBefore in shoulder-controls.json; all other prepaint arrays exact. Run retained failed_partition_paint.py.','frozenCandidateUntouched':True,'temporaryNativeCopiesRetained':False}
(H/'failed-reproduction-receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(result);assert result['matches']
