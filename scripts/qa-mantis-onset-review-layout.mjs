import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath, extname } from 'node:path';

const root = resolvePath(process.argv[2]), out = 'tmp/mantis-onset-review-layout';
mkdirSync(out, { recursive: true });
const server = createServer((req, res) => { const name = new URL(req.url ?? '/', 'http://localhost').pathname; const file = resolvePath(root, `.${name === '/' ? '/index.html' : name}`); if (!file.startsWith(`${root}/`)) { res.writeHead(403).end(); return; } try { res.setHeader('Content-Type', ({ '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg' })[extname(file)] ?? 'application/octet-stream'); res.end(readFileSync(file)); } catch { res.writeHead(404).end(); } });
await new Promise(resolve => { server.listen(4499,'127.0.0.1',resolve); });
let browser;
const results=[];
try { browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--mute-audio']});
for (const width of [402,1440]) { const page=await browser.newPage({viewport:{width,height:874},deviceScaleFactor:1}); await page.goto('http://127.0.0.1:4499/',{waitUntil:'networkidle'}); const measured=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tabs:[...document.querySelectorAll('[role="tab"]')].map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),buttons:[...document.querySelectorAll('#overview .play-engine-button')].map(e=>({text:e.textContent,href:e.getAttribute('href'),top:e.getBoundingClientRect().top}))})); await page.screenshot({path:`${out}/${width}.jpg`,type:'jpeg',quality:88}); if(measured.scroll>width||measured.tabs.length!==5||measured.buttons.length!==4)throw new Error(JSON.stringify(measured));results.push(measured); await page.locator('#tab-in-game-footage').click(); await page.locator('#mantis-onset-candidate5-evidence').evaluate(e=>e.scrollIntoView({block:'start'})); await page.waitForTimeout(700); await page.locator('#mantis-onset-candidate5-evidence img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode();})));  await page.locator('#mantis-onset-candidate5-evidence').evaluate(e=>e.scrollIntoView({block:'start'})); await page.waitForTimeout(300); await page.screenshot({path:`${out}/${width}-mantis.jpg`,type:'jpeg',quality:88}); await page.close(); }
}finally{await browser?.close();await new Promise(resolve=>{server.close(resolve);});writeFileSync(`${out}/report.json`,JSON.stringify({results},null,2));}
