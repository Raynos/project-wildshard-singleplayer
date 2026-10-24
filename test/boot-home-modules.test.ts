// @vitest-environment happy-dom
import {afterEach,expect,test} from 'vitest';
import {prepareHomeModules,reserveHomeDownload} from '../src/bootDownloads';
import {DownloadAccounting,installDownloadAccounting,declareModuleFiles,preloadModuleGroups} from '../src/engine/boot/download';

afterEach(() => {document.body.replaceChildren();for(const link of document.querySelectorAll('link[rel="modulepreload"]'))link.remove();});
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
