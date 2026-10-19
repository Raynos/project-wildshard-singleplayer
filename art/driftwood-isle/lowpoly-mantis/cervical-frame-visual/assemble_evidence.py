"""Label actual matched captures and record evidence; no repainting or new score."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import hashlib,json,math,struct
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];RAW=ROOT/'tmp/mantis-cervical-frame-visual';BASE=HERE.parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
views=['hero','front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']
roles={'baseline':'PASS2 ORIGINAL','candidate':'CERVICAL REPAIR'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(im,p,cap):
 im.save(p,quality=90,method=6);assert p.stat().st_size<=cap,(p,p.stat().st_size)
def label(im,text):
 im=im.convert('RGB');d=ImageDraw.Draw(im);d.rectangle((0,0,im.width,34),fill='#0b1722');d.text((10,5),text,font=font,fill='white');return im
for role,title in roles.items():
 for view in views:save(label(Image.open(RAW/role/(view+'.png')),title+' / REAL / '+view),HERE/(role+'-'+view+'.webp'),250000)
 b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((15,10),title+' / REAL MATCHED NINE',font=font,fill='white')
 for i,view in enumerate(views[1:]):
  x=i%3*360;y=45+i//3*505;im=ImageOps.contain(Image.open(RAW/role/(view+'.png')),(350,470));b.paste(im,(x+(360-im.width)//2,y+28));d.text((x+12,y),view,font=font,fill='white')
 save(b,HERE/(role+'-nine-board.webp'),500000)
reference=ROOT/'art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp'
b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((15,12),'MANTIS / FROZEN SOURCES / MATCHED REAL STATIC',font=font,fill='white')
ims=[Image.open(reference).crop((5,270,505,970)),Image.open(RAW/'baseline/hero.png'),Image.open(RAW/'candidate/hero.png')]
for i,(title,im) in enumerate(zip(['APPROVED CONCEPT (CROP)','PASS2 / 3.935 HISTORICAL','REPAIR / UNREVIEWED'],ims)):
 x=0 if i==0 else (i-1)*540;y=50 if i==0 else 790;d.text((x+12,y),title,font=font,fill='white');im=ImageOps.contain(im,(500,690));b.paste(im,(x+((1080 if i==0 else 540)-im.width)//2,y+32))
save(b,HERE/'matched-hero-board.webp',500000)
# Equal pixel ROI comes from union of targeted cervical/throat/collar vertices.
cameras=json.loads((HERE/'cameras.json').read_text())['cameras']
models={role:json.loads((BASE/suffix/('mantis-mesh-'+suffix+'.json')).read_text()) for role,suffix in [('baseline','complete-pass2'),('candidate','cervical-frame-repair')]}
def project(p,c):
 rx,ry,rz=c['rotation'];cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
 r=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];q=[p[i]-c['location'][i] for i in range(3)];v=[sum(r[j][i]*q[j] for j in range(3)) for i in range(3)]
 return [319+v[0]*900/c['orthoScale'],450-v[1]*900/c['orthoScale']]
rois={};b=Image.new('RGB',(1080,1580),'#0b1722');d=ImageDraw.Draw(b);d.text((16,12),'CERVICAL / THROAT / COLLAR: MATCHED CROP ENLARGEMENTS',font=font,fill='white')
for i,view in enumerate(['hero','front','left','right']):
 pts=[project(v,cameras[view]) for model in models.values() for part in model['parts'] if part['name'].startswith(('Rising prothorax','Rear neck collar','Integrated pale throat')) for v in part['vertices']]
 roi=(max(0,int(min(p[0] for p in pts))-15),max(0,int(min(p[1] for p in pts))-15),min(638,math.ceil(max(p[0] for p in pts))+15),min(900,math.ceil(max(p[1] for p in pts))+15));rois[view]=roi
 for j,role in enumerate(roles):
  x=j*540;y=48+i*365;d.text((x+12,y),roles[role]+' / '+view,font=font,fill='white');im=ImageOps.contain(Image.open(RAW/role/(view+'.png')).crop(roi),(520,320));b.paste(im,(x+(540-im.width)//2,y+30))
d.text((16,1520),'Visible overlap is not contact or articulation acceptance.',font=font,fill='white');save(b,HERE/'cervical-detail-board.webp',500000)
(HERE/'detail-crops.json').write_text(json.dumps({'source':'Unmodified actual full-frame PNGs','interpolation':'Pillow contain default bicubic; enlargement only','matchingPixelRois':rois},indent=2)+'\n')
def glb_json(p):
 raw=p.read_bytes();length=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+length])
frozen=glb_json(BASE/'complete-pass2/mantis-study-complete-pass2.glb');rebuilt=glb_json(RAW/'baseline/mantis-study-complete-pass2.glb');namechanges=[]
for section in ['materials','meshes']:
 for index,(before,after) in enumerate(zip(frozen[section],rebuilt[section])):
  assert before['name'].removesuffix('.001')==after['name']
  if before['name']!=after['name']:namechanges.append({'section':section,'index':index,'frozen':before['name'],'rebuilt':after['name']})
(HERE/'baseline-name-differences.json').write_text(json.dumps({'exactByteEquality':False,'onlyDifference':'Blender .001 suffix on material and mesh datablock names; all other JSON and binary exact','differences':namechanges},indent=2)+'\n')
provenance=json.loads((HERE/'capture-provenance.json').read_text());frames=[];fits=[]
for view in views:
 assert provenance['baseline']['capturedViews'][view]['camera']==provenance['candidate']['capturedViews'][view]['camera']
 assert provenance['baseline']['capturedViews'][view]['settings']==provenance['candidate']['capturedViews'][view]['settings']
 for role in roles:
  p=RAW/role/(view+'.png');im=Image.open(p);im.load();assert im.size==(638,900);assert sha(p)==provenance[role]['capturedViews'][view]['sha256'];frames.append({'path':str(p.relative_to(ROOT)),'sha256':sha(p),'bytes':p.stat().st_size,'size':list(im.size)})
  pts=[project(v,cameras[view]) for part in models[role]['parts'] for v in part['vertices']];bounds=[min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)];assert bounds[0]>0 and bounds[1]>0 and bounds[2]<638 and bounds[3]<900;fits.append({'role':role,'view':view,'pixelBounds':bounds})
pins=json.loads((BASE/'cervical-frame-repair/input-pins.json').read_text())
for path,digest in pins.items():assert sha(ROOT/path)==digest,path
for folder in ['complete-pass2-native','cervical-frame-repair']:
 for name in ['mantis-native.json','payload.bin','metadata.json','mesh-map.json','authored-mapping.json']:
  p=BASE/folder/name;pins[str(p.relative_to(ROOT))]=sha(p)
pins[str(reference.relative_to(ROOT))]=sha(reference)
(HERE/'input-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
audit=json.loads((BASE/'cervical-frame-repair/geometry-audit.json').read_text())
report={'status':'CAPTURE VERIFIED; independent visual review pending; no promotion','historicalScore':{'value':3.935,'appliesOnlyTo':'original complete-pass2 geometry','candidateScore':None},'frameCount':20,'pairedCameraLightingEquality':True,'rawFrames':frames,'projectionFits':fits,'originalSourcesUnmodified':True,'newOverlapDisclosure':audit['crossObjectIncidentTriangleIntersections'],'overlapLimit':'Incident triangle intersection counts, not penetration volume; new collar/throat overlaps unaccepted for visual/contact/articulation.','pointNormalCorrespondence':['baseline-correspondence.json','candidate-correspondence.json'],'files':{str(p.relative_to(ROOT)):sha(p) for p in HERE.iterdir() if p.is_file() and p.name!='evidence.json'},'totalNewBytes':sum(p.stat().st_size for directory in [HERE,RAW] for p in directory.rglob('*') if p.is_file())}
assert report['totalNewBytes']<30000000
(HERE/'evidence.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['rawFrames','projectionFits','files']},indent=2))
