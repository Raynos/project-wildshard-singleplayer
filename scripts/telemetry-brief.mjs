/** The review secret remains in the user's config, never the repo or printed output. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const overdue = resolve('.cache/debug-overdue.txt');
if (existsSync(overdue)) { const value = readFileSync(overdue, 'utf8').trim(); if (value) console.log(`-- overdue Debug flags (key | ask | reviewBy) --\n${value}`); }
const keyFile = resolve(homedir(), '.config/wildshard/telemetry.key');
if (!existsSync(keyFile)) console.log('telemetry: no key');
else {
  const key = readFileSync(keyFile, 'utf8').trim();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  for (const query of ['rate=builds&n=3', `digest=${yesterday}`]) {
    try {
      const response = await fetch(`https://wildshard-singleplayer.vercel.app/api/telemetry?${query}`, { headers: { 'x-review-password': key }, signal: AbortSignal.timeout(3000) });
      if (response.ok) console.log(`telemetry ${query}: ${JSON.stringify(await response.json())}`);
      else console.log(`telemetry ${query}: unavailable (${response.status})`);
    } catch { console.log(`telemetry ${query}: unavailable`); }
  }
}
