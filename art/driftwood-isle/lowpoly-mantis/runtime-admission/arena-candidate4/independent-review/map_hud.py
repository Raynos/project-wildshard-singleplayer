import subprocess,glob,json,hashlib,io,re,os
from PIL import Image
from pathlib import Path
out=Path(__file__).parent
for name,folder in [('combat','motion')]:
 p='public/review-evidence/mantis-v7-candidate4/live-observer.mp4';proc=subprocess.Popen(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE);cache={};rows=[];i=0
 while True:
  b=proc.stdout.read(402*874*3)
  if not b:break
  im=Image.frombytes('RGB',(402,874),b).crop((8,220,394,264));h=hashlib.sha256(im.tobytes()).hexdigest()
  if h not in cache:
   buf=io.BytesIO();im.resize((1158,132)).save(buf,format='PNG');s=subprocess.run(['tesseract','stdin','stdout','--psm','6'],input=buf.getvalue(),capture_output=True,env={**os.environ,'OMP_THREAD_LIMIT':'1'}).stdout.decode();cache[h]=s
  s=cache[h];m=re.search(r'frame\s+(\d+)',s);rows.append({'encoded':i,'render':int(m[1]) if m else None,'ocr':s});i+=1
 json.dump(rows,open(out/f'{name}-hud-map.json','w'),indent=2);print(name,i,flush=True)
