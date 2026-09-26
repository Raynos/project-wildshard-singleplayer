"""Rebuild the two shard-checkpoint review PDFs (requires Pillow and reportlab)."""

from pathlib import Path
from tempfile import gettempdir
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/process'
TMP = Path(gettempdir()) / 'wildshard-nd-process-pdf'
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
W, H = 960, 600
BG = HexColor('#091620')
PANEL = HexColor('#112633')
EDGE = HexColor('#315566')
CYAN = HexColor('#8fe3ff')
WHITE = HexColor('#f0f7f8')
MUTED = HexColor('#adc2c9')
GOLD = HexColor('#f2bf78')
GREEN = HexColor('#86d9b6')

def page(c, series, n, title, sub):
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(CYAN); c.setFont('Helvetica-Bold', 10); c.drawString(42, 566, series.upper())
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 26); c.drawString(42, 530, title)
    c.setFillColor(MUTED); c.setFont('Helvetica', 11); c.drawString(43, 509, sub)
    c.setStrokeColor(EDGE); c.setLineWidth(0.8); c.line(42, 494, 918, 494)
    c.setFillColor(MUTED); c.setFont('Helvetica', 9)
    c.drawString(42, 21, 'PROJECT WILDSHARD  /  PORTRAIT IOS PWA  /  2026-09-26')
    c.drawRightString(918, 21, str(n).zfill(2))

def card(c, x, y, w, h, fill=PANEL, stroke=EDGE):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 10, fill=1, stroke=1)

def label(c, x, y, text, color=CYAN):
    c.setFillColor(color); c.setFont('Helvetica-Bold', 9); c.drawString(x, y, text.upper())

def para(c, x, y, text, width, size=12, leading=16, color=WHITE, bold=False):
    c.setFillColor(color); c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    for line in simpleSplit(text, 'Helvetica-Bold' if bold else 'Helvetica', size, width):
        c.drawString(x, y, line); y -= leading
    return y

def pic(c, path, x, y, w, h, caption=None):
    im = Image.open(path).convert('RGB')
    im.thumbnail((round(w*2.5), round(h*2.5)), Image.Resampling.LANCZOS)
    iw, ih = im.size
    scale = min(w/iw, h/ih)
    dw, dh = iw*scale, ih*scale
    card(c, x, y, w, h, fill=HexColor('#08121a'))
    mini = TMP / f'pdf-{Path(path).stem}-{int(w)}x{int(h)}.jpg'
    im.save(mini, quality=85, optimize=True)
    c.drawImage(str(mini), x+(w-dw)/2, y+(h-dh)/2, dw, dh)
    if caption:
        c.setFillColor(HexColor('#07131bcc')); c.rect(x, y, w, 23, fill=1, stroke=0)
        label(c, x+9, y+7, caption)

def note(c, x, y, w, heading, body, color=CYAN):
    label(c, x, y, heading, color)
    return para(c, x, y-20, body, w, 12, 16, WHITE)-14

def strip(c, x, y, w, good=0.8):
    card(c, x, y, w, 45)
    c.setFillColor(GREEN); c.roundRect(x+6, y+6, (w-12)*good, 10, 4, fill=1, stroke=0)
    c.setFillColor(GOLD); c.roundRect(x+6+(w-12)*good, y+6, (w-12)*(1-good), 10, 4, fill=1, stroke=0)
    label(c, x+10, y+27, 'PINNED / DEMO READY', GREEN)
    c.setFillColor(GOLD); c.setFont('Helvetica-Bold', 9); c.drawRightString(x+w-10, y+27, 'ONE ACTIVE SLICE')

art = ROOT/'art/nine-dragon-stack'
hud = ROOT/'art/hud-explorer/round-1-arena'
target_a = art/'round-6-baseline-hud/style-A-jiehua-neon.jpg'
target_b = art/'round-6-baseline-hud/comp-B-well-edge.jpg'
actual_a = hud/'ref-live.jpg'
target_well = art/'round-15-eight-domes/B1-well-edge-stand/target-5.jpg'
actual_well = art/'round-15-eight-domes/B1-well-edge-stand/tile-5.jpg'
arena = hud/'C-humanoid-armor.jpg'
straw = hud/'straw-cloth-nine-angles.jpg'

lab = Image.open(art/'round-9-lab-grapple/final.jpg').convert('RGB')
lw, lh = lab.size
lab.crop((int(lw*.17), int(lh*.04), int(lw*.34), int(lh*.52))).save(TMP/'grapple-lab-crop.jpg', quality=91)

story = canvas.Canvas(str(OUT/'nine-dragon-imaginary-play-by-play.pdf'), pagesize=(W,H), pageCompression=1)
story.setTitle('Nine Dragon - an imaginary five-checkpoint play-by-play')

page(story, 'Imagined play-by-play / Nine Dragon', 1, 'A shard built together, one pocket at a time', 'Fictional review sequence, grounded in the current partial shard. This is a process example, not a claim that these steps shipped.')
pic(story, target_a, 42, 66, 275, 410, 'existing look target')
card(story, 338, 275, 580, 201)
label(story, 359, 447, 'The 80 / 20 promise')
y=para(story,359,422,'The square stays playable while we touch only one rough slice: the Fei Zhua crossing. We do not turn a 500 m city into a giant review queue.',535,16,22,WHITE,True)
y=para(story,359,y-13,'When the new slice looks and plays right on iPhone, it joins the pinned area. Only then do we open another pocket.',535,13,18,MUTED)
strip(story,338,211,580)
card(story,338,66,580,128)
label(story,359,167,'What exists today')
para(story,359,145,'The playable fragment is a 22 x 46 m square, a 12 x 94 m street and a stair corridor, plus Well ledges and crossings. The 500 x 500 x 500 m city is the future plan.',535,12,17)
story.showPage()

page(story, 'Imagined play-by-play / Nine Dragon', 2, 'Checkpoint 1 - pin the square', 'One portrait camera. One target. One playable capture. One taste decision.')
pic(story,target_a,42,63,219,412,'target mockup')
pic(story,actual_a,273,63,219,412,'real partial-shard capture')
card(story,510,63,408,412)
y=note(story,529,446,368,'Imagined exchange','We show the same spawn pose. Jake says the gate and street feel right, but the ground reads too clean. Only wet-stone response is revised; the skyline stays pinned.')
y=note(story,529,y,368,'Internal checks','Nine camera angles, a slow walk, collisions, 60 fps capture and real iPhone memory are checked by the agent. The user sees one short board and one playable link.')
note(story,529,y,368,'Exit','Approve the square only after the moving view and phone build agree with the still. Until then, it remains the active 20%.',GREEN)
story.showPage()

page(story, 'Imagined play-by-play / Nine Dragon', 3, 'Checkpoint 2 - make the hook a real verb', 'The target picture is a taste guide; the lab proves pieces, not a playable crossing.')
pic(story,target_b,42,63,219,412,'target mockup')
pic(story,TMP/'grapple-lab-crop.jpg',273,63,219,412,'existing lab proof')
card(story,510,63,408,412)
y=note(story,529,446,368,'One active slice','A hook, a line, a pull on the real player capsule and a safe landing. LOCK chooses a visible dragon hook; JUMP fires. Miss and release are part of the same slice.')
y=note(story,529,y,368,'Imagined first pass','The line fires, but the bite is hard to read and a miss throws the player into the shaft. The rest of the square is still demo-ready. We do not add more hooks yet.')
note(story,529,y,368,'One review question','Does the lock and bite read clearly while moving? We fix that and the landing before calling this checkpoint polished.',GOLD)
story.showPage()

page(story, 'Imagined play-by-play / Nine Dragon', 4, 'Checkpoint 3 - polish the landing, not a district', 'The same Well camera is compared again after a tiny geometry and timing pass.')
pic(story,target_well,42,63,219,412,'look target')
pic(story,actual_well,273,63,219,412,'in-engine view')
card(story,510,63,408,412)
y=note(story,529,446,368,'Imagined steering','Jake asks for the dragon head to sit a little farther into the view and for the far deck to feel wider. We adjust those two things, then replay the zip and the landing.')
y=note(story,529,y,368,'No still-image shortcut','The agent walks and grapples around the rim, checks the other angles internally, then tests the portrait PWA on a real iPhone. A beautiful isolated frame is not the gate.')
note(story,529,y,368,'Pin it','Only the hook plus landing join the approved area. The rest of the Well stays closed scenery until its own checkpoint.',GREEN)
story.showPage()

page(story, 'Imagined play-by-play / Nine Dragon', 5, 'Checkpoint 4 - test combat before expansion', 'The next review is a small interaction, not another hundred metres of city.')
pic(story,arena,42,63,219,412,'HUD arena mockup')
pic(story,straw,273,63,219,412,'nine-angle dummy sheet')
card(story,510,63,408,412)
y=note(story,529,446,368,'Shared practice room','Before another pocket, review the real first-person arms, light combo, heavy, ranged hit/miss and damage numbers against three animated humanoid dummies. Their armor materials are inspected from all sides.')
y=note(story,529,y,368,'The release gate','Model Explorer: approved form. World Explorer: approved placement and seam. HUD arena: clear controls and hit feedback. Real iPhone: stable load and frame time. Then commit and deploy.')
note(story,529,y,368,'Next slice','Only after those gates pass do we propose the next small Nine Dragon dome. The process repeats with one board and one decision.',GREEN)
story.save()

manual = canvas.Canvas(str(OUT/'shard-checkpoints-user-guide.pdf'), pagesize=(W,H), pageCompression=1)
manual.setTitle('Shard Checkpoints - three-page user guide')

page(manual,'Shard Checkpoints / user guide',1,'Build a shard without a review avalanche','A three-page guide for Matthew. The skill is .claude/skills/shard-checkpoints/SKILL.md.')
card(manual,42,276,876,200)
label(manual,66,444,'The rule')
para(manual,66,414,'Keep most of the exposed shard polished and demo-ready. Work on only one small rough slice at a time. The 80 / 20 split is a scope rule, not a measured quality score.',815,18,25,WHITE,True)
strip(manual,42,204,876)
card(manual,42,62,425,125); card(manual,482,62,436,125)
label(manual,62,158,'Matthew chooses taste')
para(manual,62,136,'Approve or redirect one portrait comparison and a short playable demo. Say what reads wrong first.',385,12,17)
label(manual,502,158,'The agent owns the grind')
para(manual,502,136,'Make the mockups, capture all angles, build the slice, test movement, phone load and performance.',395,12,17)
manual.showPage()

page(manual,'Shard Checkpoints / user guide',2,'One checkpoint from idea to pinned','Use the same loop for a world pocket, model, weapon or HUD interaction.')
steps=[
('01','Frame','Pick one small slice and one camera. Show a high-quality target beside a plausible near-term result.'),
('02','Inspect','Review a model from front, sides, back and three-quarter angles. Register used models in Model Explorer.'),
('03','Build','Put the slice in the playable world with collisions and controls. Compare target, before and current at the same pose.'),
('04','Play','Walk or fight through it. Use World Explorer for seams and HUD/Weapon Explorer for first-person feedback.'),
('05','Pin','Test the real iPhone PWA and project gates. Ask one taste question; pin and deploy only after approval.'),
]
for i,(num,title,body) in enumerate(steps):
    y=402-i*82
    card(manual,42,y,876,70)
    label(manual,62,y+43,num,GOLD)
    manual.setFillColor(WHITE); manual.setFont('Helvetica-Bold',15); manual.drawString(105,y+39,title)
    para(manual,225,y+42,body,668,12,17)
manual.showPage()

page(manual,'Shard Checkpoints / user guide',3,'What Matthew actually sees','One compact board, one playable link, one decision. The technical grids stay internal.')
card(manual,42,245,425,231); card(manual,482,245,436,231)
label(manual,62,448,'A useful review note')
y=para(manual,62,420,'"The target reads wet and dense. The current frame is too bright near the floor. Keep the camera; darken only the ground."',380,14,20,WHITE,True)
para(manual,62,y-20,'This gives the agent one lever while preserving the approved parts.',380,12,17,MUTED)
label(manual,502,448,'A useful verdict')
y=para(manual,502,420,'APPROVE - pin the slice. REVISE - name the one thing that breaks the taste. HOLD - the phone or play test fails.',385,14,20,WHITE,True)
para(manual,502,y-20,'No A/B toggle maze or long form to complete.',385,12,17,MUTED)
card(manual,42,62,876,164)
label(manual,62,195,'Ask the skill to do the next cycle')
para(manual,62,168,'"Use shard-checkpoints on the next small pocket. Bring me one portrait target / before / current board, a playable link, the phone reading, and the one decision you need from me."',826,13,19,WHITE,True)
para(manual,62,102,'If the slice is not yet stable or looks rough, the agent keeps polishing that slice instead of opening a new area.',826,12,17,MUTED)
manual.save()

print(OUT/'nine-dragon-imaginary-play-by-play.pdf')
print(OUT/'shard-checkpoints-user-guide.pdf')
