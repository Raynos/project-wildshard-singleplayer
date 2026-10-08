// node watch.mjs <seconds> <outfile> [stopWhenPlaying=1]: poll loadsnap over one persistent inspector connection, ~5 Hz
import { appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
const [secs, out, stopPlaying = '1'] = process.argv.slice(2);
const expr = readFileSync(new URL('./loadsnap.js', import.meta.url), 'utf8');
writeFileSync(out, '');
const t0 = Date.now(); let seenLoad = false;
async function connect() {
  for (;;) {
    try {
      const pages = await (await fetch('http://127.0.0.1:9232/json', { signal: AbortSignal.timeout(800) })).json();
      const p = pages.find((x) => x.url?.startsWith('https://wildshard-singleplayer'));
      if (p) {
        const ws = new WebSocket(p.webSocketDebuggerUrl); let seq = 0, target = null; const pend = new Map();
        const inner = (m) => { const q = pend.get(m.id); if (q) { pend.delete(m.id); q(m.result ?? { error: m.error }); } };
        ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data));
          if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page') { target = m.params.targetInfo.targetId; return; }
          if (m.method === 'Target.didCommitProvisionalTarget') { target = m.params.newTargetId; return; }
          if (m.method === 'Target.dispatchMessageFromTarget') { inner(JSON.parse(m.params.message)); return; } inner(m); });
        await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
        await sleep(200);
        const ev = (expression) => { const id = ++seq; const pr = new Promise((r) => pend.set(id, r)); const msg = { id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } };
          ws.send(JSON.stringify(target ? { id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(msg) } } : msg));
          return Promise.race([pr, sleep(2500).then(() => ({ timeout: true }))]); };
        return { ws, ev };
      }
    } catch { /* retry */ }
    await sleep(300);
  }
}
let c = await connect(); let tos = 0;
while (Date.now() - t0 < Number(secs) * 1000) {
  const r = await c.ev(expr);
  const wall = ((Date.now() - t0) / 1000).toFixed(2);
  if (r.timeout) { tos++; if (tos >= 2) { tos = 0; try { c.ws.close(); } catch {} c = await connect(); } }
  else tos = 0;
  if (r.timeout || r.error) { appendFileSync(out, `${wall} ${r.timeout ? 'TIMEOUT(main thread busy or swap)' : 'ERR'}\n`); if (r.error) { try { c.ws.close(); } catch {} c = await connect(); } continue; }
  const v = r.result?.value; appendFileSync(out, `${wall} ${JSON.stringify(v)}\n`);
  if (v?.load?.shown) seenLoad = true;
  if (stopPlaying === '1' && seenLoad && !(v?.load?.shown) && (v.live || v.world)) { await sleep(1500); break; }
  await sleep(150);
}
try { c.ws.close(); } catch {}
process.exit(0);
