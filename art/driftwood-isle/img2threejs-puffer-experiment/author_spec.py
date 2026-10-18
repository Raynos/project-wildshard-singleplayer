import json,copy,math
from pathlib import Path
p=Path(__file__).parent;s=json.load(open(p/'spec.json')); t=copy.deepcopy(s['componentTree'][0]);s['componentTree']=[]
a=s['preSpecAssessment']; a['objectClass']={'primaryType':'low-poly non-humanoid puffer fish creature','primaryDomain':'character','formLanguage':['organic','geometric','character-like'],'structureKind':['compound object','articulated assembly'],'motionPotential':['articulated','bendable'],'materialFamilies':['skin-like'],'notes':'Static geometry experiment, rig readiness evaluated separately.'}
a['complexity']['scores']={k:v for k,v in zip(a['complexity']['scores'],[2,2,1,1,1,1,2,2])};a['complexity']['reasoning']=['Broad body and pouch dominate; fin feet, sparse spikes, tail and embedded facial features create recognizable silhouette.']
a['unknownsToResolveBeforeImplementation']=['Underside anatomy and precise back geometry inferred from small secondary views.']
a['anatomy'].update({'applies':True,'styleHeads':1.2,'confidence':.75,'proportions':{'headUnit':.83,'torso':.8,'legs':.25,'shoulderWidth':1.1,'hipWidth':.9},'pose':{'type':'four-fin grounded stance','jointAngles':{}},'faceLandmarks':{'eyeLine':.42,'eyeSpacing':.45,'noseBase':.5,'mouthLine':.55,'hairline':0},'features':['single head-body volume','embedded lateral eyes'],'note':'Non-humanoid: head-body is continuous, proportions measured relative to head-body length; human hairline is inapplicable.'})
s['scores']={k: .8 for k in s['scores']};s['suitability']='conditional';s['performanceBudget'].update(targetTriangles=6000,maxDrawCalls=40,textureSize=0)
s['viewEvidence'][0].update(observations=['Single teal dorsal mass with cream faceted lower pouch','Sparse ivory spines','Orange angular brows above embedded amber eyes','Broad grounded fin feet','Connected fan tail'],confidence=.9)
s['lightingFromPhoto']=['Key directional light from upper front left, intensity 3','Hemisphere fill 1.4 and cool rear rim 0.5','ACES tone mapping exposure 1.15; pale neutral background; contact shadow under grounded feet']
s['qualityContract']['definitionOfDone']=['Match Puffer silhouette, body-pouch ratio, angry embedded eyes, mouth opening, fin feet and complete fan tail at primary view; no holes or detached parts in four-view turntable.']
s['qualityContract']['featureGroups']=[{'id':'puffer-anatomy','name':'Puffer body anatomy','required':True,'qualityCriteria':['Broad head-body and cream pouch with grounded fins'],'evidenceRefs':['full-object'],'failureModes':['Projecting eye tubes','Disconnected tail fan','Narrow raised mouth']}]
pal={'teal':'#327e79','cream':'#edd6a0','orange':'#e98923','amber':'#eeb625','black':'#171714','mouth':'#52221a','tongue':'#bd5b42','ivory':'#f4dea2'}
s['materials']=[]
for name,col in pal.items():
 s['materials'].append({'id':name,'name':name,'type':'standard','color':col,'baseColor':col,'roughness':{'base':.85 if name!='amber' else .3,'variation':.025},'metalness':{'base':0},'textureless':{'declared':True,'evidence':['Approved low-poly reference shows broad matte color regions and planar facets, without pores, grain, print or mapped surface relief.']},'localOverrides':[{'id':name+'-boundary','region':'anatomical color boundary','color':col,'evidenceRefs':['full-object']}],'albedo':{'dominant':col,'secondary':[col]}})
def comp(id,primitive,pos,dim,mat,level='macro',rot=(0,0,0),desc=None):
 c=copy.deepcopy(t);c.update(id=id,name=id,level=level,primitive=primitive,material=mat,materialLayers=[mat],parent=None,confidence=.85,role='body',topologyClass='continuous-sculpt' if primitive in ['ellipsoid','tapered-sweep','lathe'] else 'assembled-solid',topologyRationale='Closed low-poly authored volume matches the visible broad planar shape; not texture-implied geometry.',localFeatures=[{'id':id+'-contour','type':'contour','description':'Reference-matched outer contour','evidenceRefs':['full-object']}]);c['actionProfile']['animationRole']='static-part';c['actionProfile']['collider']['type']='none';c['dimensions'].update(width=dim[0],height=dim[1],depth=dim[2],confidence=.8);c['transform'].update(position=pos,rotation=list(rot));c['geometryDescriptor'].update(normalStrategy='flat face normals',uvStrategy='generated procedural coordinates');c['geometryDescriptor'].update(desc or {});rgb=tuple(int(pal[mat][i:i+2],16) for i in (1,3,5));rgba='rgba(%d, %d, %d, 1)'%rgb;c['colorMaterialRecipe']={'dominantAlbedo':rgba,'secondaryAlbedo':rgba,'materialClass':'skin','materialClassConfidence':.8,'evidenceRefs':['full-object']};s['componentTree'].append(c);return c
comp('body','ellipsoid',[0,.85,-.08],[1.36,1.43,1.45],'teal')
comp('pouch','ellipsoid',[0,.55,.49],[1.17,.98,.91],'cream')
# Mouth cavity inset in the upper pouch, small volume shown as dark opening.
comp('mouth','extrude',[0,.96,.94],[1,1,1],'mouth',desc={'profile2D':{'points':[[-.25,-.09],[.25,-.09],[.18,.16],[.04,.24],[-.11,.15]],'depth':.06}})
comp('upper-face','extrude',[0,1.04,.88],[1,1,1],'cream',desc={'profile2D':{'points':[[-.29,-.08],[-.25,.12],[-.10,.28],[.04,.32],[.18,.23],[.28,-.08],[.19,.12],[.04,.21],[-.12,.12]],'depth':.08}})
comp('tongue','ellipsoid',[.02,.92,1.015],[.25,.06,.10],'tongue','meso')
for side,sign in [('l',1),('r',-1)]:
 comp('eye-patch-'+side,'ellipsoid',[sign*.40,1.07,.50],[.48,.42,.43],'orange','macro')
 comp('eye-'+side,'ellipsoid',[sign*.43,1.09,.695],[.31,.28,.13],'amber','macro',rot=[0,sign*.35,0])
 comp('pupil-'+side,'ellipsoid',[sign*.43,1.10,.762],[.13,.17,.045],'black','meso',rot=[0,sign*.35,0])
 comp('glint-'+side,'ellipsoid',[sign*.41,1.15,.79],[.045,.04,.018],'ivory','micro')
 c=comp('brow-'+side,'extrude',[sign*.38,1.23,.64],[1,1,1],'orange','macro',rot=[0,sign*.18,sign*-.23],desc={'profile2D':{'points':[[-.25,-.08],[.25,-.08],[.21,.08],[-.22,.12]],'depth':.17}})
 for front,z in [('front',.36),('rear',-.50)]:
  comp('fin-'+front+'-'+side,'tapered-sweep',[sign*.54,.08,z],[1,1,1],'teal','macro',desc={'taperedSweep':{'stations':[{'position':[sign*.03,.46,-.04],'rx':.17,'rz':.16},{'position':[sign*.15,.17,.08],'rx':.22,'rz':.20},{'position':[sign*.20,0,.16],'rx':.27,'rz':.24}],'radialSegments':5,'capEnds':True}})
  comp('fin-band-'+front+'-'+side,'ellipsoid',[sign*.74,.10,z+.19],[.45,.16,.39],'orange','meso')
  for j in range(3):comp('toe-'+front+'-'+side+str(j),'cone',[sign*(.56+j*.15),.067,z+.34],[.16,.19,.18],'ivory','micro',rot=[math.pi/2,0,0])
for i,(x,y,z,sz,rot) in enumerate([(0,1.70,-.15,.36,0),(.48,1.43,-.31,.30,-.6),(-.48,1.43,-.31,.30,.6),(.64,1.13,-.27,.28,-1),(-.64,1.13,-.27,.28,1),(.48,1.17,.42,.26,-.7),(-.48,1.17,.42,.26,.7)]):comp('spine'+str(i),'cone',[x,y,z],[sz*.7,sz,sz*.65],'ivory','macro',rot=[0,0,rot])
comp('tail-root','tapered-sweep',[0,.61,-.61],[1,1,1],'teal','macro',desc={'taperedSweep':{'stations':[{'position':[0,0,0],'rx':.18,'rz':.17},{'position':[0,.1,-.35],'rx':.12,'rz':.11}],'radialSegments':6,'capEnds':True}})
comp('tail-border','ellipsoid',[0,.82,-1.09],[.13,.73,.70],'orange','macro')
comp('tail-fan','ellipsoid',[0,.82,-1.11],[.16,.58,.54],'teal','macro')
# Meaningful face details at meso level, hidden from the coarse silhouette-only blockout.
for side,sign in [('l',1),('r',-1)]:
 comp('nostril-'+side,'ellipsoid',[sign*.07,1.22,1.00],[.035,.028,.014],'black','meso')
 comp('cheek-'+side,'ellipsoid',[sign*.47,.75,.66],[.23,.26,.16],'cream','meso')
ids=[c['id'] for c in s['componentTree']]
s['repetitionSystems']=[{'id':'sparse-spines','name':'Seven varied ivory spines','componentRefs':[i for i in ids if i.startswith('spine')],'count':7,'distribution':'authored positions on dorsal and lateral body','buildsGeometry':True}]
a['detailInventory']['details']=[{'id':id+'-detail','kind':'contour','description':id+' visible shape boundary','mapsTo':{'ref':id+'/'+id+'-contour'},'evidenceRefs':['full-object']} for id in ['body','pouch','mouth','upper-face','eye-l','eye-r','brow-l','brow-r','fin-front-l','fin-front-r','tail-fan','spine0']]
s['featureReviewTargets']=[{'id':id,'name':name,'tier':'critical','passIds':s['sculptPipeline']['passOrder'],'minimumScore':.8,'mustPass':True,'componentRefs':refs,'evidenceRefs':['full-object']} for id,name,refs in [('puffer-masses','Squat body and cream pouch proportions',['body','pouch']),('grounded-fins','Broad grounded fin feet',['fin-front-l','fin-front-r']),('tail-spines','Connected fan and sparse spines',['tail-fan','spine0']),('puffer-face','Embedded eyes and integrated broad mouth',['brow-l','brow-r','mouth'])]]
s['qualityContract']['minimumSpecDepth'].update(macroComponents=3,mesoComponents=8,microFeatureGroups=5)
a['complexity']['estimatedCounts']={'macroComponents':sum(c['level']=='macro' for c in s['componentTree']),'mesoComponents':sum(c['level']=='meso' for c in s['componentTree']),'microFeatureGroups':sum(c['level']=='micro' for c in s['componentTree']),'materialLayers':len(s['materials']),'repetitionSystems':1}
json.dump(s,open(p/'spec.json','w'),indent=2)
