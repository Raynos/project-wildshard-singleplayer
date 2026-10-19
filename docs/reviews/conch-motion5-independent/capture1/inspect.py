import json,hashlib,subprocess
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('tmp/conch-motion5-qa/actual-run1');out=Path('docs/reviews/conch-motion5-independent/capture1')
video=next((root/'video').glob('*.webm'))
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time,width,height','-of','json',str(video)]))['frames']
old=json.loads((root/'streamed-frame-review/index.json').read_text());pts=json.loads((root/'encoded-frames.json').read_text())['frames'];assert len(probe)==len(pts)==13012
for i,f in enumerate(probe):assert f['best_effort_timestamp_time']==pts[i]['best_effort_timestamp_time']==old['encodedFrames'][i]['best_effort_timestamp_time']
assert hashlib.sha256(video.read_bytes()).hexdigest()==old['videoSha256']
for i,s in enumerate(old['sheets']):
 assert (s['firstFrame'],s['lastFrame'])==(i*48,min((i+1)*48,13012)-1)
 assert hashlib.sha256((root/'streamed-frame-review'/s['file']).read_bytes()).hexdigest()==s['sha256']
p=subprocess.Popen(['ffmpeg','-v','error','-threads','1','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-threads','1','-'],stdout=subprocess.PIPE)
runs=[];framehash=[];previous=None;board=None;boards=[]
for i,f in enumerate(probe):
 raw=p.stdout.read(402*874*3);assert len(raw)==402*874*3
 h=hashlib.sha256(raw).hexdigest();framehash.append(h)
 if raw==previous:runs[-1]['last']=i
 else:
  r=len(runs);runs.append({'first':i,'last':i,'pts':f['best_effort_timestamp_time'],'rgbSha256':h})
  if r%48==0:board=Image.new('RGB',(800,1392),'#202020')
  img=Image.frombytes('RGB',(402,874),raw).resize((100,218));x=(r%8)*100;y=((r%48)//8)*232;board.paste(img,(x,y));ImageDraw.Draw(board).text((x,y+218),f'{r}: f{i}',fill='white')
  if r%48==47:
   name=f'reps-{r//48:03}.jpg';board.save(out/name,quality=90);boards.append(name)
 previous=raw
assert p.stdout.read(1)==b'';assert p.wait()==0
if len(runs)%48:
 name=f'reps-{(len(runs)-1)//48:03}.jpg';board.save(out/name,quality=90);boards.append(name)
(out/'pixel-map.json').write_text(json.dumps({'method':'Adjacent decoded RGB24 bytes compared directly with ==, no tolerance, then SHA256 per frame. Every run representative is its first encoded frame. Nonadjacent equal images are not merged.','videoSha256':old['videoSha256'],'frames':len(probe),'runs':runs,'frameHashes':framehash,'boards':boards,'ptsVerified':True,'originalSheetsVerified':len(old['sheets'])},separators=(',',':')))
print(json.dumps({'frames':len(probe),'representatives':len(runs),'boards':len(boards)}))
