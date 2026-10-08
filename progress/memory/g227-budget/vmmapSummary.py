# vmmap -summary region accounting. Categories and malloc zones overlap: never add the two tables.
import json, pathlib, re, sys

def size(text):
    match = re.fullmatch(r'([0-9.]+)([KMGT]?)', text)
    if not match:
        raise ValueError('Invalid vmmap size ' + text)
    return float(match[1]) * 1024 ** ' KMGT'.index(match[2] or ' ')

rows = []
for filename in sys.argv[1:]:
    path = pathlib.Path(filename)
    text = path.read_text()
    regions = []
    for line in re.split(r'^\s*MALLOC ZONE\s+', text, flags=re.M)[0].splitlines():
        match = re.match(r'^(.+?)\s{2,}([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+(\d+)', line)
        if match:
            regions.append({'region': match[1], **{key:size(match[i+2]) for i,key in enumerate(['virtual','resident','dirty','swapped','volatile','nonvolatile','empty'])}, 'count':int(match[9])})
    physical = re.search(r'^Physical footprint:\s+([0-9.]+[KMGT]?)', text, re.M)
    pid = re.search(r'^Process:.*\[(\d+)\]', text, re.M)
    if not regions or not physical or not pid:
        raise ValueError('Missing native vmmap summary ' + filename)
    rows.append({'source':str(path),'pid':int(pid[1]),'physicalFootprintBytesRounded':size(physical[1]),'regions':regions})
print(json.dumps({'protocol':'vmmap displayed sizes use binary units and are rounded. Region dirty != physical footprint. Malloc zone table already covers several region tags and must not be added. Categories do not identify application owners.', 'poses':rows},indent=2))
