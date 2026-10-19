"""Reproducible delivery previews; original generated PNGs remain unchanged."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).parent
out=root/'previews';out.mkdir(exist_ok=True)
records=[]
for p in sorted(root.glob('*.png')):
 im=Image.open(p).convert('RGB'); im.thumbnail((1200,1200))
 q=out/(p.stem+'-sheet.webp' if 'Gen' in p.stem or 'nine' in p.stem else p.stem+'.webp')
 im.save(q,'WEBP',quality=82,method=6)
 assert q.stat().st_size<(500000 if 'sheet' in q.name else 250000),(q,q.stat().st_size)
 records.append({'original':p.name,'original_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'preview':q.relative_to(root).as_posix(),'preview_sha256':hashlib.sha256(q.read_bytes()).hexdigest(),'bytes':q.stat().st_size,'lossy_delivery_only':True,'original_unchanged':True})
(root/'preview-provenance.json').write_text(json.dumps(records,indent=2)+'\n')
