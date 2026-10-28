import {execFile} from 'node:child_process';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import {pressEscape} from './browser-escape.mjs';

// Run through scripts/browser-lane.sh; an inert real browser is necessary to
// catch the native key feedback loop that a synthetic DOM fixture cannot see.
await test('Escape sends only its own trusted down and up',{timeout:30000},async () => {
  const env = {...process.env,AGENT_BROWSER_SESSION:`escape-regression-${process.pid}`,AGENT_BROWSER_ARGS:'--mute-audio,--use-angle=metal,--ignore-gpu-blocklist'};
  /** @param {string[]} args */
  const call = async args => {
    /** @type {Promise<string>} */
    const output = new Promise((resolve,reject) => {
      execFile('agent-browser',['--json',...args],{env,timeout:10000,maxBuffer:1048576},(error,stdout) => {
        if (error) reject(new Error(error.message,{cause:error})); else resolve(stdout);
      });
    });
    const stdout = await output;
    return v.parse(v.object({success:v.literal(true),data:v.unknown()}),JSON.parse(stdout)).data;
  };
  try {
    await call(['open','about:blank']);
    await call(['set','device','iPhone 16 Pro']);
    await call(['eval',`globalThis.escapeEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{escapeEvents.push({type:event.type,key:event.key,code:event.code,trusted:event.isTrusted,repeat:event.repeat});});`]);
    const {cdpUrl} = v.parse(v.object({cdpUrl:v.string()}),await call(['get','cdp-url']));
    await pressEscape(cdpUrl,'about:blank');
    await new Promise(resolve => { setTimeout(resolve,250); });
    const {result} = v.parse(v.object({result:v.string()}),await call(['eval','JSON.stringify(escapeEvents)']));
    const events = v.parse(v.array(v.object({type:v.string(),key:v.string(),code:v.string(),trusted:v.boolean(),repeat:v.boolean()})),JSON.parse(result));
    assert.deepEqual(events,[
      {type:'keydown',key:'Escape',code:'Escape',trusted:true,repeat:false},
      {type:'keyup',key:'Escape',code:'Escape',trusted:true,repeat:false},
    ]);
  } finally { await call(['close']); }
});
