// Diagnostic CDP listener: inspect the trusted restore call's real locals before a caught exception unwinds.
export async function captureCaughtRestore(context, page, receipt) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.setPauseOnExceptions', { state: 'all' });
  const captures = []; receipt.caughtRestore = captures;
  cdp.on('Debugger.paused', async pause => {
    const message = pause.data?.description ?? pause.data?.value ?? '';
    try {
      if (!/Missing stable runtime creature|Runtime creature identity changed/u.test(message)) return;
      const record = { reason: pause.reason, message, frames: [], rosters: [], saved: [] }; captures.push(record);
      for (const frame of pause.callFrames.slice(0, 6)) {
        const row = { functionName: frame.functionName, url: frame.url, location: frame.location, locals: [] }; record.frames.push(row);
        for (const scope of frame.scopeChain.filter(s => s.type === 'local' || s.type === 'closure')) {
          const properties = await cdp.send('Runtime.getProperties', { objectId: scope.object.objectId, ownProperties: true });
          for (const property of properties.result) {
            const value = property.value;
            row.locals.push({ name: property.name, type: value?.type, description: value?.description, value: value?.value });
            if (value?.type !== 'object' || value.objectId === undefined) continue;
            const result = await cdp.send('Runtime.callFunctionOn', { objectId: value.objectId, returnByValue: true,
              functionDeclaration: `function() {
                const actors = Array.isArray(this.animals) ? this.animals : this instanceof Map ? [...this.values()].filter(a => a && typeof a.entityId === 'string') : null;
                if (actors) return { kind: 'rebuilt', actors: actors.map(a => ({ id: a.entityId, kind: a.kind, hp: a.hp, maxHp: a.maxHp, alive: a.alive, x: a.position?.x, y: a.position?.y, z: a.position?.z })) };
                if (Array.isArray(this.actors)) return { kind: 'saved', revision: this.revision, actors: this.actors };
                if (typeof this.id === 'string' && typeof this.kind === 'string') return { kind: 'row', row: { id: this.id, kind: this.kind, hp: this.hp, maxHp: this.maxHp } };
                return null;
              }` });
            const data = result.result.value;
            if (data?.kind === 'rebuilt') record.rosters.push({ frame: frame.functionName, variable: property.name, ...data });
            if (data?.kind === 'saved' || data?.kind === 'row') record.saved.push({ frame: frame.functionName, variable: property.name, ...data });
          }
        }
      }
      console.log('caught restore', message.split('\n')[0], 'rebuilt roster', JSON.stringify(record.rosters[0]?.actors));
    } catch (e) { receipt.cdpFailure = String(e?.stack ?? e); }
    finally {
      await cdp.send('Debugger.resume').catch(() => undefined);
      if (/Missing stable runtime creature|Runtime creature identity changed/u.test(message)) {
        await cdp.send('Runtime.evaluate', { expression: `window.__sf48RestoreException = ${JSON.stringify(message)}` }).catch(() => undefined);
      }
    }
  });
  return async () => { await cdp.detach(); };
}
