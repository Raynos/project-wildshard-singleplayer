"""Label actual matched captures, record exact source/mesh hashes; no geometry changes."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=ROOT/'tmp/puffer-fin-study-terminal'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
manifest=[]
for f in sorted(OUT.glob('*.png')):
 im=Image.open(f).convert('RGB');label=Image.new('RGB',(im.width,im.height+44),'#10212c');label.paste(im,(0,44))
 name=f.stem.replace('v71','V71 retained').replace('compact-base','Retained compact base').replace('fin-study','Unaccepted terminal-only tips').replace('-',' / ')
 ImageDraw.Draw(label).text((12,12),name,font=font,fill='white');target=OUT/(f.stem+'-labelled.webp');label.save(target,quality=87,method=6)
 manifest.append({'rawPath':str(f.relative_to(ROOT)),'rawSha256':hashlib.sha256(f.read_bytes()).hexdigest(),'path':str(target.relative_to(ROOT)),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
receipt={'status':'unaccepted; genuine fixed-camera Blender native-bind evidence, no runtime proof','sourcePins':json.loads((OUT/'prelaunch-source-manifest.json').read_text()),'images':manifest,'visualRead':'Exact smooth teal web retained. Thinner and slightly sharper cream tips, but full-model visual gain is small. No score or acceptance claimed.','preservation':'V71 body, face, rear feet, tail, bones and scene unchanged in paired captures; only two forefins replaced in memory','checks':'Static topology/root/floor audit passes; self-intersection and motion not established'}
(OUT/'evidence-manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
(HERE/'terminal-capture-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('Wrote nine labelled WebP captures and evidence receipt')
