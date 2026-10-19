"""Decode every frame, retain full-frame representatives and ordered overview sheets."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw

video = Path(sys.argv[1])
out = Path('tmp/mantis-precontact-independent-visual2')
out.mkdir(parents=True, exist_ok=True)
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_streams','-of','json',str(video)]))['streams'][0]
width,height = probe['width'],probe['height']
numerator,denominator = map(float,probe['r_frame_rate'].split('/'))
fps = numerator/denominator
p = subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
size = width*height*3
unique,seen,index = [],{},[]
i = 0
while True:
    raw = p.stdout.read(size)
    if not raw: break
    assert len(raw)==size
    sha = hashlib.sha256(raw).hexdigest()
    if sha not in seen:
        seen[sha] = i
        unique.append(i)
        Image.frombytes('RGB',(width,height),raw).save(out/f'full-{i:05d}.jpg',quality=92)
    index.append({'frame':i,'decodedPixelSha256':sha,'representative':seen[sha]})
    i += 1
assert p.wait()==0
sheets = []
thumb_width = 120
thumb_height = round(height*thumb_width/width)
for start in range(0,len(unique),64):
    subset = unique[start:start+64]
    sheet = Image.new('RGB',(8*thumb_width,8*(thumb_height+18)),(32,32,32))
    draw = ImageDraw.Draw(sheet)
    for j,frame in enumerate(subset):
        x,y = j%8*thumb_width,j//8*(thumb_height+18)
        with Image.open(out/f'full-{frame:05d}.jpg') as im:
            sheet.paste(im.resize((thumb_width,thumb_height)),(x,y+18))
        draw.text((x+2,y+2),f'{frame} {frame/fps:.2f}s',fill='white')
    path = out/f'all-{start//64:03d}.jpg'
    sheet.save(path,quality=90)
    sheets.append({'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'encodedRepresentatives':subset})
receipt = {'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'videoBytes':video.stat().st_size,
    'width':width,'height':height,'fps':fps,'encodedFrames':len(index),'uniqueDecodedFullFrames':len(unique),'exactDuplicateFrames':len(index)-len(unique),
    'scope':'Every decoded full RGB frame hashed; only exact full-pixel duplicates reuse a visual representative. Sheets show the full portrait frame, downsampled. Fine contact and HUD require full-resolution representatives. This is chronological image-sequence review, not real-time playback.',
    'sheets':sheets,'index':index}
(Path(__file__).parent/'video-index.json').write_text(json.dumps(receipt,indent=2)+'\n')
print({k:v for k,v in receipt.items() if k not in ['sheets','index']})
print('sheets',len(sheets))
