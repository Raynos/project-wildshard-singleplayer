"""Reconcile GL labels and directly held scene arrays; no inferred opaque-runtime discount."""
import gzip
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent


def load(path):
    return json.loads((gzip.open(path, 'rt') if str(path).endswith('.gz') else path.open()).read())


def classify(text, shard):
    """Ambiguous generated meshes remain residual; static assignment labels are explicit."""
    if re.search(r'grid-|far-proxy|compiled-props|template-2', text):
        return 'platform/templates'
    if re.search(r'PerspectiveCamera|viewmodel|pine-drops-parked|/kit/|/equipment/|trophy|HUD|weapon|Weapon', text):
        return 'retained-kit/UI/shared'
    if re.search(r'creatures/|loadRigFile|SkinnedMesh|rigged|skeleton|/bones|horse|kokpar|far-herd|camp-people|balbal|nomad|wolf|sheep|collie|eagle', text, re.I):
        return 'retained-creatures/dynamic'
    if re.search(r'render-target|renderer-internal|sky|Sky|horizon|panorama|planet|cloud|grass-v2|storm-|water|pond|stream|rain|snow-particles|[UD]ownsampling|[Uu]psampling', text):
        return 'retained-sky/post/water/dynamic'
    if re.search(r'Group\[0\]/Mesh\[0\]/|pbr-array/.*(?:forrest_ground|leafy_grass|rock_ground|stony_dirt)|/tex/(?:gravel|meadow|snow|path|rock|felt)\.phone|/astc6/tex/rock_ground', text):
        return 'world-terrain'
    if re.search(r'forest-tree|pine_bark|fir_bark|metasequoia_bark|birch_bark|bark_willow|fern|needle-litter|bilberry|reeds|moss-patch|pebbles|nalati-dress-(?:boulder|slab|stone|juniper|rose|willow|lupin|daisy|reed)', text):
        return 'world-forest/scatter'
    if re.search(r'pine-crags|pine-lookout|pine-footbridge|pine-zip-|pine-landmarks|cabin|props(?:-wood|-stumps)?[ /]|mossy-boulder|fallen-log|tree-stump|standing-stone|waystone|beaver-dam|canoe|cave-arch|contract-board|wooden_crate|wooden_bucket|wine_barrel|stone_fire_pit|nalati-(?:outcrops|crag-rock|camp/|summer-camp|kurgans|cairn|crags|watchtower|roads-|yard|dress-statics|dress-camp-clutter|model-(?:firewood|kumis-churn|cauldron|snow-lotus|chest|watchtower))', text):
        return 'world-static-props'
    if f'region:{shard}' in text or shard in text:
        return 'runtime-unclassified'
    return 'page/unclassified'


def decide(uses, shard):
    kinds = {classify(use, shard) for use in uses}
    if len(kinds) == 1:
        return next(iter(kinds))
    # A resource used by a retained role stays with that role, even if world meshes also use it.
    for kind in ['platform/templates', 'retained-kit/UI/shared', 'retained-creatures/dynamic', 'retained-sky/post/water/dynamic']:
        if kind in kinds:
            return kind
    if kinds and all(kind.startswith('world-') for kind in kinds):
        return 'world-shared'
    return 'runtime-unclassified' if any(f'region:{shard}' in use for use in uses) else 'page/unclassified'


def analyze(report, surface):
    poses = []
    for snapshot in report['snapshots'][1:]:
        if snapshot['label'].startswith('neutral-road'): continue
        shard = snapshot['label'].rsplit('-', 1)[0]
        census = snapshot['census']
        resources = [r for context in census['gl'] for r in context['resources']]
        textures = {t['uuid']: t for t in census['textures']}
        texture_kinds = {}
        groups = {}
        labels = {}
        resource_kinds = {}
        for resource in resources:
            kind = classify(resource['owner'] + ' ' + resource['asset'], shard)
            texture = textures.get(resource.get('sceneTextureUuid'))
            if texture:
                usage_kind = decide(texture['uses'], shard)
                if usage_kind.startswith('retained-') or usage_kind == 'platform/templates':
                    kind = usage_kind
                elif kind in ['page/unclassified', 'runtime-unclassified']:
                    kind = usage_kind
                texture_kinds[texture['uuid']] = kind
            resource_kinds[resource['id']] = kind
            key = (resource['kind'], resource['owner'], resource['asset'], kind)
            labels[key] = labels.get(key, 0) + resource['bytes']
            group = groups.setdefault(kind, {'gpuBytes': 0, 'directCpuArrayBufferBytes': 0})
            group['gpuBytes'] += resource['bytes']
        for array in census['cpuAllocations']:
            kinds = []
            for use in array['uses']:
                role = use['role']
                if role.startswith(('texture:', 'mip:')):
                    kinds.append(texture_kinds.get(role.split(':', 1)[1], classify(use['user'], shard)))
                else:
                    kinds.append(classify(use['user'], shard))
            unique = set(kinds)
            if len(unique) == 1:
                kind = kinds[0]
            elif unique and all(k.startswith('world-') for k in unique):
                kind = 'world-shared'
            else:
                kind = 'retained-shared/unclassified'
            group = groups.setdefault(kind, {'gpuBytes': 0, 'directCpuArrayBufferBytes': 0})
            group['directCpuArrayBufferBytes'] += array['bytes']
        actual_gpu = sum(r['bytes'] for r in resources)
        direct_cpu = sum(a['bytes'] for a in census['cpuAllocations'])
        assert sum(g['gpuBytes'] for g in groups.values()) == actual_gpu
        assert sum(g['directCpuArrayBufferBytes'] for g in groups.values()) == direct_cpu
        assert all(c['reconciled'] for c in census['gl'])
        world = {key: sum(g[key] for kind, g in groups.items() if kind.startswith('world-')) for key in ['gpuBytes', 'directCpuArrayBufferBytes']}
        # A generous scene-connected ceiling: all allocations referenced by the region, even sky/actors/kit,
        # plus every non-platform, non-post GPU allocation on the page. Opaque caches are outside this envelope.
        region_cpu = sum(a['bytes'] for a in census['cpuAllocations'] if any(f'region:{shard}' in u['user'] for u in a['uses']))
        bitmap_upper = sum(t.get('width', 0) * t.get('height', 0) * (t.get('depth') or 1) * 4 for t in census['textures']
                           if t.get('imageKind') in ['ImageBitmap', 'HTMLImageElement', 'HTMLCanvasElement']
                           and any(f'region:{shard}' in u for u in t['uses']))
        compressed = []
        for resource in resources:
            parts = resource.get('subresources', [])
            if resource['kind'] != 'texture' or not parts:
                continue
            formats = {part.get('ifmt') for part in parts}
            if not all(isinstance(fmt, int) and (0x93b0 <= fmt <= 0x93bd or 0x93d0 <= fmt <= 0x93dd) for fmt in formats):
                continue
            rgba = sum(part['w'] * part['h'] * part.get('d', 1) * 4 for part in parts)
            compressed.append({'classification': resource_kinds[resource['id']], 'owner': resource['owner'], 'asset': resource['asset'], 'formats': sorted(hex(fmt) for fmt in formats),
                               'actualGpuBytes': resource['bytes'], 'rgbaUpperBytes': rgba, 'rgbaToActual': rgba / resource['bytes']})
        previous_pine = [r for r in resources if shard == 'nalati-grasslands' and 'pine-hollow' in (r['owner'] + ' ' + r['asset'])]
        top_claims = []
        for claim in sorted(snapshot['residency']['claims'], key=lambda c: c.get('accountedBytes', c['bytes']), reverse=True)[:10]:
            ident = claim['id']
            matched = []
            if ident.startswith('platform:render:'):
                suffix = ident.split('platform:render:', 1)[1]
                fragment = {'grid.open-plots': 'grid-open-plot', 'road.signs': 'grid-signs', 'road.deck': 'grid-deck',
                            'road.junctions': 'grid-junctions', 'road.asphalt': 'grid-asphalt'}.get(suffix)
                if fragment:
                    matched = [r for r in resources if fragment in r['asset']]
            if ident == 'sim:' + shard:
                # Includes world candidates and explicitly retained active-runtime labels; page render targets remain outside.
                matched = [r for r in resources if shard in r['asset'] or shard in r['owner']
                           or (r.get('sceneTextureUuid') in textures and any(f'region:{shard}' in u for u in textures[r['sceneTextureUuid']]['uses']))]
            top_claims.append({'id': ident, 'category': claim['category'], 'accountedBytes': claim.get('accountedBytes', claim['bytes']),
                               'modelPlayingContributionBytes': claim.get('accountedBytes', claim['bytes']) * 1.11,
                               'directlyMatchedGpuBytes': sum(r['bytes'] for r in matched) if matched else None,
                               'actualTotalBytes': None, 'note': 'GL is not total owner residency; unmatched is unknown, not zero.'})
        poses.append({'pose': snapshot['label'], 'surface': surface, 'model': snapshot['residency']['cost'],
                      'native': snapshot.get('native'), 'routeComplete': not bool(report.get('failure')), 'routeFailure': report.get('failure'), 'allGpuBytes': actual_gpu, 'allDirectCpuArrayBufferBytes': direct_cpu,
                      'groups': groups, 'definiteWorld': world, 'definiteWorldDirectBytes': sum(world.values()),
                      'allRegionDirectCpuArrayBufferBytes': region_cpu, 'regionBitmapDimensionUpperBytes': bitmap_upper,
                      'topClaims': top_claims,
                      'astc': {'count': len(compressed), 'actualGpuBytes': sum(r['actualGpuBytes'] for r in compressed),
                               'rgbaUpperBytes': sum(r['rgbaUpperBytes'] for r in compressed), 'resources': compressed},
                      'previousPineLabelGpuBytes': sum(r['bytes'] for r in previous_pine),
                      'previousPineLabels': [{'owner': r['owner'], 'asset': r['asset'], 'gpuBytes': r['bytes']} for r in previous_pine],
                      'labels': [{'kind': k[0], 'owner': k[1], 'asset': k[2], 'classification': k[3], 'gpuBytes': n}
                                 for k, n in sorted(labels.items(), key=lambda row: (-row[1], row[0]))]})
    return poses


reports = [('chromium', ROOT / ('census-f47f33199.json' if (ROOT / 'census-f47f33199.json').exists() else 'census-f47f33199.json.gz'))]
native = ROOT / ('native-f47f33199.json' if (ROOT / 'native-f47f33199.json').exists() else 'native-f47f33199.json.gz')
if native.exists():
    reports.append(('simulator', native))
nalati = ROOT / ('native-nalati-direct-f47f33199.json' if (ROOT / 'native-nalati-direct-f47f33199.json').exists() else 'native-nalati-direct-f47f33199.json.gz')
if nalati.exists():
    reports.append(('simulator-direct', nalati))
result = {'version': 1, 'note': 'Measured GL + direct scene ArrayBuffers. No claim of an isolated total-process world split.', 'poses': []}
for surface, path in reports:
    report = load(path)
    if not report.get('closed'):
        print('Skipping incomplete', surface, report.get('failure'))
        continue
    result['poses'].extend(analyze(report, surface))
(ROOT / 'label-summary.json').write_text(json.dumps(result, indent=2) + '\n')
lines = ['# Per-label GL classification', '', 'Exact GPU bytes, including mip levels. CPU/native residual is not assigned by GL labels.', '']
for pose in result['poses']:
    lines += ['## ' + pose['surface'] + ' — ' + pose['pose'], '', '| Class | Owner | Asset | GPU MB |', '|---|---|---|---:|']
    for row in pose['labels']:
        lines.append('| ' + row['classification'] + ' | ' + row['owner'].replace('|', '\\|') + ' | ' + row['asset'].replace('|', '\\|') + ' | ' + f"{row['gpuBytes']/1e6:.6f}" + ' |')
    print(pose['surface'], pose['pose'], 'world', pose['definiteWorld'], 'direct', pose['definiteWorldDirectBytes']/1e6,
          'region CPU', pose['allRegionDirectCpuArrayBufferBytes']/1e6, 'bitmap upper', pose['regionBitmapDimensionUpperBytes']/1e6)
(ROOT / 'labels.md').write_text('\n'.join(lines) + '\n')
