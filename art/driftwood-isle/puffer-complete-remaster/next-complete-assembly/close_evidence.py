"""Check frozen evidence, preserve raw bytes, and make bounded labelled boards."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
H=Path(__file__).resolve().parent;ROOT=H.parents[3];rawdir=ROOT/'tmp/puffer-next-complete-assembly';receipt=json.loads((H/'capture-receipt.json').read_text())
assert len(receipt['captures'])==20
for row in receipt['captures']:
 raw=ROOT/row['rawPath'];preview=H/row['filename'];assert hashlib.sha256(raw.read_bytes()).hexdigest()==row['rawSha256'];assert raw.stat().st_size==row['rawBytes'];assert hashlib.sha256(preview.read_bytes()).hexdigest()==row['sha256'];assert preview.stat().st_size<=250000
assert sum(p.stat().st_size for p in rawdir.rglob('*')if p.is_file())<=24*1024*1024
# Boards are labelled indices, never a substitute for the full-frame views.
for filename,shots in [('hero-comparison-board.webp',['hero']),('nine-view-comparison-board.webp',['01-front','02-left','03-right','04-back','05-top','06-elevated-front','07-elevated-left','08-elevated-right','09-elevated-back'])]:
 if len(shots)==1:
  board=Image.new('RGB',(600,1480),(8,17,23))
  for i,label in enumerate(['selected','candidate']):board.paste(Image.open(H/f'{label}-hero.webp'),(0,i*740))
 else:
  board=Image.new('RGB',(600,3330),(8,17,23))
  for row,shot in enumerate(shots):
   for col,label in enumerate(['selected','candidate']):board.paste(Image.open(H/f'{label}-{shot}.webp').resize((300,370)),(col*300,row*370))
 board.save(H/filename,'WEBP',quality=86,method=6);assert(H/filename).stat().st_size<=500000
binary=[p for p in H.iterdir()if p.suffix in ['.glb','.webp']];assert sum(p.stat().st_size for p in binary)<=7000000
files=[p for p in H.iterdir()if p.is_file() and p.name not in ['output-closure.json']]
closure={'status':'ONE complete static candidate rendered; unaccepted, no art score assigned','nativeSha256':hashlib.sha256((H/'candidate-native.json').read_bytes()).hexdigest(),'glbSha256':hashlib.sha256((H/'candidate.glb').read_bytes()).hexdigest(),'rawCount':len(list(rawdir.glob('*.png'))),'rawOriginalPngBytes':sum(p.stat().st_size for p in rawdir.glob('*.png')),'rawDirectoryTotalBytes':sum(p.stat().st_size for p in rawdir.rglob('*')if p.is_file()),'rawPngReencoded':False,'retainedBinaryBytes':sum(p.stat().st_size for p in binary),'actualMatchedRenders':20,'savedBlend':False,'sourceFiles':[{'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in sorted(files)],'runtimeChanged':False,'physicalDeviceTested':False,'animationTested':False}
(H/'output-closure.json').write_text(json.dumps(closure,indent=2)+'\n');print({k:v for k,v in closure.items()if k!='sourceFiles'})
