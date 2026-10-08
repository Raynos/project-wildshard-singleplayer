"""E456: draw one portrait itemized-memory infographic per situation, plus a side-by-side summary (PIL, exact text)."""
import json
import math
import pathlib

from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
DATA = json.loads((HERE / 'itemized.json').read_text())
MB = 1e6
W, H = 1100, 2400
SURFACE = (252, 252, 251)
INK, INK2, INK3 = (11, 11, 11), (82, 81, 78), (140, 139, 134)
CRIT = (200, 48, 48)
OWNER_COLOR = {
    'Engine & game': (42, 120, 214), 'Platform': (235, 104, 52), 'Driftwood': (27, 175, 122), 'Pine Hollow': (27, 175, 122),
    'Nalati': (27, 175, 122), 'Kit & player': (237, 161, 0), 'Browser & OS': (74, 58, 167), 'Unknown owner': (150, 149, 144),
}
UNATTRIBUTED = (222, 221, 216)
SHORT = {'Engine & game': 'Engine', 'Platform': 'Platform', 'Kit & player': 'Kit', 'Browser & OS': 'Browser/OS',
         'Unknown owner': 'Unknown', 'Driftwood': 'Driftwood', 'Pine Hollow': 'Pine', 'Nalati': 'Nalati'}
OWNER_ORDER = ['Platform', 'Engine & game', 'Driftwood', 'Pine Hollow', 'Nalati', 'Kit & player', 'Browser & OS', 'Unknown owner']
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = lambda size, bold=False: ImageFont.truetype(BOLD if bold else FONT, size)
CAP = 1000
SCALE_MAX = 1300  # MB at the top of every situation bar, so bars compare across images

TAKEAWAYS = {
    '1-grid-home': ['Before entering any shard: 805 MB. The road, plots and signs already',
                    'cost 76 MB, and 415 MB of RAM has no measured owner.'],
    '2-pine-centre': ['185 MB over the cap. Pine content is 208 MB; the platform 81 MB;',
                      'audio PCM 112 MB (est.); 457 MB of RAM has no measured owner.'],
    '3-nalati-centre': ['101 MB over the cap. Nalati content is 277 MB (GPU 158);',
                        'the platform 80 MB; 339 MB of RAM has no measured owner.'],
    '4-engine-base': ['The engine alone is ~300 MB: 80 MB of 2x render targets on the GPU,',
                      '46 MB browser floor, 165 MB of engine RAM never split by owner.'],
    '5-road-after-nalati': ['No shard is loaded, yet the tab holds 933 MB: RAM stayed at 813 MB',
                            'after Nalati left. 423 MB has no owner; 100 MB is live audio + images.'],
}


def mb(b):
    v = b / MB
    return f'{v:.0f} MB' if v >= 100 else f'{v:.1f} MB'


def hatch(draw, box, color, step=9):
    x0, y0, x1, y1 = box
    for k in range(int(x0 - (y1 - y0)), int(x1), step):
        draw.line([(max(x0, k), y0 + max(0, x0 - k)), (min(x1, k + (y1 - y0)), y1 - max(0, k + (y1 - y0) - x1))], fill=color, width=2)


def text_w(d, s, f):
    return d.textlength(s, font=f)


def fit(d, s, f, width):
    if text_w(d, s, f) <= width:
        return s
    while s and text_w(d, s + '…', f) > width:
        s = s[:-1]
    return s + '…'


def merge_small(blocks, threshold=4 * MB):
    """Keep each block <= 50 MB; fold blocks under the threshold into one per (side, owner, conf)."""
    out, small = [], {}
    for b in blocks:
        if b['bytes'] < threshold and b['conf'] != 'U':
            key = (b['side'], b['owner'], b['conf'])
            small.setdefault(key, []).append(b)
        else:
            out.append(dict(b))
    for (side, owner, conf), items in small.items():
        total = sum(i['bytes'] for i in items)
        if total <= 0:
            continue
        name = items[0]['system'] if len(items) == 1 else f'{len(items)} small items'
        out.append(dict(side=side, owner=owner, conf=conf, bytes=total, system=name, merged=[i['system'] for i in items]))
    return out


def order(blocks):
    conf_rank = {'M': 0, 'E': 1, 'U': 2}
    return sorted(blocks, key=lambda b: (b['conf'] == 'U', OWNER_ORDER.index(b['owner']), conf_rank[b['conf']], -b['bytes']))


def place_labels(wanted, top, bottom, gap):
    ys = sorted(range(len(wanted)), key=lambda i: wanted[i])
    pos = [0.0] * len(wanted)
    last = top - gap
    for i in ys:
        pos[i] = max(wanted[i], last + gap)
        last = pos[i]
    over = last - bottom
    if over > 0:
        nxt = bottom + gap
        for i in reversed(ys):
            pos[i] = min(pos[i], nxt - gap)
            nxt = pos[i]
    return pos


def situation_image(s):
    img = Image.new('RGB', (W, H), SURFACE)
    d = ImageDraw.Draw(img)
    total, gpu, ram = s['totalBytes'], s['glBytes'], s['wcBytes']
    over = total / MB - CAP
    # header
    d.text((50, 40), s['title'], font=font(54, True), fill=INK)
    d.text((50, 108), s['subtitle'], font=font(26), fill=INK2)
    d.text((50, 160), f'{total / MB:.0f} MB', font=font(96, True), fill=INK)
    tw = text_w(d, f'{total / MB:.0f} MB', font(96, True))
    if over > 0:
        d.text((70 + tw, 178), f'{over:.0f} MB over the', font=font(30, True), fill=CRIT)
        d.text((70 + tw, 214), '1.0 GB cap', font=font(30, True), fill=CRIT)
    else:
        d.text((70 + tw, 178), f'{-over:.0f} MB under the', font=font(30, True), fill=INK2)
        d.text((70 + tw, 214), '1.0 GB cap', font=font(30, True), fill=INK2)
    d.text((50, 278), f'GPU {gpu / MB:.0f} MB ({gpu / total:.0%})   ·   RAM {ram / MB:.0f} MB ({ram / total:.0%})', font=font(30, True), fill=INK)
    conf = {c: sum(b['bytes'] for b in s['blocks'] if b['conf'] == c) for c in 'MEU'}
    d.text((50, 322), f'measured {conf["M"] / MB:.0f} MB  ·  estimated {conf["E"] / MB:.0f} MB  ·  unattributed {conf["U"] / MB:.0f} MB',
           font=font(26), fill=INK2)
    # bar geometry
    top, bottom = 400, 2150
    px = (bottom - top) / SCALE_MAX
    bx0, bx1 = 120, 330
    y_of = lambda v: bottom - v * px
    # 50 MB ticks
    for v in range(0, SCALE_MAX + 1, 50):
        y = y_of(v)
        major = v % 100 == 0
        d.line([(bx0 - (18 if major else 10), y), (bx0 - 2, y)], fill=INK3, width=2 if major else 1)
        if major:
            lab = f'{v}'
            d.text((bx0 - 24 - text_w(d, lab, font(18)), y - 10), lab, font=font(18), fill=INK3)
    blocks = order([b for b in merge_small(s['blocks']) if b['bytes'] >= 0.05 * MB or b['conf'] == 'U'])
    gpu_blocks = [b for b in blocks if b['side'] == 'GPU']
    ram_blocks = [b for b in blocks if b['side'] == 'RAM']
    labels = []
    cursor = 0.0
    for side_blocks in (gpu_blocks, ram_blocks):
        for b in side_blocks:
            v0, v1 = cursor, cursor + b['bytes'] / MB
            cursor = v1
            y0, y1 = y_of(v1), y_of(v0)
            box = (bx0, y0 + 1, bx1, y1 - 1) if y1 - y0 >= 3 else (bx0, y0, bx1, max(y0, y1))
            if b['conf'] == 'U':
                d.rectangle(box, fill=UNATTRIBUTED)
                k = 50
                while v0 + k < v1:
                    yy = y_of(v0 + k)
                    for xx in range(bx0, bx1, 14):
                        d.line([(xx, yy), (xx + 7, yy)], fill=INK3, width=2)
                    k += 50
            else:
                color = OWNER_COLOR[b['owner']]
                d.rectangle(box, fill=color)
                if b['conf'] == 'E':
                    hatch(d, box, SURFACE)
            labels.append((b, (y0 + y1) / 2))
        if side_blocks is gpu_blocks:
            ysplit = y_of(cursor)
            d.line([(bx0 - 4, ysplit), (bx1 + 4, ysplit)], fill=INK, width=4)
    # side brackets
    for name, v0, v1 in (('GPU', 0, gpu / MB), ('RAM', gpu / MB, total / MB)):
        y0, y1 = y_of(v1), y_of(v0)
        x = 36
        d.line([(x, y0 + 3), (x, y1 - 3)], fill=INK, width=3)
        d.line([(x, y0 + 3), (x + 10, y0 + 3)], fill=INK, width=3)
        d.line([(x, y1 - 3), (x + 10, y1 - 3)], fill=INK, width=3)
        txt = Image.new('RGBA', (300, 40), (0, 0, 0, 0))
        td = ImageDraw.Draw(txt)
        lab = f'{name} {v1 - v0:.0f} MB'
        f = font(24, True)
        td.text((0, 4), lab, font=f, fill=INK)
        lw = int(td.textlength(lab, font=f))
        txt = txt.crop((0, 0, lw + 2, 36)).rotate(90, expand=True)
        if txt.size[1] < (y1 - y0) - 8:
            img.paste(txt, (6, int((y0 + y1) / 2 - txt.size[1] / 2)), txt)
    # cap line
    yc = y_of(CAP)
    for xx in range(bx0 - 30, bx1 + 30, 22):
        d.line([(xx, yc), (xx + 12, yc)], fill=CRIT, width=4)
    capf = font(24, True)
    d.rectangle((bx0 + 8, yc - 34, bx0 + 16 + text_w(d, '1.0 GB cap', capf), yc - 6), fill=SURFACE)
    d.text((bx0 + 12, yc - 33), '1.0 GB cap', font=capf, fill=CRIT)
    # labels
    f = font(23)
    fb = font(23, True)
    gap = 31
    wanted = [y for _, y in labels]
    pos = place_labels(wanted, top + 30, bottom - 10, gap)
    lx = 380
    for (b, y), ly in zip(labels, pos):
        d.line([(bx1 + 2, y), (bx1 + 22, y), (lx - 12, ly), (lx - 4, ly)], fill=INK3, width=1)
        sw = (lx, ly - 9, lx + 18, ly + 9)
        if b['conf'] == 'U':
            d.rectangle(sw, fill=UNATTRIBUTED, outline=INK3)
            name = f'UNATTRIBUTED RAM ({b["bytes"] / MB / 50:.1f} x 50 MB)'
        else:
            d.rectangle(sw, fill=OWNER_COLOR[b['owner']])
            if b['conf'] == 'E':
                hatch(d, sw, SURFACE, step=6)
            name = f'{SHORT[b["owner"]]}: {b["system"]}' + (' (est.)' if b['conf'] == 'E' else '')
        val = mb(b['bytes'])
        vw = text_w(d, val, fb)
        d.text((W - 40 - vw, ly - 13), val, font=fb, fill=INK)
        d.text((lx + 28, ly - 13), fit(d, name, fb if b['conf'] == 'U' else f, W - 40 - vw - lx - 40), font=fb if b['conf'] == 'U' else f, fill=INK)
    # footer
    fy = 2185
    d.text((50, fy), TAKEAWAYS[s['id']][0], font=font(28, True), fill=INK)
    d.text((50, fy + 38), TAKEAWAYS[s['id']][1], font=font(28, True), fill=INK)
    ly = fy + 96
    x = 50
    for owner, label in (('Platform', 'Platform'), ('Engine & game', 'Engine & game'), ('Pine Hollow', 'Shard'),
                         ('Kit & player', 'Kit'), ('Browser & OS', 'Browser/OS'), ('Unknown owner', 'Unknown owner')):
        d.rectangle((x, ly, x + 20, ly + 20), fill=OWNER_COLOR[owner])
        d.text((x + 27, ly - 2), label, font=font(21), fill=INK2)
        x += 34 + text_w(d, label, font(21)) + 16
    ly += 34
    d.rectangle((50, ly, 70, ly + 20), fill=(150, 149, 144))
    hatch(d, (50, ly, 70, ly + 20), SURFACE, step=6)
    d.text((77, ly - 2), 'hatched = estimate (heap snapshot)', font=font(21), fill=INK2)
    d.rectangle((440, ly, 460, ly + 20), fill=UNATTRIBUTED, outline=INK3)
    d.text((467, ly - 2), 'grey = no owner measured · tick = 50 MB', font=font(21), fill=INK2)
    d.text((50, ly + 34), fit(d, f'Simulator WebContent footprint + labelled GL · build {s["pin"]} · decimal MB', font(20), W - 100),
           font=font(20), fill=INK3)
    out = HERE / f'{s["id"]}.jpg'
    img.save(out, 'JPEG', quality=86, optimize=True)
    return out


def summary_image(situations):
    img = Image.new('RGB', (W, H), SURFACE)
    d = ImageDraw.Draw(img)
    d.text((50, 40), 'Memory by situation', font=font(54, True), fill=INK)
    d.text((50, 108), 'Simulator WebContent (RAM) + labelled GL (GPU), decimal MB', font=font(26), fill=INK2)
    seq = ['4-engine-base', '1-grid-home', '5-road-after-nalati', '3-nalati-centre', '2-pine-centre']
    names = {'4-engine-base': ['Engine', 'base'], '1-grid-home': ['Grid +', 'home'], '5-road-after-nalati': ['Road after', 'Nalati'],
             '3-nalati-centre': ['Nalati', 'centre'], '2-pine-centre': ['Pine', 'centre']}
    by = {s['id']: s for s in situations}
    top, bottom = 260, 1500
    px = (bottom - top) / SCALE_MAX
    y_of = lambda v: bottom - v * px
    for v in range(0, SCALE_MAX + 1, 100):
        d.line([(110, y_of(v)), (W - 40, y_of(v))], fill=(236, 235, 231), width=1)
        d.text((100 - text_w(d, str(v), font(18)), y_of(v) - 10), str(v), font=font(18), fill=INK3)
    slot = (W - 150) / len(seq)
    cats = ['Platform', 'Engine & game', 'Shard', 'Kit & player', 'Browser & OS', 'Unknown owner', 'UNATTRIBUTED']
    table = {}
    for i, sid in enumerate(seq):
        s = by[sid]
        x0 = 130 + i * slot + 22
        x1 = x0 + slot - 44
        agg = {}
        for b in s['blocks']:
            cat = 'UNATTRIBUTED' if b['conf'] == 'U' else ('Shard' if b['owner'] in ('Driftwood', 'Pine Hollow', 'Nalati') else b['owner'])
            agg[(b['side'], cat)] = agg.get((b['side'], cat), 0) + b['bytes']
        table[sid] = agg
        cursor = 0
        for side in ('GPU', 'RAM'):
            for cat in cats:
                v = agg.get((side, cat), 0) / MB
                if v <= 0:
                    continue
                y0, y1 = y_of(cursor + v), y_of(cursor)
                color = UNATTRIBUTED if cat == 'UNATTRIBUTED' else OWNER_COLOR['Pine Hollow' if cat == 'Shard' else cat]
                d.rectangle((x0, y0 + 1, x1, y1 - 1) if y1 - y0 >= 3 else (x0, y0, x1, max(y0, y1)), fill=color)
                if v >= 28:
                    t = f'{v:.0f}'
                    tc = INK if cat in ('UNATTRIBUTED', 'Kit & player') else (255, 255, 255)
                    d.text(((x0 + x1) / 2 - text_w(d, t, font(20, True)) / 2, (y0 + y1) / 2 - 11), t, font=font(20, True), fill=tc)
                cursor += v
            if side == 'GPU':
                d.line([(x0 - 6, y_of(cursor)), (x1 + 6, y_of(cursor))], fill=INK, width=4)
        tot = s['totalBytes'] / MB
        t = f'{tot:.0f}'
        d.text(((x0 + x1) / 2 - text_w(d, t, font(30, True)) / 2, y_of(tot) - 42), t, font=font(30, True), fill=CRIT if tot > CAP else INK)
        for k, line in enumerate(names[sid]):
            d.text(((x0 + x1) / 2 - text_w(d, line, font(24, True)) / 2, bottom + 14 + k * 30), line, font=font(24, True), fill=INK)
        d.text(((x0 + x1) / 2 - text_w(d, s['pin'], font(17)) / 2, bottom + 76), s['pin'], font=font(17), fill=INK3)
    yc = y_of(CAP)
    for xx in range(110, W - 40, 22):
        d.line([(xx, yc), (xx + 12, yc)], fill=CRIT, width=3)
    d.text((112, yc - 32), '1.0 GB cap', font=font(24, True), fill=CRIT)
    d.text((50, bottom + 110), 'Below the black line in each bar: GPU. Above it: RAM.', font=font(22), fill=INK2)
    # table
    ty = bottom + 160
    d.text((50, ty), 'MB by owner (GPU + RAM)', font=font(30, True), fill=INK)
    ty += 50
    colx = [50, 440, 560, 680, 800, 920]
    hdr = ['', 'Eng. base', 'Grid+home', 'Road after', 'Nalati', 'Pine']
    for x, h in zip(colx, hdr):
        d.text((x, ty), h, font=font(21, True), fill=INK2)
    ty += 36
    rows = [('Platform (road, plots, signs, screens)', 'Platform'), ('Engine & game', 'Engine & game'), ('The shard itself', 'Shard'),
            ('Kit & player (held items)', 'Kit & player'), ('Browser & OS', 'Browser & OS'), ('Unknown owner (labelled)', 'Unknown owner'),
            ('Unattributed RAM (no owner)', 'UNATTRIBUTED')]
    for label, cat in rows:
        color = UNATTRIBUTED if cat == 'UNATTRIBUTED' else OWNER_COLOR['Pine Hollow' if cat == 'Shard' else cat]
        d.rectangle((50, ty + 3, 70, ty + 23), fill=color)
        d.text((80, ty), label, font=font(21), fill=INK)
        for x, sid in zip(colx[1:], seq):
            v = sum(val for (side, c), val in table[sid].items() if c == cat) / MB
            t = f'{v:.0f}' if v >= 0.5 else '–'
            d.text((x + 80 - text_w(d, t, font(22, True)), ty), t, font=font(22, True), fill=INK)
        ty += 36
    d.line([(50, ty), (W - 50, ty)], fill=INK3, width=1)
    ty += 8
    for label, key in (('GPU total', 'glBytes'), ('RAM total', 'wcBytes'), ('Total', 'totalBytes')):
        d.text((80, ty), label, font=font(21, True), fill=INK)
        for x, sid in zip(colx[1:], seq):
            t = f'{by[sid][key] / MB:.0f}'
            d.text((x + 80 - text_w(d, t, font(22, True)), ty), t, font=font(22, True), fill=INK)
        ty += 36
    ty += 18
    lines = ['After leaving Nalati, tab RAM stays at 813 MB with no shard loaded:',
             '204 MB more than at home before the visit (609 MB).',
             'On the grid, 339-457 MB of RAM has no measured owner.',
             'The platform costs 76-84 MB in every grid situation.']
    for line in lines:
        d.text((50, ty), line, font=font(26, True), fill=INK)
        ty += 36
    d.text((50, ty + 10), 'Pins differ per bar (shown under each); engine base is the older SF22a template reading.', font=font(20), fill=INK3)
    out = HERE / 'summary.jpg'
    img.save(out, 'JPEG', quality=86, optimize=True)
    return out


if __name__ == '__main__':
    for s in DATA['situations']:
        p = situation_image(s)
        print(p.name, p.stat().st_size)
    p = summary_image(DATA['situations'])
    print(p.name, p.stat().st_size)
