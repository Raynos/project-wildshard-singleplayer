"""TRAILERS T15 V1 (E471): replay a real asciinema recording of Claude Code into screen snapshots for glyphs.html.

  <venv with pyte>/bin/python cast_frames.py <session.cast> <frames.js>

Every output event is fed to a pyte terminal of the recording's size; each changed screen becomes a snapshot
{t, rows: [text], fg: [[colour per cell]]}. The marks the page times its beats on are found in the text: `ui` (the
prompt box is up), `type0` / `type1` (the first and last typed character of the prompt), `done` (Claude Code's
"Churned for" line). Written as `window.CAST = {...}` so the page loads it from file:// without fetch.
"""
import json, re, sys
import pyte

cast, out = sys.argv[1], sys.argv[2]
lines = open(cast).read().strip().split('\n')
head = json.loads(lines[0])
cols, rows = head['term']['cols'], head['term']['rows']
theme = head['term'].get('theme', {})
pal = theme.get('palette', '').split(':')
fg0 = theme.get('fg', '#dad3c1')
NAMES = ['black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'white']

def colour(c, bold):
    if c == 'default':
        return fg0
    if c in NAMES:
        i = NAMES.index(c) + (8 if bold else 0)
        return pal[i] if i < len(pal) else fg0
    if c.startswith('bright') and c[6:] in NAMES:
        i = NAMES.index(c[6:]) + 8
        return pal[i] if i < len(pal) else fg0
    if len(c) == 6:
        return '#' + c
    return fg0

class Screen(pyte.Screen):
    def report_device_status(self, *a, **k):  # Claude Code asks for the cursor position (CSI ? 6 n); nothing answers
        pass

scr = Screen(cols, rows)
st = pyte.ByteStream(scr)
t = 0.0
snaps, last = [], None
for l in lines[1:]:
    ev = json.loads(l)
    t += ev[0] if head.get('version') == 3 else 0
    if head.get('version') != 3:
        t = ev[0]
    if ev[1] != 'o':
        continue
    # pyte doesn't know APC (the kitty graphics probe, ESC _ G … ESC \): drop it rather than print its payload
    # nor the kitty keyboard-protocol CSI (ESC [ ? u, ESC [ > 1 u, ESC [ < u), which it prints as a stray "u"
    data = re.sub(r'\x1b_.*?\x1b\\', '', ev[2], flags=re.S)
    st.feed(re.sub(r'\x1b\[[?<>=][0-9;]*u', '', data).encode())
    text = [''.join(scr.buffer[y][x].data for x in range(cols)).replace('\u00a0', ' ') for y in range(rows)]
    # the account's usage banner is not part of the session (and is the account holder's business): blank that row
    text = [(' ' * cols if 'weekly limit' in r or 'usage limit' in r else r) for r in text]
    if text == last:
        continue
    last = text
    fg = [[colour(scr.buffer[y][x].fg, scr.buffer[y][x].bold) for x in range(cols)] for y in range(rows)]
    snaps.append({'t': round(t, 3), 'rows': text, 'fg': fg})

PROMPT = 'a small island with a crooked lighthouse and a toon sea'
def first(pred, start=0):
    for i in range(start, len(snaps)):
        if pred('\n'.join(snaps[i]['rows'])):
            return i
    return None
ui = first(lambda s: 'accept edits on' in s and 'Quick safety check' not in s)
type0 = first(lambda s: '❯ a' in s, ui)
type1 = first(lambda s: PROMPT in s, type0)
done = first(lambda s: 'Churned for' in s, type1)
exit_ = first(lambda s: '/exit' in s, done) or len(snaps)
snaps = snaps[ui:exit_]
marks = {k: snaps[i - ui]['t'] for k, i in (('ui', ui), ('type0', type0), ('type1', type1), ('done', done))}
# colours compressed: a palette and indices
cols_set = sorted({c for s in snaps for row in s['fg'] for c in row})
ci = {c: i for i, c in enumerate(cols_set)}
for s in snaps:
    s['fg'] = [''.join(chr(48 + ci[c]) for c in row) for row in s['fg']]
open(out, 'w').write('window.CAST = ' + json.dumps({'cols': cols, 'rows': rows, 'bg': theme.get('bg', '#191411'),
                                                      'palette': cols_set, 'marks': marks, 'snaps': snaps}) + ';\n')
print(f'{len(snaps)} snapshots, marks {marks}, {len(cols_set)} colours')
