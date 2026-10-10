#!/usr/bin/env python3
"""mixbuild.py — the progress trailer's mix.json for the shared scripts/steam-trailer/mix.py (PROGRESS-TRAILER §3.4, PT8).

    python3 scripts/progress-trailer/mixbuild.py <config.json> <mix.json>

config: { work, sfx (the PT8 sound dir: era/<sha8>/…, files/<dNN|head>/…, trailer-reuse/tr-*.wav, sfx-best/tr-*.wav), score
(wav), music_hit (the score's drop, s), edl (assemble.mjs's edl.json), rewind_takes [4 take dirs, day 1 → 22], rewind_from (s),
receipts (receipts.mjs's receipts.json: the breath's key times), lapse_stages { <clip shot>: [stage t0 …] } }
Each play clip gets its take's own recorded sound (era/<sha8>/take-<shot>.wav, whose t = 0.5 s lead + take time), trimmed to
the clip's in-point and length; each lapse its build's bed, low; the rewind the four builds' beds swapped at its cuts, the
build's own crossbow shot, the trailer riser peaking on the kill, the kill, a trailer impact and sub drop; the breath ducks
the score to near-silence; the score's in-point puts its drop on the rewind's kill. Era-true (§2.3): no generated sound
stands in for a sound a build makes.
"""
import json, os, subprocess, sys

cfg = json.load(open(sys.argv[1]))
out = sys.argv[2]
W, S = cfg['work'], cfg['sfx']
edl = json.load(open(cfg['edl']))
os.makedirs(os.path.join(W, 'mixparts'), exist_ok=True)


def trim(src, t0, dur, name, fade=0.04):
    dst = os.path.join(W, 'mixparts', name + '.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0, t0):.4f}', '-i', src, '-t', f'{dur:.4f}', '-af',
                    f'afade=t=in:d={fade},afade=t=out:st={max(0, dur - fade):.4f}:d={fade}', '-ar', '48000', '-ac', '2', dst], check=True)
    return dst


SHA8 = {'d01-hunt': '568a1463', 'w1-combo': '2d2c5815', 'd15-square': '19a43463', 'w2-gallop': '19a43463', 'w3-hover': 'c9aaa62a', 'w3-whip': 'c9aaa62a'}
BEDS = {'lapse-driftwood': f'{S}/era/2d2c5815/bed.wav', 'lapse-pine-hollow': f'{S}/files/d15/forest--bed-forest-2-0cd11be5.wav',
        'lapse-sky-reach': f'{S}/files/d15/highwind--bed-highwind-1-95937f84.wav', 'lapse-nine-dragon': f'{S}/files/d15/forest--bed-forest-2-0cd11be5.wav'}
events, beds, duck = [], [], []
length = max(c['at'] + c['dur'] for c in edl['clips'])

# the rewind's screen times: replay its ramp (cut-rewind.py's sample_times) to find the cuts and the kill on screen
rec = [json.load(open(os.path.join(d, 'receipt.json'))) for d in cfg['rewind_takes']]
r = rec[-1]
ramp, sub = r['ramp'], r['sub']
def speed_at(t):
    if t <= ramp[0][0]:
        return ramp[0][1]
    for (t0, s0), (t1, s1) in zip(ramp, ramp[1:]):
        if t <= t1:
            return s0 + (s1 - s0) * (t - t0) / (t1 - t0)
    return ramp[-1][1]
def screen(t_sim, start):
    t, s = start, 0.0
    while t < t_sim:
        t += speed_at(t) / (60 * sub); s += 1 / (60 * sub)
    return s
fire = next(e['t'] for e in r['events'] if e['e'] == 'fire') - r['simStart']
kill = next(e['t'] for e in r['events'] if e['e'] == 'kill') - r['simStart']
rw = next(c for c in edl['clips'] if c['shot'] == 'rewind')
start = cfg.get('rewind_from', 0.25)
cuts = [screen(fire + d / 62, start) for d in (2, 4, 6)]
kill_at = rw['at'] + screen(kill, start)
fire_at = rw['at'] + screen(fire, start)
print(f'rewind: fire {fire_at:.2f} s, cuts {[round(rw["at"] + c, 2) for c in cuts]}, kill {kill_at:.2f} s')

for c in edl['clips']:
    if c['shot'] in SHA8:
        src = f"{S}/era/{SHA8[c['shot']]}/take-{c['shot']}.wav"
        events.append({'sound': trim(src, 0.5 + c['in'], c['dur'], c['shot']), 'at': c['at'], 'gain_db': -4})
    elif c['shot'] in BEDS and os.path.exists(BEDS[c['shot']]):
        beds.append({'sound': BEDS[c['shot']], 'at': c['at'], 'dur': c['dur'], 'gain_db': -16, 'fade': 0.4})

# the rewind: each build's bed under its segment, then day 22's to the end
seg = [rw['at']] + [rw['at'] + c for c in cuts] + [rw['at'] + rw['dur']]
for k, sha in enumerate(['568a1463', '2d2c5815', '19a43463', 'c9aaa62a']):
    beds.append({'sound': f'{S}/era/{sha}/bed-rewind.wav', 'at': seg[k], 'dur': seg[k + 1] - seg[k], 'gain_db': -8, 'fade': 0.02})
events += [
    {'sound': f'{S}/era/568a1463/crossbowFire.wav', 'at': fire_at, 'gain_db': -2},
    {'sound': f'{S}/trailer-reuse/tr-riser.wav', 'at': kill_at, 'peak': 'auto', 'gain_db': -6},
    {'sound': f'{S}/files/d22/kill--kill-3-5f7ea225.wav', 'at': kill_at, 'gain_db': 0},
    {'sound': f'{S}/files/d22/boltImpact-flesh--boltImpact-flesh-2-13ed7f2c.wav', 'at': kill_at, 'gain_db': 0},
    {'sound': f'{S}/trailer-reuse/tr-impact.wav', 'at': kill_at, 'gain_db': -2},
    {'sound': f'{S}/trailer-reuse/tr-subdrop.wav', 'at': kill_at, 'gain_db': -4},
    {'sound': f'{S}/sfx-best/tr-subswell-rev.wav', 'at': fire_at, 'gain_db': -8},
    # the cold open: today's build's own grapple sounds (feizhua.*, extracted from HEAD's sprite) on the take's beats
    {'sound': f'{S}/files/head/feizhua.fire--feizhua.fire-2-b084bf8c.wav', 'at': 0.24, 'gain_db': -2},
    {'sound': f'{S}/files/head/feizhua.zip--feizhua.zip-3-00c1262f.wav', 'at': 0.32, 'gain_db': -4},
    {'sound': f'{S}/files/head/feizhua.bite--feizhua.bite-1-cf340fc8.wav', 'at': 0.7, 'gain_db': -4},
    {'sound': f'{S}/files/head/feizhua.reel--feizhua.reel-1-62feefcb.wav', 'at': 0.78, 'gain_db': -5},
    {'sound': f'{S}/files/head/feizhua.dock--feizhua.dock-2-6669a863.wav', 'at': 1.9, 'gain_db': -3},
    {'sound': f'{S}/files/head/land-hard--land-hard-3-5aed2a6b.wav', 'at': 1.97, 'gain_db': -4},
]
beds.append({'sound': f'{S}/files/head/nd.well--bed.nd.well-1-ccb30904.wav', 'at': 0, 'dur': 2.0, 'gain_db': -14, 'fade': 0.1})
# a soft tick on every lapse stage swap (§3.3), and the breath's keyclicks on its typed keys (receipts.json)
for c in edl['clips']:
    for t0 in cfg.get('lapse_stages', {}).get(c['shot'], [])[1:]:
        events.append({'sound': f'{S}/sfx-best/tr-tick.wav', 'at': c['at'] + t0, 'gain_db': -10})
breath_at = next(t['at'] for t in edl['titles'] if t['id'] == 'breath')
for k in json.load(open(cfg['receipts']))['breath']['keys']:
    events.append({'sound': f"{S}/sfx-best/{'tr-keyclick' if k['ch'] != ' ' else 'tr-keyclick-alt'}.wav", 'at': breath_at + k['t'], 'gain_db': -9})
for e in events:
    if e.get('peak') == 'auto':
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', e['sound']], capture_output=True, text=True).stdout)
        e['peak'] = round(dur * 0.92, 3)
breath = next(t['at'] for t in edl['titles'] if t['id'] == 'breath')
duck.append({'at': breath, 'dur': 2.0, 'db': -40})
music_in = max(0.0, cfg['music_hit'] - kill_at)
mix = {'length': round(length, 3),
       'music': {'file': cfg['score'], 'segments': [[music_in, music_in + length, 0]], 'gain_db': -2,
                 'fades': [[0, 0.5, 'in'], [length - 2.5, 2.5, 'out']]},
       'beds': beds, 'events': events, 'duck': duck}
json.dump(mix, open(out, 'w'), indent=1)
print(f'{out}: {len(beds)} beds, {len(events)} events, music in-point {music_in:.2f} s')
