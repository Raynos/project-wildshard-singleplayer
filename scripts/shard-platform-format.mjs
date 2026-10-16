// Node census tools use the defining format contract without booting application services.
// Resolve only format's own extensionless TS edges; game/engine/runtime imports are untouched.
import { registerHooks } from 'node:module';
import { existsSync,statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const formatRoot=new URL('../src/format/',import.meta.url).href;
registerHooks({resolve(specifier,context,next) {
  if(specifier.startsWith('.')&&context.parentURL?.startsWith(formatRoot)) {
    const base=new URL(specifier,context.parentURL);
    for(const suffix of ['', '.ts', '/index.ts']) {
      const url=new URL(base.href+suffix),file=fileURLToPath(url);
      if(existsSync(file)&&statSync(file).isFile())return {url:url.href,shortCircuit:true};
    }
  }
  return next(specifier,context);
}});
export const outputFormat=await import('@wildshard/format/outputIndex');
