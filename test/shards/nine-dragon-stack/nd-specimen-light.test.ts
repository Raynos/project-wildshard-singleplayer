// E315: the Model Explorer lights Nine Dragon's specimens like a studio (look/specimenLight.ts) — only while the turntable
// is up, and puts the city's light back exactly when it closes (the world is never left in the studio's light).
import { describe, expect, it } from 'vitest';
import { Shared } from '#shards/nine-dragon-stack/look/style';
import { SPECIMEN_LIGHT, specimenLight } from '#shards/nine-dragon-stack/look/specimenLight';

describe("Nine Dragon's specimen light (E315)", () => {
  it('raises the ambient, lifts the shade, keys from the turntable side, dries the washes — then puts all four back', () => {
    const s = new Shared(), u = s.u;
    const city = { amb: u.uLpAmb.value, shade: u.uShade.value.clone(), light: u.uLightDir.value.clone(), dry: u.uDry.value };
    expect(city.dry).toBe(0); // the world's washes stay wet
    specimenLight(s, true, { x: 0.93, z: -0.34 });
    expect(u.uLpAmb.value).toBe(SPECIMEN_LIGHT.ambient);
    expect(u.uShade.value.r).toBeGreaterThan(city.shade.r);
    expect(u.uShade.value.b).toBeGreaterThan(city.shade.b);
    expect(u.uDry.value).toBe(1);
    const l = u.uLightDir.value;
    expect(l.length()).toBeCloseTo(1, 6);
    expect(l.y).toBeGreaterThan(0.9); // top light, as the look's
    expect(Math.atan2(l.x, l.z)).toBeCloseTo(Math.atan2(0.93, -0.34), 6); // from the side the turntable opens on
    specimenLight(s, true, { x: 0, z: 1 }); // (a second model on the turntable: already lit, nothing stacks)
    expect(Math.atan2(u.uLightDir.value.x, u.uLightDir.value.z)).toBeCloseTo(Math.atan2(0.93, -0.34), 6);
    specimenLight(s, false);
    expect(u.uLpAmb.value).toBe(city.amb);
    expect(u.uShade.value.equals(city.shade)).toBe(true);
    expect(u.uLightDir.value.equals(city.light)).toBe(true);
    expect(u.uDry.value).toBe(city.dry);
    specimenLight(s, false); // (closing twice changes nothing)
    expect(u.uLpAmb.value).toBe(city.amb);
  });
});
