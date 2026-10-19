"""Light rest-vertex projection proof for the unchanged V70 room."""
import hashlib
import json
import math
from pathlib import Path
HERE=Path(__file__).resolve().parent

def analyze():
    host=Path('../puffer-native-v38-clean-c4339d9')
    arena=host/'src/engine/practice/TrainingArena.ts'
    game=host/'src/engine/core/Game.ts'
    text=arena.read_text();assert 'WALL_HEIGHT = 9' in text and 'const Y = 900' in text
    assert '0.08, 2600' in game.read_text()
    data=json.loads((HERE.parent/'v4-skin1/colossus-v4-native.json').read_text())
    points=[p['positions'][i:i+3] for p in data['parts'] for i in range(0,len(p['positions']),3)]
    aspect=402/874; fov=65;tan=math.tan(math.radians(fov/2))
    # With camera down -Y and up +X, horizontal is Z, vertical is X.
    h=max(abs(p[2])/(8.7-p[1])/tan/aspect for p in points)
    v=max(abs(p[0])/(8.7-p[1])/tan for p in points)
    assert h<1 and v<1
    return dict(schema='wildshard.colossus.top-camera-analysis.v1',hostSources=[dict(path=str(p.relative_to(host)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in [arena,game]],
        ceilingWorldY=909,failedCameraWorldY=917,proposedCameraWorldY=908.7,near=.08,far=2600,fov=65,up=[1,0,0],viewport=[402,874],
        pointsChecked=len(points),maximumAbsoluteProjectedNDC=[h,v],minimumCameraDepth=min(8.7-p[1] for p in points),
        note='Exact overhead, ninety-degree rolled compared with conventional top; source/native use identical camera. Projection proof does not replace render verification.')
if __name__=='__main__':print(json.dumps(analyze(),indent=2))
