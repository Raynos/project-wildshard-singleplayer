import * as THREE from 'three';
import type { AnimalSim as Animal } from '../../../src/engine/entities/AnimalSim';
import type { QyranPorts } from '../../../src/shards/nalati-grasslands/runtime/qyranKeeper';
/** Authenticated shipping method bodies with only view/environment services injected. */
export class QyranOracle {
  private st: 'soar' | 'tell' | 'stoop' | 'ground' | 'climb' = 'soar';
  private stT = 0; private stoopT = 8; private ang = 0; private overYou = false;
  private centre = new THREE.Vector3(); private tgt = new THREE.Vector3();
  private readonly line; private readonly lineMat; private readonly env;
  constructor(private readonly ports: QyranPorts<Animal>, private readonly animal: Animal) {
    const uniforms = { uTime: { set value(t: number) { ports.tell.setTime(t); } } };
    this.lineMat = { uniforms };
    this.line = { set visible(on: boolean) { if (!on) ports.tell.hide(); } };
    this.env = { player: ports.player, hurt: ports.hurt, knock: ports.knock, feed: ports.feed, sound: ports.sound,
      game: { camera: null }, bar: { chevron: (point: THREE.Vector3 | null, _camera: null): void => { ports.tell.chevron(point); } } };
  }
  private get p2(): boolean { return this.ports.phase2(); }
  private engagement(_engaged: boolean): void { /* view-only pinning */ }
  private sig(): void { this.ports.signature(); }
  private aim(from: THREE.Vector3, to: THREE.Vector3, alpha: number): void { this.ports.tell.aim(from, to, alpha); }
  private spawnAt(_kind: string, _variant: string, x: number, z: number, yaw: number): Animal { this.animal.place(x, z, yaw); return this.animal; }
  reset(): void { this.st = 'climb'; this.line.visible = false; }
  private cruise(): number {
    const EAGLE_ROCK = this.ports.rock;
    const heightAt = this.ports.heightAt;
// BEGIN SHIPPING cruise

    if (!this.overYou) return EAGLE_ROCK.top + (this.p2 ? 52 : 34);
    // over you — but never inside the rock's flank the orbit swings across: 18 m clear of the ground under him
    const a = this.animal, over = a ? heightAt(a.position.x, a.position.z) + 18 : -Infinity;
    return Math.max(this.env.player.position.y + (this.p2 ? 36 : 24), over);
  
// END SHIPPING cruise
  }
  spawn(): void {
    const EAGLE_ROCK = this.ports.rock;
    const EAGLE = 'eagle';
// BEGIN SHIPPING spawn

    this.centre.set(EAGLE_ROCK.x, 0, EAGLE_ROCK.z);
    const a = this.spawnAt(EAGLE, 'qyran', EAGLE_ROCK.x + 26, EAGLE_ROCK.z, 0);
    a.mem['altY'] = this.cruise(); a.mem['flap'] = 0.3;
    this.st = 'soar'; this.stoopT = 8;
  
// END SHIPPING spawn
  }
  damage(a: Animal, p: THREE.Vector3): number {
    const isHead = this.ports.isHead;
// BEGIN SHIPPING damage

    if (this.st === 'ground') return isHead(a, p) ? 1 : 2.5;       // grounded: every hit a headshot
    return 1;
  
// END SHIPPING damage
  }
  think(a: Animal, c: { readonly player: THREE.Vector3 }): void {
// BEGIN SHIPPING think
 a.lookTarget.copy(c.player); a.lookWeight = 1; a.setMotion(a.yaw, 0, 1); 
// END SHIPPING think
  }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const EAGLE_ROCK = this.ports.rock;
    const heightAt = this.ports.heightAt;
    const wildEnv = { wind: this.ports.wind() };
    const _v = new THREE.Vector3();
    const _w = new THREE.Vector3();
    const app = { rng: { stream: (_name: string) => ({ next: this.ports.random }) } };
// BEGIN SHIPPING tick

    this.engagement(engaged);
    const a = this.animal;
    if (!a) return;
    this.lineMat.uniforms.uTime.value = t;
    this.stT += dt;
    const p = this.env.player.position, m = a.mem;
    // the orbit centre: over you while engaged, back over the rock otherwise; always drifting downwind
    const home = leashing || !engaged;
    this.overYou = !home;
    const cx = home ? EAGLE_ROCK.x : p.x, cz = home ? EAGLE_ROCK.z : p.z;
    this.centre.x += (cx + wildEnv.wind.x * 12 - this.centre.x) * Math.min(1, dt * 0.4);
    this.centre.z += (cz + wildEnv.wind.z * 12 - this.centre.z) * Math.min(1, dt * 0.4);
    const R = 22;
    switch (this.st) {
      case 'soar': case 'climb': {
        this.ang += dt * 12 / R;
        const tx = this.centre.x + Math.cos(this.ang) * R, tz = this.centre.z + Math.sin(this.ang) * R;
        const k = this.st === 'climb' ? 1.5 : 3;
        a.position.x += (tx - a.position.x) * Math.min(1, dt * k); a.position.z += (tz - a.position.z) * Math.min(1, dt * k);
        a.yaw = a.desiredYaw = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang));
        const cruise = this.cruise();
        const alt = m['altY'] ?? cruise;
        m['altY'] = this.st === 'climb' ? Math.min(cruise, alt + 9 * dt) : alt + (cruise + 2 * Math.sin(t * 0.5) - alt) * Math.min(1, dt * 0.6);
        m['flap'] = this.st === 'climb' ? 0.9 : 0.18 + 0.12 * Math.max(0, Math.sin(t * 0.6)); m['fold'] = 0; m['ground'] = 0; m['bank'] = 0.35;
        if (this.st === 'climb' && (m['altY'] ?? 0) >= cruise - 0.5) this.st = 'soar';
        if (engaged && this.st === 'soar') { this.stoopT -= dt; if (this.stoopT <= 0) { this.st = 'tell'; this.stT = 0; this.sig(); this.env.sound('eagle_cry', a.position); } }
        break;
      }
      case 'tell': {
        // hangs on the wind, wings half folding; a gold line streaks from it to you, the chevron at the screen edge
        const T = this.p2 ? 0.9 : 1.2;
        m['flap'] = 0.7; m['fold'] = 0.4 * (this.stT / T); m['bank'] = 0;
        a.yaw = a.desiredYaw = Math.atan2(p.x - a.position.x, p.z - a.position.z);
        a.headWorld(_v);
        _w.set(p.x, p.y + 1.2, p.z);
        this.aim(_v, _w, 0.4 + 0.6 * (this.stT / T));
        this.env.bar.chevron(_v, this.env.game.camera);
        if (this.stT >= T) { this.st = 'stoop'; this.stT = 0; this.tgt.set(p.x, p.y + 0.9, p.z); }
        break;
      }
      case 'stoop': {
        m['fold'] = 1; m['flap'] = 0;
        _v.set(a.position.x, m['altY'] ?? 0, a.position.z);
        _w.copy(this.tgt).sub(_v);
        const L = _w.length(), step = 40 * dt;
        this.aim(_v, this.tgt, 0.5);
        this.env.bar.chevron(_v, this.env.game.camera);
        if (L <= step + 0.6) {
          this.line.visible = false; this.env.bar.chevron(null, this.env.game.camera);
          a.position.x = this.tgt.x; a.position.z = this.tgt.z;
          if (Math.hypot(p.x - this.tgt.x, p.z - this.tgt.z) < 2.4 && p.y - heightAt(p.x, p.z) < 1.5) {
            this.env.hurt(a, 30); this.env.knock(p.x - _v.x, p.z - _v.z);
            this.st = 'climb'; m['altY'] = this.tgt.y + 2;
          } else { this.st = 'ground'; this.stT = 0; m['altY'] = heightAt(a.position.x, a.position.z) + 0.55 * a.scale; this.env.feed('Qyran is GROUNDED'); }
          this.stoopT = this.p2 ? 4.5 + app.rng.stream('ai').next() * 1.5 : 7 + app.rng.stream('ai').next() * 2;
        } else {
          _w.multiplyScalar(step / L);
          a.position.x += _w.x; a.position.z += _w.z; m['altY'] = (m['altY'] ?? 0) + _w.y; m['altS'] = m['altY'];
          a.yaw = a.desiredYaw = Math.atan2(_w.x, _w.z);
        }
        break;
      }
      case 'ground': {
        m['ground'] = 1; m['fold'] = 0; m['flap'] = 0;
        m['altY'] = heightAt(a.position.x, a.position.z) + 0.42 * a.scale;
        if (this.stT > 2) { this.st = 'climb'; m['ground'] = 0; }
        break;
      }
      default: break;
    }
    if (this.st !== 'tell' && this.st !== 'stoop') { this.line.visible = false; this.env.bar.chevron(null, this.env.game.camera); }
  
// END SHIPPING tick
  }
  snapshot() { return { st: this.st, stT: this.stT, stoopT: this.stoopT, ang: this.ang, centre: [this.centre.x, this.centre.y, this.centre.z], tgt: [this.tgt.x, this.tgt.y, this.tgt.z], overYou: this.overYou }; }
}
