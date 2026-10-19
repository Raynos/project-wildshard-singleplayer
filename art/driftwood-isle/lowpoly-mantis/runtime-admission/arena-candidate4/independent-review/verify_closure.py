import json, hashlib
from pathlib import Path

# Run from repository root. Read-only verification of the review's frozen files.
root = Path.cwd()
p = root / 'art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate4/independent-review'
closure = json.loads((p / 'closure.json').read_text())
for group in ['files', 'temporaryVisualInventory']:
    for name, expected in closure[group].items():
        path = root / name
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert actual == expected['sha256'], name
print('Review and temporary visual inventory match frozen closure.')
