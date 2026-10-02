#!/usr/bin/env python3
"""Throwaway (E359, D70): Thin Ice's content, structure C ("lights open the ice"), as four boards on the approved map:
the journey (stages, lit lanes, steps), the quest chain, the side content, the slice."""
import json, math, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = Image.open(os.path.join(HERE, 'out', 'p5r2-map.jpg')).convert('RGB')
N = MAP.width
k = N / 500
P = lambda x, z: ((x + 250) * k, (z + 250) * k)
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', s)
AMBER, TEAL, VIOLET, GOLD, WHITE, DIM = (232, 163, 58), (90, 225, 200), (190, 130, 255), (255, 214, 102), (232, 241, 245), (190, 205, 215)
STAGE_COL = {1: AMBER, 2: TEAL, 3: VIOLET, 4: GOLD}
PLACES = {'landing': (-70, 215), 'village': (-40, 110), 'quarry': (-150, 120), 'tower': (175, 60), 'overlook': (200, -20),
          'glacier': (140, -110), 'glacier top': (175, -150), 'lighthouse': (-11, -214), 'icecave': (-170, -60),
          'spring': (-200, -190), 'spire': (37, -43), 'ferry line': (60, 75)}
LANES = {  # stage: polyline (map coords)
 1: [(-15, 92), (40, 70), (100, 62), (160, 58)],          # the south lane: village pier <-> signal tower (beacon 1)
 2: [(95, -92), (40, -120), (-5, -160), (-15, -192)],     # the north-east lane: glacier foot <-> lighthouse (beacon 2)
 3: [(-25, -175), (-80, -120), (-140, -75)],               # the west lane: lighthouse <-> ice cave (beacon 3)
 4: [(40, 70), (38, 0), (37, -30)],                        # the centre lane to the spire (all three lit)
}
MAIN = [  # (stage, place, title, why / what, gets)
 (1, 'landing', 'SOUTH LANDING', 'Arrive at the spawn beacon. Across the bay the ice groans; a lantern burns in the village.', ''),
 (1, 'village', "FERRYMAN'S VILLAGE", 'Sigrun, the last lamp-keeper: the ice took the ferry, the drowned bell tolls each night and the ice cracks a little more. The old beacons kept the lanes safe. Light them.', 'the harpoon'),
 (1, 'quarry', 'THE OLD QUARRY', 'The beacon oil is stored in the quarry, and ice crawlers nest in the pit. First fight.', 'lamp oil'),
 (1, 'ferry line', 'THE OLD FERRY LINE', 'Grab the old ferry rope: holding it is the only safe way over unlit ice, and cracks spread around you as you haul across. The hoverboard won\'t run on ice.', ''),
 (1, 'tower', 'SIGNAL TOWER · BEACON 1', 'Relight the brazier: the SOUTH LANE glows across the bay. Sigrun\'s sled-board waits at the tower: fast, but it rides lit lanes only.', 'the sled-board'),
 (2, 'overlook', 'CLIFF OVERLOOK', 'Survey the bay: the two dark beacons, the spire and the frozen ferry wreck are marked on your map and minimap. The goal, revealed.', ''),
 (2, 'glacier', 'GLACIER MOUTH', 'Climb onto the glacier: a switchback trail and rope ladders up the ice cliff, crevasses to jump.', ''),
 (2, 'glacier top', 'THE GLACIER BEACON · BEACON 2', 'Light the cairn fire on the ice field: the NORTH-EAST LANE glows to the lighthouse. The bell\'s clapper lies frozen in a crevasse; a crawler queen guards it.', 'the clapper'),
 (3, 'lighthouse', 'THE LIGHTHOUSE · BEACON 3', 'Sled the north-east lane, climb the spiral stair, relight the lamp: the WEST LANE glows, and the beam sweeps the bay and shows the drowned streets around the spire.', ''),
 (3, 'icecave', 'THE ICE CAVE', 'Down the west lane, a hidden crack into the glacier wall: the frozen chapel and its bell rope.', 'the bell rope'),
 (4, 'spire', 'THE DROWNED SPIRE', 'All three lanes lit, the CENTRE LANE opens. Hang the clapper and the rope, ring the drowned bell: the Bellkeeper breaks the ice. Boss fight on the ring of cracked ice.', ''),
 (4, 'village', 'HOME', 'The bell is silent; the ice holds. Sigrun relights the ferry lantern.', ''),
]
SIDE = [  # kind, map xy, label, text
 ('S1', (-200, -190), 'HOT SPRING · THE HUNTER', 'Old Brann camps at the spring: bring 3 crawler shells, get a fur cloak (warmth: slower cold drain on the ice).'),
 ('S2', (-30, -225), 'THE LOST FERRY', 'The ferry is frozen under the north mouth. Seen only in the lighthouse beam; dig out the ferryman\'s lantern (wider light).'),
 ('S3', (-150, 120), 'THE QUARRY LEDGER', 'Pages of the quarry ledger in the pit tell how the church was drowned for its stone.'),
 ('F1', (60, 66), 'FEAT · BAY RUN', 'The south lane on the sled-board under 60 s.'),
 ('F2', (60, -110), 'FEAT · NO FALL', 'Light all three beacons without breaking through the ice.'),
 ('F3', (140, -120), 'FEAT · CRAWLER HUNTER', 'Harpoon 20 ice crawlers.'),
 ('K', (37, -43), 'KEEPSAKES ×8', 'Drowned keepsakes in the ice round the spire, lit only by the lighthouse beam.'),
 ('X', (200, -20), 'CACHE', 'A frozen cache under the overlook ledge (a rope down).'),
 ('H1', (37, -43), 'HAPPENING · THE BELL', 'At night the bell tolls under the ice: rings of cracks spread from the spire.'),
 ('H2', (60, 20), 'HAPPENING · THE CRACK', 'A crack races across the bay: unlit lanes break.'),
 ('E', (-150, 120), 'ICE CRAWLERS', 'Quarry pit, glacier crevasses (and the queen).'),
 ('E', (150, 30), 'ICE BEARS', 'East road forest, west trail.'),
]
SLICE = [('0:00', 'South Landing', 'arrive'), ('1:00', "Ferryman's Village", 'Sigrun, the harpoon'), ('3:00', 'The Old Quarry', 'crawler fight, lamp oil'),
         ('7:00', 'The Old Ferry Line', 'thin-ice crossing on foot'), ('10:00', 'Signal Tower', 'beacon 1, the south lane lights, the sled-board'),
         ('12:00', 'The Bay Run', 'sled back along the lit lane to the village'), ('14:00', 'END', 'the slice ends at the pier')]


def base(dim=0.25):
    im = Image.blend(MAP, Image.new('RGB', MAP.size, (6, 14, 22)), dim)
    return im


def lane(d, pts, col, w=10):
    xy = [P(*p) for p in pts]
    for wd, a in ((w + 14, 60), (w + 6, 120), (w, 255)):
        d.line(xy, fill=col + (a,), width=wd, joint='curve')


def dot(d, xy, label, col, r=24, fs=28):
    x, y = xy
    d.ellipse([x - r, y - r, x + r, y + r], fill=(13, 27, 38, 255), outline=col + (255,), width=4)
    f = F(fs)
    d.text((x - d.textlength(label, font=f) / 2, y - fs * 0.62), label, fill=WHITE + (255,), font=f)


def panel(board, x0, title, sub, rows, width):
    d = ImageDraw.Draw(board)
    d.text((x0, 30), title, fill=(143, 227, 255), font=F(34))
    d.text((x0, 76), sub, fill=AMBER, font=F(22))
    y = 128
    for head, body, col in rows:
        d.text((x0, y), head, fill=col, font=F(25))
        words, line, lines = body.split(), '', []
        for w in words:
            if d.textlength((line + ' ' + w).strip(), font=F(21)) > width - 90:
                lines.append(line); line = w
            else:
                line = (line + ' ' + w).strip()
        if line: lines.append(line)
        for j, l in enumerate(lines):
            d.text((x0 + 40, y + 33 + j * 26), l, fill=DIM, font=F(21))
        y += 33 + len(lines) * 26 + 16
    return y


def save(im, name, title, sub, rows, width=1150):
    board = Image.new('RGB', (N + width, max(N, 1254)), (13, 27, 38))
    board.paste(im, (0, 0))
    panel(board, N + 36, title, sub, rows, width)
    board.save(os.path.join(HERE, 'out', name), quality=90)
    print(name, board.size)


# 1 · the journey
im = base().convert('RGBA'); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
for st, pts in LANES.items():
    lane(d, pts, STAGE_COL[st])
d.line([P(-15, 92), P(60, 75), P(160, 58)], fill=(255, 255, 255, 140), width=3)   # the old ferry rope
for xy, lab in (((175, 60), 'B1'), ((175, -150), 'B2'), ((-11, -214), 'B3')):
    x, y = P(*xy)
    d.regular_polygon((x, y, 30), 6, fill=(255, 214, 102, 255), outline=(13, 27, 38, 255))
    d.text((x - 16, y - 14), lab, fill=(13, 27, 38, 255), font=F(24))
seen = {}
for i, (st, pl, *_), in enumerate(MAIN, 1):
    x, y = P(*PLACES[pl]); o = seen.get(pl, 0); seen[pl] = o + 1
    dot(d, (x + o * 50 + (40 if pl in ('tower', 'lighthouse') else 0), y + (40 if pl == 'glacier top' else 0)), str(i), STAGE_COL[st])
im = Image.alpha_composite(im, ov).convert('RGB')
rows = [(f'{i:>2} · {t}', w + (f'  → {g}' if g else ''), STAGE_COL[st]) for i, (st, pl, t, w, g) in enumerate(MAIN, 1)]
save(im, 'content-c-1-journey.jpg', 'THIN ICE · C · LIGHTS OPEN THE ICE', 'amber: stage 1 (south) · teal: stage 2 (north-east) · violet: stage 3 (west) · gold: the spire', rows)

# 2 · the quest chain (the story beats, by stage)
STAGES = [
 (1, 'STAGE 1 · THE SOUTH LANE', 'The ice is thin and dark. Sigrun gives the harpoon; oil from the crawler-filled quarry; a tense walk along the old ferry rope; the signal tower burns and the south lane glows. The sled-board makes the bay fast.'),
 (2, 'STAGE 2 · THE NORTH-EAST LANE', 'From the east shore the overlook shows the goal. Climb onto the glacier, cross crevasses, light the cairn fire; take the clapper from the crawler queen. The lane to the lighthouse glows.'),
 (3, 'STAGE 3 · THE WEST LANE', 'Relight the lighthouse: its beam sweeps the bay, shows the drowned streets and the keepsakes, and lights the west lane to the ice cave, where the bell rope hangs in a frozen chapel.'),
 (4, 'FINALE · THE CENTRE LANE', 'Three beacons burn; the centre lane opens to the spire. Ring the bell with its clapper and rope: the Bellkeeper breaks the ice. The fight circles the cathedral spire on a ring of cracked ice; the lit lanes are safe ground.'),
 (0, 'WHY THE PLAYER GOES', 'Every stage ends with a new lit lane you can see from far away: the next goal is always in sight, and the bay opens like a map being drawn.'),
 (0, 'THE ANTAGONIST', 'The Bellkeeper, coiled round the drowned church, tolls the bell each night to crack the ice and take the village. Ringing the bell yourself, with its own clapper and rope, calls it up to fight.'),
]
im = base(0.35).convert('RGBA'); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
for st, pts in LANES.items():
    lane(d, pts, STAGE_COL[st], 8)
im = Image.alpha_composite(im, ov).convert('RGB')
save(im, 'content-c-2-quests.jpg', 'THIN ICE · THE QUEST CHAIN', 'main quest "The Drowned Bell", in four stages', [(t, b, STAGE_COL.get(s, WHITE)) for s, t, b in STAGES])

# 3 · side content
im = base(0.35).convert('RGBA'); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
COLK = {'S': (255, 140, 120), 'F': (140, 220, 255), 'K': GOLD, 'X': GOLD, 'H': (255, 255, 255), 'E': (255, 90, 90)}
seen = {}
for kind, (x, z), lab, _ in SIDE:
    px, py = P(x, z); o = seen.get((x, z), 0); seen[(x, z)] = o + 1
    dot(d, (px + o * 54, py - o * 10), kind, COLK[kind[0]], r=26, fs=22)
im = Image.alpha_composite(im, ov).convert('RGB')
save(im, 'content-c-3-side.jpg', 'THIN ICE · SIDE CONTENT', 'S side quests · F feats · K/X secrets · H happenings · E enemies', [(f'{k} · {l}', t, COLK[k[0]]) for k, _, l, t in SIDE])

# 4 · the slice
im = base(0.45).convert('RGBA'); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
sp = [PLACES['landing'], PLACES['village'], PLACES['quarry'], PLACES['village'], (-15, 92), PLACES['ferry line'], PLACES['tower']]
d.line([P(*p) for p in sp], fill=(255, 255, 255, 230), width=6)
lane(d, LANES[1], AMBER)
for i, (pl) in enumerate(['landing', 'village', 'quarry', 'ferry line', 'tower'], 1):
    dot(d, P(*PLACES[pl]), str(i), AMBER)
dot(d, P(-15, 92), '6', AMBER)
im = Image.alpha_composite(im, ov).convert('RGB')
save(im, 'content-c-4-slice.jpg', 'THIN ICE · THE SESSION SLICE (P9)', 'what you play in grey on your phone, ~14 min', [(f'{t} · {p}', w, AMBER) for t, p, w in SLICE])
