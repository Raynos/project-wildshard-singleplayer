// oxlint-disable-next-line import/no-nodejs-modules -- Exact byte proof for the build's image copies.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The test owns only its temporary output folder.
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve local build fixture paths.
import {join,resolve} from 'node:path';
import {expect,test} from 'vitest';
import {titleAssetTables,titleAssetURLs,writeTitleAssets} from '../scripts/title-assets.mjs';
import {titleAssetURL} from '../src/game/titleAssets';
import {serviceWorkerCore} from '../scripts/app-build/serviceWorker';

test('every title URL names its exact original bytes and shell/runtime use the same URL',()=>{
  const root=process.cwd(),urls=titleAssetURLs(root),tables=titleAssetTables(root);
  expect(Object.keys(urls)).toHaveLength(7);
  expect(tables['index.html']).toBe(readFileSync('index.html','utf8'));
  expect(tables['scripts/title-assets.generated.json']).toBe(readFileSync('scripts/title-assets.generated.json','utf8'));
  mkdirSync('tmp',{recursive:true});const out=mkdtempSync(resolve('tmp/title-assets-'));
  try{
    writeTitleAssets(root,out);
    for(const [source,url]of Object.entries(urls)){
      const bytes=readFileSync(join(root,'public',source));
      const hash=createHash('sha256').update(bytes).digest('hex');
      expect(url).toMatch(/-[a-f0-9]{12,16}\.(?:jpg|png)$/u);
      expect(url).toContain(hash.slice(0,source.includes('/launch-')?12:16));
      expect(readFileSync(join(out,url)).equals(bytes)).toBe(true);
      expect(titleAssetURL(source)).toBe(url);
    }
    expect(titleAssetURL('/another-image.jpg')).toBe('/another-image.jpg');
    const html=readFileSync('index.html','utf8');
    const result=serviceWorkerCore({'index.html':{type:'asset',source:new TextEncoder().encode(html)}},root,'title');
    expect(result.core).toContain(urls['/assets/title/main-crossroads-square.jpg']);
    expect(result.core).toContain(urls['/assets/title/main-crossroads-landscape.jpg']);
  }finally{rmSync(out,{recursive:true,force:true});}
});
