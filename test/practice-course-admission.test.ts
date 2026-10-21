import {expect,test} from 'vitest';
import {namedJsonSchema} from '@wildshard/sdk/formatJsonSchema';
import {nameBlob} from '@wildshard/sdk/blobs';
import {PracticeSceneSchema,RidingPracticeSchema} from '@wildshard/format/practiceCourseRows';
import {FixedPracticeFileSchema} from '../src/shards/nine-dragon-stack/generators/sections';
import {horseCourseRows} from '../src/shards/nalati-grasslands/generators/courseScene';
import {grappleCourseScene} from '../src/shards/nine-dragon-stack/generators/courseScene';
import course from '../src/shards/nine-dragon-stack/data/grappleCourse.json' with {type:'json'};

test('both native practice rooms have defining named-file admission',()=>{
 const horse=horseCourseRows(),grapple=grappleCourseScene(course),bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));
 const scene=namedJsonSchema(PracticeSceneSchema),riding=namedJsonSchema(RidingPracticeSchema),fixed=namedJsonSchema(FixedPracticeFileSchema);
 expect(nameBlob('horse.json','json',bytes(horse),{jsonSchema:riding}).file.jsonSchema).toEqual(riding);
 expect(nameBlob('grapple.json','json',bytes({practice:grapple}),{jsonSchema:fixed}).file.jsonSchema).toEqual(fixed);
 expect(()=>nameBlob('scene.json','json',bytes({...horse.presentation,parts:[{kind:'box',tone:'grey',at:[0,0,0],size:[-1,1,1],tint:1}]}),{jsonSchema:scene})).toThrow();
 expect(()=>nameBlob('horse.json','json',bytes({...horse,actor:{...horse.actor,variant:9}}),{jsonSchema:riding})).toThrow();
 expect(()=>nameBlob('grapple.json','json',bytes({practice:{...grapple,presentation:{...grapple.presentation,parts:[{kind:'unknown'}]}}}),{jsonSchema:fixed})).toThrow();
});
