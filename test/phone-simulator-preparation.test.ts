// @vitest-environment node
import {expect,test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Observe actual atomic job receipts and native directory notification.
import {mkdtempSync,mkdirSync,writeFileSync,renameSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The preparation protocol is a Node job boundary.
import {join} from 'node:path';
import {preparePhoneSimulator,waitPhonePreparation} from '../scripts/parity/phone-route-preparation.mjs';

function fixture() {
  mkdirSync('tmp',{recursive:true});const directory=mkdtempSync('tmp/phone-preparation-');
  const path=join(directory,'preparation.json');
  const publish=(status:string,code:number|null)=>{
    writeFileSync(`${path}.next`,JSON.stringify({engine:'simulator',status,code,wallMs:42,udid:'12345678-1234-1234-1234-123456789ABC'}));
    renameSync(`${path}.next`,path);
  };
  return {path,publish,close:()=>{rmSync(directory,{recursive:true,force:true});}};
}

test('route waits for native preparation completion, not merely a started boot',async()=>{
  const f=fixture();try {
    f.publish('pending',null);const done=waitPhonePreparation(f.path);
    let complete=false;void done.then(()=>{complete=true;return undefined;});
    await Promise.resolve();expect(complete).toBe(false);
    f.publish('ready',0);expect(await done).toMatchObject({engine:'simulator',status:'ready',wallMs:42});
  }finally{f.close();}
});

test('failed native boot refuses instead of retrying or silently selecting WebKit',async()=>{
  const f=fixture();try {
    f.publish('failed',124);await expect(waitPhonePreparation(f.path)).rejects.toThrow('preparation failed (124)');
    f.publish('ready',1);await expect(waitPhonePreparation(f.path)).rejects.toThrow('preparation failed (1)');
  }finally{f.close();}
});

test('runner without iOS publishes its explicit WebKit preparation without simctl',async()=>{
  const f=fixture();try {
    preparePhoneSimulator(f.path,'webkit');expect(await waitPhonePreparation(f.path)).toMatchObject({engine:'webkit',status:'ready',code:0,udid:null});
  }finally{f.close();}
});
