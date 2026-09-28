#!/usr/bin/env node
// Reduced E257 iOS Safari GPU-process crash. No game, external assets, or telemetry.
// node scripts/test-ios-compressed-upload.mjs
// In iOS Simulator Safari open http://127.0.0.1:4191/before, then /after.
// /before reproduced SIGSEGV in ANGLE UploadTextureContents on iOS 26.5.
// /after validates each complete texture, as the phone precompiler now does.
import { createServer } from 'node:http';

const port = Number(process.argv.find((v) => v.startsWith('--port='))?.slice(7) ?? 4191);
const results = [];
async function serve(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/result' && request.method === 'POST') {
    let body = '';
    for await (const part of request) body += part;
    const result = JSON.parse(body);
    results.push(result);
    console.log(JSON.stringify(result));
    response.end('ok');
    return;
  }
  if (request.url === '/results') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(results));
    return;
  }
  const synchronized = request.url === '/after';
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>body{background:#10202a;color:#fff;font:20px monospace;padding:16px}pre{white-space:pre-wrap}a{color:#8fe3ff}</style>
<h1>Compressed upload: ${synchronized ? 'after' : 'before'}</h1>
<p><a href="/before">Before</a> · <a href="/after">After</a></p><pre id="result">Running…</pre><canvas hidden></canvas>
<script>
const synchronized = ${synchronized};
const canvas = document.querySelector('canvas');
const output = document.querySelector('#result');
let lost = false;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; output.textContent = 'FAIL: native GPU context lost'; });
const gl = canvas.getContext('webgl2');
if (!gl || !gl.getExtension('WEBGL_compressed_texture_astc') || !gl.getExtension('WEBGL_compressed_texture_etc')) {
  output.textContent = 'Unsupported: this reproduction requires ASTC and ETC2';
} else {
  const start = performance.now();
  // Nine Dragon phone upload shapes and order, captured before the native crash. Zero
  // blocks reproduce the same native copy failure, so no source artwork is needed.
  const astc = 0x93b0, srgb = 0x93d0, etc = 0x9274;
  const shapes = [[1024,1024,srgb],[1676,512,srgb],[1024,1024,srgb],[1024,1024,astc],
    [1024,1024,etc],[1024,1024,astc],[512,512,etc],[512,512,astc],
    [512,512,etc],[512,512,astc],[512,512,etc],[512,512,astc]];
  let bytes = 0, uploads = 0;
  const errors = [];
  for (const [width,height,format] of shapes) {
    const levels = 1 + Math.floor(Math.log2(Math.max(width,height)));
    gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
    gl.texStorage2D(gl.TEXTURE_2D,levels,format,width,height);
    for (let level = 0; level < levels; level++) {
      const w = Math.max(1,width >> level), h = Math.max(1,height >> level);
      const data = new Uint8Array(Math.ceil(w/4)*Math.ceil(h/4)*(format === etc ? 8 : 16));
      gl.compressedTexSubImage2D(gl.TEXTURE_2D,level,0,0,w,h,format,data);
      bytes += data.byteLength; uploads++;
    }
    if (synchronized) { const error = gl.getError(); if (error) errors.push(error); }
  }
  const uploadMs = Math.round(performance.now()-start);
  setTimeout(() => {
    const error = gl.getError(); if (error) errors.push(error);
    const result = { synchronized, passed: !lost && !gl.isContextLost() && errors.length === 0,
      lost, errors, uploads, bytes, uploadMs };
    output.textContent = JSON.stringify(result,null,2);
    fetch('/result',{method:'POST',body:JSON.stringify(result)});
  },1500);
}
</script>`);
}
const server = createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error(error);
    response.writeHead(500);
    response.end('Drill server failed');
  });
});
server.listen(port, '127.0.0.1', () => console.log(`iOS compressed upload drill: http://127.0.0.1:${port}/before and /after`));
