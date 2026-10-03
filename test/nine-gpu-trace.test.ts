import { describe, expect, it } from 'vitest';
import { Pass } from 'postprocessing';
import { traceBootPasses } from '#engine/boot/gpuTrace';


class ProbePass extends Pass {
  calls = 0;
  fail = false;
  override render(): void {
    this.calls++;
    if (this.fail) throw new Error('synthetic render failure');
  }
}

describe('Nine Dragon first-draw tracing', () => {
  it('records the pending pass on failure and restores rendering afterwards', () => {
    const pass = new ProbePass('Probe');
    const operations: string[] = [];
    pass.fail = true;
    expect(() => { traceBootPasses([pass], (op) => { operations.push(op); }, () => { pass.render(); }); }).toThrow('synthetic render failure');
    expect(operations).toEqual(['pass:0:Probe:before']);
    pass.fail = false;
    pass.render();
    expect(pass.calls).toBe(2);
    expect(operations).toHaveLength(1);
  });

  it('marks submission without claiming the GPU has completed its work', () => {
    const pass = new ProbePass('Probe');
    const operations: string[] = [];
    traceBootPasses([pass], (op) => { operations.push(op); }, () => { pass.render(); });
    expect(operations).toEqual(['pass:0:Probe:before', 'pass:0:Probe:submitted']);
    pass.render();
    expect(operations).toHaveLength(2);
  });
});
