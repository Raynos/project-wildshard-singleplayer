"""Read-only Blender ray estimate of protected V9 brow projected area.

Run separately for each saved scene (no render or scene writes):
  blender -b SCENE.blend -t 2 -P THIS.py -- --output RECEIPT.json
For unchanged original V9, add --virtual-stance -0.10. Candidate scenes
already lowered by 0.10 use the default 0. Output coordinates always describe
V9 with the shared -0.10 stance. Compare corresponding per-face visible areas,
not total area alone. This sampled geometric estimate does not assess color,
lighting or visual quality, and is not an exact rasterized pixel count.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

BROW = [(.15, .785, .985), (.49, .715, 1.065), (.51, .48, 1.15),
        (.17, .52, 1.12), (.15, .69, .975), (.49, .60, 1.065)]
FACES = [(0, 1, 2), (0, 2, 3), (0, 4, 5, 1), (1, 5, 2),
         (3, 2, 5, 4), (0, 3, 4)]


def measure(samples=1024, virtual_stance=0.0, tolerance=.003):
    import bpy
    from mathutils import Vector
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    camera = Vector((3, 4.6, 2.25))
    target = Vector((0, -.03, .84))
    toward_camera = (camera - target).normalized()
    right = toward_camera.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(toward_camera).normalized()
    pixel_scale = 960 / 3.2
    # Ray tests compensate for a virtual translation of the complete model.
    # The unchanged V9 scene needs -0.10; already-lowered candidates need zero.
    shift = Vector((0, 0, virtual_stance))
    rows = []
    for sign in (-1, 1):
        vertices = [Vector((sign*x, y, z-.10)) for x, y, z in BROW]
        for face_index, face in enumerate(FACES):
            for fan in range(1, len(face)-1):
                indices = (face[0], face[fan], face[fan+1])
                a, b, c = [vertices[i] for i in indices]
                ab, ac = b-a, c-a
                area = abs(ab.dot(right)*ac.dot(up)-ab.dot(up)*ac.dot(right)) * pixel_scale**2 / 2
                visible = 0
                visibility_bits = []
                for k in range(samples):
                    r = math.sqrt((k+.5)/samples)
                    t = ((k+.5)*.6180339887498949) % 1
                    point = a*(1-r) + b*(r*(1-t)) + c*(r*t)
                    origin = point + toward_camera*10 - shift
                    hit, location, *_ = scene.ray_cast(depsgraph, origin, -toward_camera, distance=20)
                    # Expected surface must itself exist, and nothing may cover it.
                    is_visible = bool(hit and abs((location-origin).length-10) <= tolerance)
                    visible += int(is_visible)
                    visibility_bits.append("1" if is_visible else "0")
                rows.append({'side': sign, 'face': face_index, 'triangle': indices,
                             'projectedAreaPixels': area, 'visibleSamples': visible,
                             'samples': samples, 'visibilityBits': ''.join(visibility_bits),
                             'visibleAreaPixelsEstimate': area*visible/samples})
    return {'method': 'Area-weighted deterministic full-scene orthographic ray sampling',
            'camera': {'position': list(camera), 'target': list(target), 'orthoScale': 3.2,
                       'width': 780, 'height': 960},
            'protectedCoordinates': 'Original V9 six-point brow, Z minus 0.10',
            'virtualSceneTranslationZ': virtual_stance, 'depthTolerance': tolerance,
            'frontWedgeVisibleAreaPixelsEstimate': sum(r['visibleAreaPixelsEstimate'] for r in rows if r['face'] < 2),
            'allBrowVisibleAreaPixelsEstimate': sum(r['visibleAreaPixelsEstimate'] for r in rows),
            'triangles': rows,
            'caveat': 'Geometric sampled estimate only; does not verify orange material or visual acceptance.'}


def main():
    import bpy
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--output', required=True, type=Path)
    args.add_argument('--virtual-stance', type=float, default=0)
    args.add_argument('--samples', type=int, default=1024)
    parsed = args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 64 <= parsed.samples <= 16384:
        args.error('--samples must be between 64 and 16384')
    if parsed.output.exists():
        args.error('Output already exists; choose a new receipt path')
    source = Path(bpy.data.filepath)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    result = measure(parsed.samples, parsed.virtual_stance)
    assert before == hashlib.sha256(source.read_bytes()).hexdigest()
    result['sourceBlendSha256'] = before
    result['helperSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    parsed.output.parent.mkdir(parents=True, exist_ok=True)
    parsed.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k.endswith('Estimate')}))


if __name__ == '__main__':
    main()
