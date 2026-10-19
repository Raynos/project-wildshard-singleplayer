"""Prepare source-only local correspondence candidate; never run Blender here."""
from pathlib import Path
import hashlib
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parents[1]/'build_colossus_v4.py'
PIN='f10cdec46537f8d579fa7af687890aebe6c2f0e9d82c962e64a478567e3a0218'
OLD='            face = (k * 6 + j, k * 6 + (j + 1) % 6, (k + 1) * 6 + (j + 1) % 6, (k + 1) * 6 + j)'
NEW=OLD+'''
            if name == 'Shin growth -1 living seam':
                # Separate seam1 candidate: transport only this seam's side correspondence.
                # Keep all ring points, both cap polygons and face color indices unchanged.
                offsets = (0, 2, 4)
                a, b = offsets[k], offsets[k + 1]
                face = (k * 6 + (j + a) % 6, k * 6 + (j + 1 + a) % 6,
                        (k + 1) * 6 + (j + 1 + b) % 6, (k + 1) * 6 + (j + b) % 6)'''
def candidate_source():
    original=SOURCE.read_text();assert hashlib.sha256(original.encode()).hexdigest()==PIN
    assert original.count(OLD)==1
    return original.replace(OLD,NEW).replace("default='tmp/colossus-v4'", "default='tmp/colossus-v4-seam1'").replace("'tide-root-colossus-v4.glb'", "'tide-root-colossus-v4-seam1.glb'").replace("'metrics-v4.json'", "'metrics-v4-seam1.json'").replace("'unaccepted V4 integrated growth study'", "'unaccepted V4 seam1 local correspondence candidate'")
if __name__=='__main__':
    result=candidate_source();destination=HERE/'build_colossus_v4_seam1.py'
    if destination.exists() and destination.read_text()!=result:raise RuntimeError('Refuse overwriting different candidate')
    destination.write_text(result);print(hashlib.sha256(result.encode()).hexdigest())
