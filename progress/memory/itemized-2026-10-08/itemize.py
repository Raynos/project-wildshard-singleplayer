"""E456: itemize each measured situation (Simulator WebContent footprint + labelled GL) into owner blocks.

Reads only committed receipts (plus evidence/ copied with its committed SHA-256). Writes itemized.json.
Every block carries a confidence: M = measured in the same run and pose, E = estimate transplanted from a
heap snapshot of another process / pin, U = unattributed remainder. Decimal MB throughout.
"""
import gzip
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
MEM = HERE.parent
G = MEM / 'g227-budget'
MB = 1e6


def load(path):
    path = pathlib.Path(path)
    return json.loads((gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()).read())


# ---------------------------------------------------------------- vmmap (binary units in the file)
def vm_size(text):
    m = re.fullmatch(r'([0-9.]+)([KMGT]?)', text)
    return float(m[1]) * 1024 ** (' KMGT'.index(m[2]) if m[2] else 0)


def vmmap(path):
    text = pathlib.Path(path).read_text()
    head = re.split(r'^\s*MALLOC ZONE\s+', text, flags=re.M)[0]
    rows = {}
    for line in head.splitlines():
        m = re.match(r'^(.+?)\s{2,}([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+', line)
        if not m:
            continue
        name = m[1].strip()
        if name.startswith('TOTAL') or name.startswith('REGION') or name.startswith('='):
            continue
        rows[name] = rows.get(name, 0) + vm_size(m[4])  # dirty column
    phys = re.search(r'^Physical footprint:\s+([0-9.]+[KMGT]?)', text, re.M)
    pid = re.search(r'^Process:.*\[(\d+)\]', text, re.M)
    return {'pid': int(pid[1]), 'physical': vm_size(phys[1]), 'dirty': rows}


MAJOR = {'WebKit Malloc', 'JS VM Gigacage', 'JS JIT generated code', 'VM_ALLOCATE (graphics)',
         'owned unmapped (graphics)', 'CG raster data'}


# ---------------------------------------------------------------- owner / system classifier
SHARDS = {'driftwood-isle': 'Driftwood', 'pine-hollow': 'Pine Hollow', 'nalati-grasslands': 'Nalati'}
DRIFT = r'palm|hibiscus|shoreBoulder|smallRock|Trailside|shrine|seabed|Cove|cove|lookout\.ts|pier|jetty|hut\.ts|trader\.ts|boat\.ts|wreck|island-|driftwood-blender|mesh-shadow-pieces'


def shard_of(text, current):
    for slug in SHARDS:
        if f'region:{slug}' in text or f'src/shards/{slug}' in text or f'/assets/{slug}/' in text or f'/assets/gpu/{slug}/' in text:
            return slug
    if re.search(r'nalati-|/assets/nalati/', text):
        return 'nalati-grasslands'
    if re.search(r'pine-hollow|pine-sky|pine-crags|pine-lookout|pine-drops', text):
        return 'pine-hollow'
    if re.search(DRIFT, text):
        return 'driftwood-isle'
    return None


def system_of(text):
    if re.search(r'sky-dome|pine-sky|tPano|hdri|panorama', text):
        return 'sky'
    if re.search(r'grass-v2|cards\.phone', text):
        return 'grass'
    if re.search(r'SkinnedMesh|animals|loadRigFile|creatures/|coats/|sheep|horse|wolf|npc-|camp-people|/npcs/|eagle\b|kokpar', text):
        return 'creatures & NPCs'
    if re.search(r'Group\[0\]/Mesh\[0\]|pbr-array/.*(forrest_ground|leafy_grass|rock_ground|stony_dirt)|/tex/(gravel|meadow|snow|path|rock|felt)\.phone|rock_ground|island-terrain|lm-ao|lm-bounce|/splat|/surf$|/zone$|/rdir$|terrain', text):
        return 'terrain'
    if re.search(r'forest-tree|bark|fern|needle|bilberry|reeds|moss-patch|pebbles|ground-cover|palm|hibiscus|bushes|dress-(daisy|lupin|juniper|rose|willow|reed)|pine-hollow-trees|canopy', text):
        return 'trees & ground cover'
    if re.search(r'waterfall|creek|rain|weather|beaver-pool|seabed|water|snow-particles', text):
        return 'water & weather'
    if re.search(r'trophy-chalk|signs', text):
        return 'signs & boards'
    if re.search(r'outcrops', text):
        return 'rock outcrops'
    if re.search(r'kurgan', text):
        return 'kurgans (incl. hidden interior)'
    if re.search(r'crag|boulder|stone|cairn|balbal|dress-|rock|slab|fence|stump|fallen-log|hollow-log', text):
        return 'rocks, stones & dressing'
    if re.search(r'camp|yard|felt|kumis|cauldron|chest|saddle|firewood|roads-wood|watchtower|cabin|lodge|Lantern|barrel|crate|bucket|hatchet|fire_pit|footbridge|lookout|beaver-dam|canoe|waystone|contract-board|cave-arch|hut|pier|jetty|shrine|boat|trader', text):
        return 'buildings, camps & small props'
    return 'other props'


def classify(text, current):
    """Return (owner, system). Owners: Engine & game, Platform, <shard>, Kit & player, Unknown owner."""
    if re.search(r'PMREM', text):
        return 'Engine & game', 'PMREM environment map'
    if re.search(r'render-target/1024x1024/depth|render-target/512x512/depth', text):
        return 'Engine & game', 'depth targets (likely shadow maps)'
    if re.search(r'EffectComposer|Downsampling|Upsampling|LuminancePass|render-target|renderer-internal', text):
        return 'Engine & game', 'post-processing targets at 2x'
    if re.search(r'grid-signs', text):
        return 'Platform', 'road sign atlas'
    if re.search(r'grid-junctions', text):
        return 'Platform', 'road junctions'
    if re.search(r'grid-deck|grid-asphalt|grid-curtain|grid-void|GridSession|strips', text):
        return 'Platform', 'road deck & asphalt'
    if re.search(r'grid-open-plot', text):
        return 'Platform', 'open plots (billboards & signs)'
    if re.search(r'grid-cell-screen', text):
        return 'Platform', 'cell screens'
    if re.search(r'far-proxy|grid-cell:', text):
        return 'Platform', 'far proxies'
    if re.search(r'neighbour-creature|template-\d', text):
        return 'Platform', 'neighbour template creatures'
    if re.search(r'cloud-sea|e7Lut|grid-', text):
        return 'Platform', 'grid sky & grade'
    if re.search(r'PerspectiveCamera|viewmodel|hand-left|hand-right|weapon|/kit/|/equipment/|pine-drops-parked', text):
        return 'Kit & player', 'held items, hands & drops'
    slug = shard_of(text, current)
    if not slug and 'pbr-array' in text:
        slug = current  # shard-only PBR texture arrays; classify.py also files these under the entered world
    if slug:
        return SHARDS[slug], system_of(text)
    return 'Unknown owner', 'GL label has no owner'


def gpu_type(res):
    a = res['owner'] + ' ' + res['asset']
    if re.search(r'PMREM|sky-dome|tPano|hdri|panorama|cloud-sea', a):
        return 'environment & sky maps'
    if re.search(r'render-target/1024x1024/depth|render-target/512x512/depth', a):
        return 'shadow / depth maps'
    if res['kind'] == 'renderbuffer' or res['owner'] == 'engine/render-target' or re.search(r'Upsampling|Downsampling', a):
        return 'render targets (2x)'
    if res['kind'] == 'buffer':
        return 'geometry buffers'
    return 'textures'


# ---------------------------------------------------------------- one situation from a native report
def snapshot_blocks(report_path, label, vm_path, current, heap_estimates):
    report = load(report_path)
    snap = next(s for s in report['snapshots'] if s['label'] == label)
    census = snap['census']
    wc = snap['native']['medianBytes']
    vm = vmmap(vm_path)
    assert vm['pid'] == snap['native']['samples'][0]['pid'], 'vmmap PID differs from the sampled PID'
    tex_uses = {t['uuid']: ' '.join(t['uses']) for t in census['textures']}
    blocks = {}
    gtypes = {}

    def add(side, owner, system, nbytes, conf, kind=None):
        key = (side, owner, system, conf)
        blocks[key] = blocks.get(key, 0) + nbytes

    for ctx in census['gl']:
        assert ctx['reconciled']
        for res in ctx['resources']:
            text = res['owner'] + ' ' + res['asset'] + ' ' + tex_uses.get(res.get('sceneTextureUuid'), '')
            owner, system = classify(text, current)
            add('GPU', owner, system, res['bytes'], 'M')
            t = gpu_type(res)
            gtypes[t] = gtypes.get(t, 0) + res['bytes']
    gl = sum(c['totalBytes'] for c in census['gl'])
    # RAM: WASM linear memories (same run)
    wasm = snap.get('wasm', [])
    rapier = sum(w['bytes'] for w in wasm if w['source'] == 'instantiateStreaming')
    big_other = sum(w['bytes'] for w in wasm if w['source'] != 'instantiateStreaming' and w['bytes'] >= 8_000_000)
    small_other = sum(w['bytes'] for w in wasm if w['source'] != 'instantiateStreaming' and w['bytes'] < 8_000_000)
    add('RAM', 'Engine & game', 'Rapier physics WASM heap', rapier, 'M')
    if big_other:
        add('RAM', 'Unknown owner', 'unidentified 16.8 MB WASM module', big_other, 'M')
    add('RAM', 'Engine & game', 'other small WASM modules', small_other, 'M')
    # RAM: geometry/texture arrays still held by the scene (same run census)
    for arr in census['cpuAllocations']:
        text = ' '.join(u['user'] + ' ' + u['role'] for u in arr['uses'])
        owner, system = classify(text, current)
        add('RAM', owner, 'CPU copies: ' + system, arr['bytes'], 'M')
    # RAM: heap-class estimates (other process / pin)
    for owner, system, nbytes in heap_estimates:
        add('RAM', owner, system, nbytes, 'E')
    # RAM: native regions from vmmap of the same PID (binary -> decimal)
    d = vm['dirty']
    add('RAM', 'Browser & OS', 'JIT machine code (JavaScriptCore)', d.get('JS JIT generated code', 0), 'M')
    add('RAM', 'Browser & OS', 'WebGL graphics mappings in the tab',
        d.get('VM_ALLOCATE (graphics)', 0) + d.get('owned unmapped (graphics)', 0), 'M')
    add('RAM', 'Browser & OS', 'CG raster data (image rasters)', d.get('CG raster data', 0), 'M')
    sysbytes = sum(v for k, v in d.items() if k not in MAJOR and 'reserved' not in k)
    add('RAM', 'Browser & OS', 'system libraries, stacks, malloc', sysbytes, 'M')
    known_ram = sum(v for k, v in blocks.items() if k[0] == 'RAM')
    remainder = wc - known_ram
    add('RAM', 'Unknown owner', 'unattributed WebKit malloc + Gigacage pages', remainder, 'U')
    regions = {
        'WebKit Malloc': d.get('WebKit Malloc', 0), 'JS VM Gigacage': d.get('JS VM Gigacage', 0),
        'JS JIT generated code': d.get('JS JIT generated code', 0),
        'graphics (VM_ALLOCATE + owned unmapped)': d.get('VM_ALLOCATE (graphics)', 0) + d.get('owned unmapped (graphics)', 0),
        'CG raster data': d.get('CG raster data', 0), 'everything else (libraries, stacks, system malloc)': sysbytes,
    }
    return dict(wcBytes=wc, glBytes=gl, totalBytes=wc + gl, vmmapPid=vm['pid'], vmmapPhysicalBytes=vm['physical'],
                vmmapRegionsDirtyBytes=regions, gpuTypeBytes=gtypes,
                wcMinBytes=snap['native']['minBytes'], wcMaxBytes=snap['native']['maxBytes'],
                blocks=[dict(side=k[0], owner=k[1], system=k[2], conf=k[3], bytes=v) for k, v in blocks.items() if v > 0 or k[3] == 'U'])


# ---------------------------------------------------------------- heap-class estimates
def mac_heap_classes(evidence_key):
    ev = load(G / 'cut-list-evidence.json')[evidence_key]['heapClassesAtLeast5MB']
    return {c['class']: c['bytes'] for c in ev}


def pine_estimates():
    cls = mac_heap_classes('pine')
    rows = load(G / 'pine-centre-0e6d69988/audio-owners.json')['rows']
    by = {}
    for r in rows:
        if r['className'] != 'AudioBuffer':
            continue
        src = (r['details']['matches'] or [{}])[0].get('source', '')
        by[src] = by.get(src, 0) + r['bytes']
    pick = lambda frag: sum(v for k, v in by.items() if frag in k)
    calm, tension = pick('pine-calm'), pick('pine-tension')
    sprite, title, bed = pick('oneshots'), pick('/title-'), pick('bed-hollow')
    stings = pick('sting-')
    audio_total = cls['AudioBuffer']
    rest = audio_total - (calm + tension + sprite + title + bed + stings)
    return [
        ('Pine Hollow', 'audio PCM: Pine music calm + tension', calm + tension),
        ('Pine Hollow', 'audio PCM: Pine one-shot SFX sprite', sprite),
        ('Engine & game', 'audio PCM: title piano track', title),
        ('Engine & game', 'audio PCM: piano stings', stings),
        ('Pine Hollow', 'audio PCM: Pine ambience bed', bed),
        ('Unknown owner', 'audio PCM: other, source not traced', rest),
        ('Engine & game', '2D canvases (signs, screens, maps)', cls['CanvasRenderingContext2D']),
        ('Unknown owner', 'decoded images, owner not traced', 4_718_728),
        ('Engine & game', 'JS compiled-code metadata (all layers)', cls['FunctionCodeBlock'] + cls['UnlinkedFunctionCodeBlock']),
        ('Engine & game', 'JS objects & strings (all layers)', cls['Object'] + cls['string'] + cls['e']),
    ]


def nalati_estimates():
    cls = mac_heap_classes('nalati')
    rows = load(G / 'webkit-nalati-centre-0e6d69988.heap-owners.json')['rows']
    audio = [r for r in rows if r['className'] == 'AudioBuffer']
    title_sized = sum(r['bytes'] for r in audio if abs(r['details']['duration'] - 62.29) < 0.05)
    pair = sum(r['bytes'] for r in audio if abs(r['details']['duration'] - 46.16) < 0.05)
    audio_rest = cls['AudioBuffer'] - title_sized - pair
    bitmaps = [r for r in rows if r['className'] == 'ImageBitmap']
    sky = sum(r['bytes'] for r in bitmaps if any('sky-dome' in m['owner'] for m in r['details']['matches']))
    nalati_src = sum(r['bytes'] for r in bitmaps if r['details']['matches'] and not any('sky-dome' in m['owner'] for m in r['details']['matches']))
    img_rest = cls['ImageBitmap'] - sky - nalati_src
    return [
        ('Engine & game', 'audio PCM: 62 s title-length track', title_sized),
        ('Nalati', 'audio PCM: 46 s music pair', pair),
        ('Unknown owner', 'audio PCM: stings & other buffers', audio_rest),
        ('Nalati', 'decoded sky panorama source image', sky),
        ('Nalati', 'decoded model & creature texture images', nalati_src),
        ('Unknown owner', 'decoded images, owner not traced', img_rest),
        ('Engine & game', '2D canvases (signs, screens, maps)', cls['CanvasRenderingContext2D']),
        ('Engine & game', 'JS compiled-code metadata (all layers)', cls['FunctionCodeBlock'] + cls['UnlinkedFunctionCodeBlock']),
        ('Engine & game', 'JS objects & strings (all layers)', cls['Object'] + cls['string']),
    ]


def road_estimates():
    summary = load(G / 'audio-memory-summary.json')
    rep = next(r for r in summary['reports'] if r['file'] == 'native-nalati-score-29f650e1e')
    cls = {c['name']: c['bytes'] for c in rep['heapClasses']}
    return [
        ('Unknown owner', 'audio PCM still live after Nalati', cls['AudioBuffer']),
        ('Unknown owner', 'decoded images still live, no owner traced', cls['ImageBitmap']),
        ('Engine & game', 'canvases (screens, maps, paint roots)', cls['HTMLCanvasElement']),
        ('Engine & game', 'JS compiled-code metadata (all layers)', cls['FunctionCodeBlock'] + cls['UnlinkedFunctionCodeBlock']),
        ('Engine & game', 'JS objects & strings (all layers)', cls['Object'] + cls['string'] + cls['Structure'] + cls['Cell Butterfly']),
    ]


# ---------------------------------------------------------------- the situations
V65 = G / 'native-nalati-saver-on-verified-65106ea87.json.gz'
VMP = 'native-nalati-saver-on-verified-65106ea87.{}.vmmap.txt'
SETTINGS_ON = 'iPhone 16 Pro Simulator, Safari, phone tier, 2x, Auto/KTX2, Developer ON, Memory saver ON, muted, one cold run'

situations = []
s = snapshot_blocks(V65, 'home-settled', G / VMP.format('home-settled'), 'driftwood-isle', [])
s.update(id='1-grid-home', title='Grid + Driftwood home', subtitle='Standing at the Driftwood spawn on the grid; nothing else entered',
         pin='65106ea87', build='65106ea-muz7o6gx', settings=SETTINGS_ON,
         heapSource='none at this pose: every heap-class owner is inside the unattributed bucket')
situations.append(s)
s = snapshot_blocks(G / 'pine-centre-0e6d69988/native.json.gz', 'pine-hollow-centre', HERE / 'evidence/pine-hollow-centre-0e6d69988.vmmap.txt', 'pine-hollow', pine_estimates())
s.update(id='2-pine-centre', title='Pine Hollow centre', subtitle='Standing in Pine Hollow\'s centre, entered from the grid',
         pin='0e6d69988', build='0e6d699-muz9oi4a', settings=SETTINGS_ON,
         heapSource='Mac Playwright WebKit heap snapshot at Pine centre, same pin 0e6d69988 (different process)')
situations.append(s)
s = snapshot_blocks(V65, 'nalati-grasslands-centre', G / VMP.format('nalati-grasslands-centre'), 'nalati-grasslands', nalati_estimates())
s.update(id='3-nalati-centre', title='Nalati centre', subtitle='Standing in Nalati\'s centre, entered from the grid',
         pin='65106ea87', build='65106ea-muz7o6gx', settings=SETTINGS_ON,
         heapSource='Mac Playwright WebKit heap snapshot at Nalati centre, pin 0e6d69988 (one commit later, different process)')
situations.append(s)
s = snapshot_blocks(V65, 'neutral-road', G / VMP.format('neutral-road'), 'nalati-grasslands', road_estimates())
s.update(id='5-road-after-nalati', title='Empty road after Nalati', subtitle='Back on the road with no shard resident (residents=[])',
         pin='65106ea87', build='65106ea-muz7o6gx', settings=SETTINGS_ON,
         heapSource='Simulator Inspector heap snapshot on the empty road after Nalati, pin 29f650e1e (10 min earlier, separate cold run)')
situations.append(s)

# Engine base: the empty template shard, SF22a (coarse, older pin)
sf = load(MEM / 'sf22a-2026-10-04.json')
eb, blank = sf['engineBase'], sf['blankTab']['sim']
gl_tex, gl_buf = eb['desktop']['glTextureMB'] * MB, eb['desktop']['glBufferMB'] * MB
wc = eb['sim']['webContentMB'] * MB
base_blocks = [
    dict(side='GPU', owner='Engine & game', system='render targets & post textures (desktop GL bytes)', conf='M', bytes=gl_tex),
    dict(side='GPU', owner='Engine & game', system='geometry buffers', conf='M', bytes=gl_buf),
    dict(side='RAM', owner='Browser & OS', system='blank Safari tab (browser floor)', conf='M', bytes=blank['webContentMB'] * MB),
    dict(side='RAM', owner='Engine & game', system='CPU copies of geometry held in JS', conf='M', bytes=eb['sim']['jsHeldGeometryMB'] * MB),
    dict(side='RAM', owner='Unknown owner', system='engine JS heap, code, WebKit malloc (not split)', conf='U',
         bytes=wc - blank['webContentMB'] * MB - eb['sim']['jsHeldGeometryMB'] * MB),
]
situations.append(dict(id='4-engine-base', title='Engine base (empty template)', subtitle='The empty _template shard on its own, no grid, no content',
                       pin='91f97bdfc', build='91f97bdfc HEAD export (SF22a, 2026-10-04)',
                       settings='iPhone 17 Pro Simulator, Safari, cold tab, play phase; GL bytes from desktop Chromium on Metal at iPhone 16 Pro size',
                       heapSource='none; only the blank-tab floor and JS-held geometry are split out',
                       wcBytes=wc, glBytes=gl_tex + gl_buf, totalBytes=wc + gl_tex + gl_buf, blocks=base_blocks,
                       gpuTypeBytes={'render targets (2x)': gl_tex, 'geometry buffers': gl_buf}))

situations.sort(key=lambda s: s['id'])
for s in situations:
    assert abs(sum(b['bytes'] for b in s['blocks']) - s['totalBytes']) < 1, s['id']
(HERE / 'itemized.json').write_text(json.dumps({'protocol': __doc__.strip(), 'situations': situations}, indent=1) + '\n')

if __name__ == '__main__':
    for s in situations:
        print(f"\n=== {s['id']} total {s['totalBytes']/MB:.1f} WC {s['wcBytes']/MB:.1f} GL {s['glBytes']/MB:.1f}")
        if 'vmmapPhysicalBytes' in s:
            print('   vmmap physical', round(s['vmmapPhysicalBytes'] / MB, 1), {k: round(v / MB, 1) for k, v in s['vmmapRegionsDirtyBytes'].items()})
            print('   gpu types', {k: round(v / MB, 1) for k, v in s['gpuTypeBytes'].items()})
        for b in sorted(s['blocks'], key=lambda b: (b['side'], -b['bytes'])):
            print(f"   {b['side']} {b['conf']} {b['bytes']/MB:8.2f}  {b['owner']:15s} {b['system']}")
