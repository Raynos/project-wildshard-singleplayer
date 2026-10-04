import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../../src/engine/app/scope';
import { installAtmosphere, weatherFog, weatherFogUniforms } from '../../src/engine/world/Atmosphere';

// The engine fog installs once a page (one Game per page; travel navigates), so this file installs it once, opted in.
describe('weather fog (E390)', () => {
  it('needs the level to opt in, eases by strength and clears with its scope', () => {
    expect(() => weatherFog(new Scope('early'), { dist: 0.05, color: 0x8a5238 })).toThrow(/atmosphere.weather/);
    installAtmosphere({ weather: true });
    expect(THREE.ShaderChunk.fog_fragment).toContain('fogWeather');
    const scope = new Scope('storm');
    const storm = weatherFog(scope, { dist: 0.05, color: 0x8a5238 });
    const u = weatherFogUniforms.fogWeather.value;
    expect(u.z).toBe(0);
    storm.set(0.5); expect(u.x).toBe(0.05); expect(u.z).toBe(0.5);
    storm.set(3); expect(u.z).toBe(1);
    expect(weatherFogUniforms.fogWeatherColor.value.getHex()).toBe(0x8a5238);
    scope.dispose(); expect(u.z).toBe(0);
  });
});
