import subprocess,json,pathlib,sys
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
def ab(*args):
 p=subprocess.run(['agent-browser','--session','sol-x2b-l6',*args],capture_output=True,text=True,timeout=90)
 if p.returncode:raise RuntimeError(p.stderr+p.stdout)
 return p.stdout
results=json.loads((out/'capture.json').read_text()) if (out/'capture.json').exists() else {}
try:
 for role,port in [(sys.argv[2],int(sys.argv[3]))]:
  for shard in ['driftwood-isle','pine-hollow','nalati-grasslands','nine-dragon-stack']:
   ab('eval','localStorage.clear();')
   ab('open',f'http://127.0.0.1:{port}/?chunk={shard}&skipintro&nolock&touch&tier=phone&mute&sw=0')
   ab('wait','--fn','Boolean(window.__wildshard) && !document.querySelector(".ws-load")')
   ab('eval','window.__wildshard.world.hud.menu.openBag();')
   data=ab('eval','JSON.stringify([...document.querySelectorAll(".ws-gmenu-tab")].filter(b=>!b.hidden).map(b=>b.dataset.tab))')
   tabs=json.loads(json.loads(data))
   for tab in tabs:
    ab('eval',f'window.__wildshard.world.hud.menu.select({json.dumps(tab)});')
    ab('wait','--fn',f'document.querySelector(".ws-gmenu-panel.active") !== null')
    ab('screenshot',str(out/f'{role}.{shard}.{tab}.jpg'))
    details=ab('eval','JSON.stringify({html:document.querySelector(".ws-gmenu-panel.active").innerHTML,hint:document.querySelector(".ws-gmenu-hint").textContent,tabs:[...document.querySelectorAll(".ws-gmenu-tab")].filter(b=>!b.hidden).map(b=>b.dataset.tab)})')
    results[f'{role}.{shard}.{tab}']=json.loads(json.loads(details))
   print(role,shard,tabs,flush=True)
finally:
 ab('close')
 (out/'capture.json').write_text(json.dumps(results,indent=2))
