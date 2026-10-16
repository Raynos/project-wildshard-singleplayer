# Extends ../effort-recount-2026-10-09/commits.py: every commit since the plan started, its time, the shards it serves
# (paths, names in the subject, and now Conventional Commits scopes) and whether it is port work.
# Port: the 10-09 pattern (SHARD-PLATFORM rows, M3, G285) for the old subjects; since the Conventional Commits switch
# (E476, 10-11) every commit that serves a shard and is not docs-only counts (the waves fold grid-ready into the port).
#   python3 commits.py <scratch dir>      (writes <scratch>/commits.json)
import json, re, subprocess, sys
SP = sys.argv[1]
REPO = '/Users/raynos/projects/games/wildshard-singleplayer'
SLUGS = ['_template', 'blender-template', 'driftwood-isle', 'far-reach', 'nalati-grasslands', 'nine-dragon-stack', 'pine-hollow', 'sunscar-dunes']
NAMES = {
    '_template': r'\bTemplate 1\b|\btemplate\b(?!-2| 2)|_template|SF52|SF56|SF16\b',
    'blender-template': r'Blender Template|blender-template|Template 2|SF55',
    'driftwood-isle': r'Driftwood|SF46|^\w+\((?:dw|driftwood)\)',
    'far-reach': r'Sky Reach|\bSky\b|far-reach|Rising Islet|\bRoc\b|SF49|^\w+\(sky\)',
    'nalati-grasslands': r'Nalati|SF48|^\w+\(nalati\)',
    'nine-dragon-stack': r'Nine Dragon|\bNine\b|nine-dragon|SF51|^\w+\(nine\)',
    'pine-hollow': r'Pine|SF47|^\w+\(pine\)',
    'sunscar-dunes': r'Signal|Sunscar|sunscar|Matriarch|SF50|^\w+\((?:signal|dunes)\)',
}
PORT = re.compile(r'SF72|SF73|SF54|SF2[4-9]\b|SF3[0-8]\b|SF4[5-9]-p|SF5[01]-p|SF[0-9]\b|SF1[0-6][a-z]?\b|SF8[a-z]|SF6b|-p\b|witness|headless|offline bake|M3[ :]|G285|hybrid-rows')
CONVENTIONAL = re.compile(r'^(\w+)(\([^)]*\))?!?: ')
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
    cc = CONVENTIONAL.match(subj)
    port = bool(PORT.search(subj)) or bool(cc and cc.group(1) != 'docs')
    commits.append({'sha': sha, 't': int(ct), 'subj': subj, 'shards': sorted(shards), 'port': port,
                    'platform': subj.startswith('SHARD-PLATFORM') or bool(cc), 'nfiles': len(files)})
json.dump(commits, open(f'{SP}/commits.json', 'w'))
print(len(commits), sum(c['port'] for c in commits), sum(c['platform'] for c in commits))
