/** Mechanical capture of the shipping setup/decision/body spans; no policy is handwritten in the oracle. */
export function captureFlock(source: string): string {
  const span = (start: string, end: string): string => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error(`Missing shipping flock span: ${start}`);
    return source.slice(a, b);
  };
  const fields = span('  readonly n:', '  private readonly scheduler')
    .replace('dog: Animal', 'dog: OracleThreat').replace('  private anim!: THREE.InstancedBufferAttribute;\n', '');
  const constructor = span('  constructor(private readonly sky:', '  static ofDog')
    .replace('constructor(private readonly sky: Sky, opts: FlockOpts)', 'constructor(private readonly ports: OraclePorts, opts: OracleOpts)')
    .replace('    super([]);\n', '')
    .replace('    for (let i = 0; i < n; i++) this.members.push(new SheepPrey(this, i));\n', '');
  const setup = span('    const rng = this.rng;', '    if (mesh.instanceColor')
    .replace('      mesh.setColorAt(i, wool[r < 0.62 ? 0 : r < 0.8 ? 1 : r < 0.93 ? 2 : 3] ?? new THREE.Color(1, 1, 1));',
      '      this.wool[i] = r < 0.62 ? 0 : r < 0.8 ? 1 : r < 0.93 ? 2 : 3;');
  const life = span('  /** a sheep dies', '  update(dt:');
  const update = span('  update(dt:', '  private think(')
    .replace('wolves: readonly Animal[]', 'wolves: readonly OracleThreat[]').replace('    this.writeInstances();\n', '');
  const think = span('  private think(', '  /** a straggler')
    .replace('wolves: readonly Animal[]', 'wolves: readonly OracleThreat[]')
    .replace('    if (this.mesh.boundingSphere !== null) { this.mesh.boundingSphere.center.set(this.cx, heightAt(this.cx, this.cz), this.cz); this.mesh.boundingSphere.radius = 30; }',
      '    this.ports.centre(this.cx, heightAt(this.cx, this.cz), this.cz);');
  const query = span('  /** a straggler', '  private writeInstances()');
  const adapt = (body: string): string => body.replaceAll('heightAt(', 'this.ports.heightAt(')
    .replaceAll('normalAt(', 'this.ports.normalAt(').replaceAll('wildEnv.', 'this.ports.')
    .replaceAll('angDiff(', 'angleDifference(');
  return `// Generated mechanically from shipping.txt by capture.ts; the source hash fences the oracle.\n`
    + `import * as THREE from 'three';\nimport { Rng } from '../../../src/engine/core/rng';\n`
    + `import { TickScheduler } from '../../../src/engine/app/scheduler';\n`
    + `export interface OracleThreat { alive: boolean; position: THREE.Vector3 }\n`
    + `export interface OracleOpts { x: number; z: number; count: number; seed: number; range?: number }\n`
    + `export interface OraclePorts { heightAt(x: number, z: number): number; normalAt(x: number, z: number): readonly [number, number, number]; wetAt(x: number, z: number): boolean; playerCrouched: boolean; grassHeightAt(x: number, z: number): number; trample(x: number, z: number, radius: number, strength: number, vx: number, vz: number): void; centre(x: number, y: number, z: number): void }\n`
    + `const RUN = 4.6, WALK = 0.9, GRAZE_STEP = 0.35;\n`
    + `function angleDifference(a: number, b: number): number { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }\n`
    + `function inChunk(x: number, z: number, margin = 0): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }\n`
    + `export class ShippingFlock {\n` + fields
    + `  private readonly scheduler = new TickScheduler();\n  private readonly tickActor = { position: new THREE.Vector3() };\n  private uTime = { value: 0 };\n  readonly wool: number[] = [];\n  alive: number;\n`
    + constructor + `  initialize(): void {\n` + adapt(setup) + `  }\n`
    + adapt(life + update + think + query)
    + `  state(): object { return { n: this.n, alive: this.alive, cx: this.cx, cz: this.cz, tx: this.tx, tz: this.tz, tT: this.tT, panic: this.panic, panicX: this.panicX, panicZ: this.panicZ, bleatT: this.bleatT, wool: [...this.wool], px: [...this.px], pz: [...this.pz], py: [...this.py], yaw: [...this.yaw], spd: [...this.spd], dspd: [...this.dspd], dyaw: [...this.dyaw], phase: [...this.phase], graze: [...this.graze], dead: [...this.dead], deadT: [...this.deadT], shuffle: [...this.shuffle], scale: [...this.scale], time: this.uTime.value, rng: this.rng.snapshot() }; }\n}\n`;
}
