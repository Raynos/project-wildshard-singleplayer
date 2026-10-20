"""Final delivery labels outside original frames; raw captures remain untouched."""
from pathlib import Path
from io import BytesIO
import hashlib,json,shutil
from PIL import Image,ImageDraw,ImageFont
HERE=Path(__file__).resolve().parent
RAW=HERE/'raw-attempt1';PREVIOUS=HERE/'previews-attempt1';OUT=HERE/'previews-final'
if OUT.exists():raise RuntimeError('Refuse overwrite of final delivery attempt')
OUT.mkdir();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((PREVIOUS/'preview-manifest.json').read_bytes());capture=json.loads((RAW/'capture-receipt.json').read_bytes());rows=[]
for row in old['outputs']:
 if row['file'].startswith('matched-static'):
  assert sha(PREVIOUS/row['file'])==row['sha256'];shutil.copyfile(PREVIOUS/row['file'],OUT/row['file']);rows.append(row)
font=ImageFont.truetype('DejaVuSans.ttf',17)
for frame in capture['frames']:
 source=RAW/frame['file'];assert sha(source)==frame['sha256'];im=Image.open(source).convert('RGB');im.thumbnail((360,600),Image.Resampling.LANCZOS)
 canvas=Image.new('RGB',(360,im.height+36),(21,29,40));canvas.paste(im,((360-im.width)//2,36));draw=ImageDraw.Draw(canvas)
 label=('SELECTED' if frame['variant']=='selected' else 'ARTICULATED')+' | '+frame['view'].upper();draw.text((10,8),label,font=font,fill='white')
 data=None
 for quality in [84,80,76,72,68,64,60]:
  b=BytesIO();canvas.save(b,format='WEBP',quality=quality,method=6)
  if len(b.getvalue())<=14000:data=b.getvalue();break
 if data is None:raise RuntimeError('Labelled individual exceeds reserved budget; preserve all attempts')
 name=Path(frame['file']).stem+'.webp';(OUT/name).write_bytes(data);rows.append({'file':name,'bytes':len(data),'sha256':sha(OUT/name),'resolution':list(canvas.size),'quality':quality,'method':6,'sources':[frame],'operations':['Opaque RGB conversion','Aspect-preserving LANCZOS thumbnail, max360x600','Variant/view label on separate36px top margin, no crop or retouch','Lossy WebP encoding']})
for frame in capture['frames']:assert sha(RAW/frame['file'])==frame['sha256']
total=sum(r['bytes'] for r in rows);assert len(rows)==24 and total<=700000
manifest={'status':'final labelled delivery set, all raw bytes unchanged','previousDeliveryManifestSha256':sha(PREVIOUS/'preview-manifest.json'),'labelScriptSha256':sha(Path(__file__)),'sourceCaptureReceiptSha256':sha(RAW/'capture-receipt.json'),'totalPreviewBytes':total,'outputs':rows}
(OUT/'preview-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'images':len(rows),'totalBytes':total}))
