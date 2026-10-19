"""Read-only repeat of the frozen failed mouth preflight with local geometry receipt."""
import hashlib,json,traceback
from pathlib import Path
p=Path(__file__).with_name('build_integrated_face_mouth.py');expected='250efcddf6515e1fa5d49f2f75310d0cacd568d64d16625fe604324980ae0ff0'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Frozen failed source changed')
ns={'__file__':str(p.resolve()),'__name__':'__main__'}
try:exec(compile(p.read_text(),str(p),'exec'),ns)
except RuntimeError as error:
    failure=str(error);tb=error.__traceback__
    while tb.tb_next:tb=tb.tb_next
    local=tb.tb_frame.f_locals
    receipt={'failure':failure,'sourceSha256':expected,'point':local.get('p'),'outerBoundary':local.get('outer'),'aperture':local.get('aperture'),'arch':local.get('arch'),'lower':local.get('lower'),'selectedFaces':local.get('selected')}
else:raise RuntimeError('Expected guard failure did not recur')
(ns['args'].out/'mouth-boundary-failure.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));raise RuntimeError(failure)
