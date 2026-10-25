// @vitest-environment happy-dom
import {afterEach,expect,test} from 'vitest';
import {prepareHomeModules,reserveHomeDownload} from '../src/bootDownloads';
import {DownloadAccounting,installDownloadAccounting,declareModuleFiles,preloadModuleGroups} from '../src/engine/boot/download';

afterEach(() => {document.body.replaceChildren();for(const link of document.querySelectorAll('link[rel="modulepreload"]'))link.remove();});
test('a caller without a trusted tier reserves the full bank without selecting a device',()=>{
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/':[10,200,130,170]},'/shardfiles/example/shard.json',document.baseURI);
    expect(accounting.snapshot().declaredBytes).toBe(200);
  } finally {dispose();}
});
test.each(['phone','desktop'] as const)('the %s home reserves its selected product total before reading sections', tier => {
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/':[10,200,130,170]},'/shardfiles/example/shard.json',document.baseURI,tier);
    expect(accounting.snapshot().declaredBytes).toBe(tier==='phone'?130:170);
    expect(accounting.snapshot().unitemizedBytes).toBe(tier==='phone'?120:160);
  } finally {dispose();}
});
test.each([{row:[10,200,9,170]},{row:[10,200,130,201]},{row:[10,200,130,Number.NaN]},{row:[10,200,130]}])('invalid tier totals refuse before reserving %j',({row})=>{
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    expect(()=>reserveHomeDownload({'/shardfiles/example/':row},'/shardfiles/example/shard.json',document.baseURI,'phone')).toThrow('Invalid home download total');
    expect(accounting.snapshot().declaredBytes).toBe(0);
  } finally {dispose();}
});
test('the selected code and product total stay fixed as common and late feature reads finish', () => {
  const node=document.createElement('script');node.id='boot-module-files';
  node.textContent=JSON.stringify({optional:{files:[['/assets/common.js',100],['/assets/scene.js',50],['/assets/unused.js',900]],
    groups:{'home:/shardfiles/example/':[0,1],'world.scenes':[0,1],unused:[2]}}});document.body.append(node);
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/':[10,200]},'/shardfiles/example/shard.json',document.baseURI);
    prepareHomeModules('/shardfiles/example/shard.json',document.baseURI);
    const before=accounting.snapshot();expect(before).toMatchObject({declaredBytes:350,pendingBytes:350});
    accounting.resource({name:new URL('/assets/common.js',document.baseURI).href,startTime:1,transferSize:100,encodedBodySize:100,workerStart:0,serverTiming:[]});
    declareModuleFiles([['/assets/common.js',100]]);preloadModuleGroups(['world.scenes']);
    expect(accounting.snapshot()).toMatchObject({declaredBytes:350,declaredDoneBytes:100,pendingBytes:250});
    expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(2);
    expect(document.querySelector('link[href$="unused.js"]')).toBeNull();
    expect(() => prepareHomeModules('https://foreign.invalid/shardfiles/example/shard.json',document.baseURI)).not.toThrow();
    expect(accounting.snapshot().declaredBytes).toBe(350);
  } finally {dispose();}
});
