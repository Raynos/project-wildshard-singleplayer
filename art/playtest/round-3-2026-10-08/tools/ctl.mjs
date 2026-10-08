#!/usr/bin/env node
// Playtest round 3: evaluate an expression in the Simulator Safari page (needs ios_webkit_debug_proxy on 9232+).
//   node ctl.mjs [--match=<url prefix>] [--timeout=<s>] '<expression>'   (a promise is awaited; the value is printed as JSON)
//   node ctl.mjs --pages
import { setTimeout as sleep } from 'node:timers/promises';
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const MATCH = opt('match', 'https://wildshard-singleplayer'); const TIMEOUT = Number(opt('timeout', '30')) * 1000;
const expr = args.filter((a) => !a.startsWith('--')).join(' ');

async function pages() {
  const all = [];
  for (let port = 9232; port <= 9240; port++) {
    try { const p = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(600) })).json(); all.push(...p); } catch { /* none */ }
  }
  return all;
}
if (args.includes('--pages')) { console.log(JSON.stringify((await pages()).map((p) => ({ url: p.url, title: p.title, ws: p.webSocketDebuggerUrl })), null, 1)); process.exit(0); }

let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { const p = (await pages()).find((x) => typeof x.url === 'string' && x.url.startsWith(MATCH)); wsUrl = p?.webSocketDebuggerUrl ?? null; if (!wsUrl) await sleep(250); }
if (!wsUrl) { console.log(JSON.stringify({ error: 'no page' })); process.exit(2); }
const ws = new WebSocket(wsUrl);
let seq = 0; let target = null; const pending = new Map();
const inner = (m) => { const p = pending.get(m.id); if (p) { pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); } };
ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data));
  if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page') { target = m.params.targetInfo.targetId; return; }
  if (m.method === 'Target.didCommitProvisionalTarget') { target = m.params.newTargetId; return; }
  if (m.method === 'Target.dispatchMessageFromTarget') { inner(JSON.parse(m.params.message)); return; } inner(m); });
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
await sleep(300);
const send = (method, params = {}) => { const id = ++seq; const p = new Promise((res, rej) => pending.set(id, { res, rej }));
  const msg = { id, method, params };
  ws.send(JSON.stringify(target ? { id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(msg) } } : msg));
  return Promise.race([p, sleep(8000).then(() => { throw new Error('inspector timeout ' + method); })]); };
const raw = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.wasThrown) throw new Error(r.result?.description ?? 'threw'); return r.result?.value; };
const key = `__pt3e${Date.now()}${Math.floor(Math.random() * 1e6)}`;
let out;
try {
  await raw(`globalThis[${JSON.stringify(key)}]={done:false};Promise.resolve().then(()=>(${expr})).then(v=>{globalThis[${JSON.stringify(key)}]={done:true,value:v};},e=>{globalThis[${JSON.stringify(key)}]={done:true,error:String(e&&e.stack||e)};});1`);
  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT) {
    const s = await raw(`JSON.stringify(globalThis[${JSON.stringify(key)}]??null)`);
    const st = s ? JSON.parse(s) : null;
    if (st === null) { out = { error: 'document changed' }; break; }
    if (st.done) { out = st.error ? { error: st.error } : st.value; break; }
    await sleep(100);
  }
  if (out === undefined) out = { error: 'timeout' };
  await raw(`delete globalThis[${JSON.stringify(key)}]`).catch(() => {});
} catch (e) { out = { error: String(e.message) }; }
console.log(typeof out === 'string' ? out : JSON.stringify(out));
ws.close();
process.exit(0);
