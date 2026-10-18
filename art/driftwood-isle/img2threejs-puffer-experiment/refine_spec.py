import json,copy
from pathlib import Path
p=Path(__file__).parent;s=json.load(open(p/'spec.json'));s['scores']={k:2 for k in s['scores']};a=s['preSpecAssessment'];a['unknownsToResolveBeforeImplementation']=[];a['inferredRegions']=['Hidden underside and back use conservative bilateral reconstruction; not claimed exact.']
s['componentTree']=[c for c in s['componentTree'] if not c['id'].startswith('nostril')]
for c in s['componentTree']:
 if c['id'].startswith('fin-') and c['primitive']=='tapered-sweep': c['geometryDescriptor']['taperedSweep']['stations'][0].update(rx=.12,rz=.12)
 if c['id']=='tail-root':c['geometryDescriptor']['taperedSweep']['stations'][-1].update(rx=.08,rz=.08)
for i,n in enumerate(['anatomy-proportion','pose-silhouette','outfit-and-palette','face-landmark-placement']):s['featureReviewTargets'][i]['id']=n
s['qualityContract']['featureGroups'] += [{'id':'face-identity','name':'Embedded eyes and mouth','required':True,'qualityCriteria':['Angled brows enclose eyes; mouth is integrated into cream head planes'],'evidenceRefs':['full-object'],'failureModes':['Projecting orbital rims','Detached beak']},{'id':'color-planes','name':'Broad colored planar regions','required':True,'qualityCriteria':['Teal, cream and orange anatomical regions use broad matte flat facets'],'evidenceRefs':['full-object'],'failureModes':['Fine noisy chips','Photoreal textures']}]
json.dump(s,open(p/'spec.json','w'),indent=2)
