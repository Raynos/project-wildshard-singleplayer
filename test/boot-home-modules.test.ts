// @vitest-environment happy-dom
import {afterEach,expect,test} from 'vitest';
import {prepareHomeModules,declareHomeModules,reserveHomeDownload,homeDownloadSource,declareGridHomeDownload,declareAssetTableDownloads} from '../src/bootDownloads';
import {DownloadAccounting,installDownloadAccounting,declareDownloadFile,declareModuleFiles,preloadModuleGroups} from '../src/engine/boot/download';

afterEach(() => {document.body.replaceChildren();for(const link of document.querySelectorAll('link[rel="modulepreload"]'))link.remove();});
test('the exact seam bank stays in the denominator before code credit, without fetching or crediting its members', () => {
  const rows = [{url: '/assets/grid-strip-book-12345678.json', bytes: 10},
    {url: '/assets/grid-strip-page-12345678.json', bytes: 20}, {url: '/assets/grid-strip-mesh-12345678.bin', bytes: 70}];
  const seams = {url: '/assets/grid-seams-abcdef12.json', bytes: 50};
  const node = document.createElement('script'); node.id = 'boot-module-files';
  node.textContent = JSON.stringify({gridEntryDownloads: {'100': {home: rows}}}); document.body.append(node);
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    declareDownloadFile('/assets/code.js', 100);
    declareGridHomeDownload({developer: true, devserver: false, nineDragon: false}, 'home', seams);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 250, declaredDoneBytes: 0, pendingBytes: 250, declaredFiles: 5});
    accounting.resource({name: new URL('/assets/code.js', document.baseURI).href, startTime: 1, transferSize: 100, encodedBodySize: 100, workerStart: 0, serverTiming: []});
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 250, declaredDoneBytes: 100});
    declareDownloadFile(seams.url, seams.bytes);
    for (const row of rows) declareDownloadFile(row.url, row.bytes);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 250, declaredDoneBytes: 100});
    declareGridHomeDownload({developer: false, devserver: false, nineDragon: false}, 'home', seams);
    expect(accounting.snapshot().declaredBytes).toBe(250);
    expect(document.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]')).toHaveLength(0);
  } finally {dispose();}
});
test.each([{key: undefined, total: 500}, {key: 'example', total: 250}, {key: 'unpacked', total: 200}])('compiler table selection $key fixes its exact denominator before code credit', ({key, total}) => {
  const common = {url: '/assets/boot-tables-aaaaaaaa.json', bytes: 100, sha256: 'a'.repeat(64)},
    all = {url: '/assets/boot-tables-bbbbbbbb.json', bytes: 300, sha256: 'b'.repeat(64)},
    own = {url: '/assets/boot-tables-cccccccc.json', bytes: 50, sha256: 'c'.repeat(64)};
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    declareDownloadFile('/assets/code.js', 100);
    declareAssetTableDownloads({common, all, packs: {example: own}}, key);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: total, declaredDoneBytes: 0, pendingBytes: total});
    accounting.resource({name: new URL('/assets/code.js', document.baseURI).href, startTime: 1, transferSize: 100, encodedBodySize: 100, workerStart: 0, serverTiming: []});
    declareDownloadFile(common.url, common.bytes);
    if (key === undefined) declareDownloadFile(all.url, all.bytes);
    else if (key === 'example') declareDownloadFile(own.url, own.bytes);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: total, declaredDoneBytes: 100, pendingBytes: total - 100});
    expect(document.querySelectorAll('link[rel="preload"],link[rel="modulepreload"]')).toHaveLength(0);
  } finally {dispose();}
});

test('a hybrid grid declares its index and demanded files without changing standalone entry', () => {
  const manifest = {gridShardfile: '/shardfiles/example/shard.json'};
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    expect(homeDownloadSource(manifest, false)).toBeUndefined();
    const selected = homeDownloadSource(manifest, true);
    expect(selected).toBe(manifest.gridShardfile);
    reserveHomeDownload({'/shardfiles/example/': [10, 200, 130, 170]}, selected, document.baseURI, 'phone');
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 10, declaredDoneBytes: 0});
    declareDownloadFile('/shardfiles/example/blobs/bin/member.bin', 100);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 110, declaredDoneBytes: 0});
    expect(homeDownloadSource({...manifest, shardfile: '/primary.json'}, true)).toBe('/primary.json');
  } finally {dispose();}
});
test('the early code union fixes the denominator without starting any preload or granting a receipt', () => {
  const node = document.createElement('script'); node.id = 'boot-module-files';
  node.textContent = JSON.stringify({optional: {files: [['/assets/shared.js', 100], ['/assets/scene.js', 50]], groups: {'home:/shardfiles/example/': [0, 1]}}});
  document.body.append(node);
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/': [10, 200]}, '/shardfiles/example/shard.json', document.baseURI);
    declareHomeModules('/shardfiles/example/shard.json', document.baseURI);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 160, declaredDoneBytes: 0});
    expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(0);
    accounting.resource({name: new URL('/assets/shared.js', document.baseURI).href, startTime: 1, transferSize: 100, encodedBodySize: 100, workerStart: 0, serverTiming: []});
    prepareHomeModules('/shardfiles/example/shard.json', document.baseURI);
    expect(accounting.snapshot()).toMatchObject({declaredBytes: 160, declaredDoneBytes: 100});
    expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(2);
  } finally {dispose();}
});
test('a caller without a trusted tier declares only the index, without selecting a device',()=>{
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/':[10,200,130,170]},'/shardfiles/example/shard.json',document.baseURI);
    expect(accounting.snapshot().declaredBytes).toBe(10);
  } finally {dispose();}
});
test.each(['phone','desktop'] as const)('the %s home keeps possible tier bodies out of entry declarations', tier => {
  const accounting=new DownloadAccounting(document.baseURI),dispose=installDownloadAccounting(accounting);
  try {
    reserveHomeDownload({'/shardfiles/example/':[10,200,130,170]},'/shardfiles/example/shard.json',document.baseURI,tier);
    expect(accounting.snapshot().declaredBytes).toBe(10);
    expect(accounting.snapshot().unitemizedBytes).toBeUndefined();
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
    const before=accounting.snapshot();expect(before).toMatchObject({declaredBytes:160,pendingBytes:160});
    accounting.resource({name:new URL('/assets/common.js',document.baseURI).href,startTime:1,transferSize:100,encodedBodySize:100,workerStart:0,serverTiming:[]});
    declareModuleFiles([['/assets/common.js',100]]);preloadModuleGroups(['world.scenes']);
    expect(accounting.snapshot()).toMatchObject({declaredBytes:160,declaredDoneBytes:100,pendingBytes:60});
    expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(2);
    expect(document.querySelector('link[href$="unused.js"]')).toBeNull();
    expect(() => prepareHomeModules('https://foreign.invalid/shardfiles/example/shard.json',document.baseURI)).not.toThrow();
    expect(accounting.snapshot().declaredBytes).toBe(160);
  } finally {dispose();}
});
