# Every commit since the plan started: time, subject, the shards it serves (paths + names in the subject), port-or-not.
import json, re, subprocess
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad'
REPO = '/Users/raynos/projects/games/wildshard-singleplayer'
SLUGS = ['_template', 'blender-template', 'driftwood-isle', 'far-reach', 'nalati-grasslands', 'nine-dragon-stack', 'pine-hollow', 'sunscar-dunes']
NAMES = {
    '_template': r'\bTemplate 1\b|\btemplate\b(?!-2| 2)|_template|SF52|SF56|SF16\b',
    'blender-template': r'Blender Template|blender-template|Template 2|SF55',
    'driftwood-isle': r'Driftwood|SF46',
    'far-reach': r'Sky Reach|\bSky\b|far-reach|Rising Islet|\bRoc\b|SF49',
    'nalati-grasslands': r'Nalati|SF48',
    'nine-dragon-stack': r'Nine Dragon|\bNine\b|nine-dragon|SF51',
    'pine-hollow': r'Pine|SF47',
    'sunscar-dunes': r'Signal|Sunscar|sunscar|Matriarch|SF50',
}
# rows whose work is the 80/20 port (behaviour, witnesses, public moves, shared systems), vs grid-ready / memory / look / process
PORT = re.compile(r'SF72|SF73|SF54|SF2[4-9]\b|SF3[0-8]\b|SF4[5-9]-p|SF5[01]-p|SF[0-9]\b|SF1[0-6][a-z]?\b|SF8[a-z]|SF6b|-p\b|witness|headless|offline bake|M3 |hybrid-rows')
raw = subprocess.run(['git', '-C', REPO, 'log', '--since=2026-10-03', '--format=@@%H|%ct|%s', '--name-only'], capture_output=True, text=True).stdout
commits = []
for block in raw.split('@@')[1:]:
    head, *files = [l for l in block.split('\n') if l.strip()]
    sha, ct, subj = head.split('|', 2)
    shards = set()
    for f in files:
        m = re.match(r'(?:src/shards|test/proof|art|public/assets|progress)/([^/]+)/', f)
        if m and m.group(1) in SLUGS: shards.add(m.group(1))
    for s, rx in NAMES.items():
        if re.search(rx, subj): shards.add(s)
    commits.append({'sha': sha, 't': int(ct), 'subj': subj, 'shards': sorted(shards), 'port': bool(PORT.search(subj)),
                    'platform': subj.startswith('SHARD-PLATFORM'), 'nfiles': len(files)})
json.dump(commits, open(f'{SP}/commits.json', 'w'))
print(len(commits), sum(c['port'] for c in commits), sum(c['platform'] for c in commits))
