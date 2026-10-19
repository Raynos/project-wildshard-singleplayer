"""Read frozen candidate6 observations; never edits the capture or gameplay."""
import hashlib
import json
import statistics
import sys
from pathlib import Path

capture = Path(sys.argv[1])
destination = Path(sys.argv[2])
trace = json.loads((capture / 'render-trace.json').read_text())
hits = json.loads((capture / 'hit-events.json').read_text())
report = json.loads((capture / 'report.json').read_text())
deltas = sorted(row['renderDeltaMs'] for row in trace if row['renderDeltaMs'] is not None)
lethals = []
for hit in hits:
    if not hit['died']:
        continue
    preceding = [row for row in trace if row['wallTime'] < hit['wallTime']]
    following = [row for row in trace if row['wallTime'] >= hit['wallTime']]
    neighborhood = [row for row in following if not row['alive'] and row['boutTime'] <= hit['boutTime'] + 2]
    lethals.append({'event': hit, 'lastPreHitFrame': preceding[-1]['frame'] if preceding else None,
        'lastPreHitSpeed': preceding[-1]['speed'] if preceding else None,
        'firstPostHitFrame': following[0]['frame'] if following else None,
        'firstPostHitPoseInputs': following[0]['poseInputs'] if following else None,
        'firstPostHitScalarFlinch': following[0]['flinch'] if following else None,
        'firstPostHitScalarDeathT': following[0]['deathT'] if following else None,
        'earlyDeathRenderFrames': [row['frame'] for row in neighborhood],
        'earlyDeathWorlds': [row['world'] for row in neighborhood],
        'deathTCompleteObserved': any(row['deathT'] == 1 for row in neighborhood)})
strike_episodes = []
for row in trace:
    strike = row['strike']
    key = (row['phase'], strike.get('currentId'), strike.get('phase'))
    if not strike_episodes or tuple(strike_episodes[-1]['key']) != key:
        strike_episodes.append({'key': list(key), 'firstFrame': row['frame'], 'lastFrame': row['frame'],
            'firstElapsed': strike.get('elapsed'), 'lastElapsed': strike.get('elapsed')})
    else:
        strike_episodes[-1]['lastFrame'] = row['frame']
        strike_episodes[-1]['lastElapsed'] = strike.get('elapsed')
summary = {'schema': 'wildshard.mantis.early-knee-capture-summary.v1',
    'acceptance': False, 'checks': report['checks'], 'fatal': report.get('fatal'), 'renders': len(trace),
    'traceSha256': hashlib.sha256((capture / 'render-trace.json').read_bytes()).hexdigest(),
    'strikePhaseEpisodes': strike_episodes, 'actualHitEvents': len(hits), 'actualLethalEvents': len(lethals), 'deaths': lethals,
    'hitPhases': [{'frame': h['frame'], 'phase': h['phase'], 'amount': h['amount'], 'died': h['died'],
        'strike': h['strike'], 'poseInputs': h['poseInputs'], 'mem': h['mem']} for h in hits],
    'actualPlayerDamageObserved': any(row['playerHealth']['health'] < 100 for row in trace),
    'minimumPlayerHealth': min(row['playerHealth']['health'] for row in trace),
    'poseInputsMissing': [row['frame'] for row in trace if row['poseInputs'] is None],
    'lethalPoseScalarDifferences': [row['frame'] for row in trace if row['poseInputs'] is not None
        and (row['flinch'] != row['poseInputs']['flinch'] or row['deathT'] != row['poseInputs']['deathT'])],
    'renderCadenceMs': {'minimum': min(deltas), 'median': statistics.median(deltas),
        'p95': deltas[int((len(deltas)-1)*.95)], 'maximum': max(deltas)},
    'caveats': ['Render observations do not fill unsampled simulation intervals.',
        'Cloud browser cadence is not physical-phone performance.',
        'Variant labels describe intended placements; actual events and trajectories determine diversity.',
        'Both encoded video and exact native-vertex reconstruction require independent review.']}
destination.write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({k: summary[k] for k in ['renders', 'actualHitEvents', 'actualLethalEvents', 'checks', 'renderCadenceMs']}))
