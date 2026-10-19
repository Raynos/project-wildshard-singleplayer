"""Audit exact GLB topology without welding, closing, deleting or repairing output."""
from collections import Counter
import export_native as bridge


def edges_of(triangles):
    edges = Counter()
    for triangle in triangles:
        for a, b in zip(triangle, triangle[1:] + triangle[:1]):
            edges[tuple(sorted((a, b)))] += 1
    return {'boundaryEdges': sum(n == 1 for n in edges.values()),
            'nonManifoldEdges': sum(n > 2 for n in edges.values())}


def audit():
    raw = bridge.GLB.read_bytes()
    bridge.require(bridge.sha(raw) == bridge.GLB_SHA, 'Pinned GLB required')
    doc, binary = bridge.parse_glb(raw)
    triangles = {}
    rows = []
    for _, node, _, world in bridge.scene_nodes(doc):
        if 'mesh' not in node: continue
        faces = []
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            positions = bridge.accessor(doc, binary, primitive['attributes']['POSITION'])
            indices = [row[0] for row in bridge.accessor(doc, binary, primitive['indices'])]
            for i in range(0, len(indices), 3):
                faces.append([tuple(x+y for x, y in zip(positions[j], world)) for j in indices[i:i+3]])
        triangles[node['name']] = faces
        rows.append({'name': node['name'], 'triangles': len(faces), **edges_of(faces)})
    eye_shells = []
    for side in ('-1', '1'):
        names = [prefix + ' ' + side for prefix in ('Pointed sculpted eye socket', 'Closed socket back', 'Convex inset amber lens')]
        faces = [face for name in names for face in triangles[name]]
        eye_shells.append({'side': side, 'meshes': names, **edges_of(faces),
                           'overlays': ['Black pointed slit ' + side, 'Eye glint ' + side]})
    return {'sourceSha256': bridge.SOURCE_SHA, 'glbSha256': bridge.GLB_SHA,
            'meshes': rows, 'assembledEyeShells': eye_shells,
            'interpretation': 'Exact-position edge counting only, no output welding. Socket sides, separate back and lens jointly close each eye. Pupil/glint and nostrils intentionally remain surface overlays. Preserve all ordered triangles and colors; do not auto-cap or delete overlays.',
            'limits': 'Not a general self-intersection, visibility, z-fighting, motion or solid-volume proof. Shell crossing report in approved source is separate.',
            'geometryRepairEmitted': False, 'runtimeAcceptance': False}


if __name__ == '__main__':
    import json
    print(json.dumps(audit(), indent=2))
