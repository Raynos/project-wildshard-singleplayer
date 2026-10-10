import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { App } from '../../../src/engine/app/app';
import { Scope } from '../../../src/engine/app/scope';
import { Shared } from '../../../src/shards/nine-dragon-stack/look/style';
import { JiehuaEffect } from '../../../src/shards/nine-dragon-stack/look/render/jiehua';
import { BLEED } from '../../../src/shards/nine-dragon-stack/data/passes';
import { glowUniforms } from '../../../src/shards/nine-dragon-stack/look/light/glow';
import { gradeUniforms } from '../../../src/shards/nine-dragon-stack/look/light/grade';
import { installRenderEvents } from '../../../src/shards/nine-dragon-stack/look/renderEvents';

describe('scoped Nine Dragon render events', () => {
  it('toggles practice and studio effects, restores air and drops listeners on unload', () => {
    const app = new App(), scope = new Scope('look'), shared = new Shared();
    const jiehua = new JiehuaEffect(new PerspectiveCamera(), shared, glowUniforms(), gradeUniforms());
    const air = shared.u.uFogBase.value, depths = shared.u.uBands.value.map((band) => band.z);
    installRenderEvents({ app, scope }, { shared, jiehua });
    expect(app.events.census().listeners).toBe(2);
    app.events.emit('practice.active', true); app.events.flush('update');
    expect(jiehua.u.uRain.value.x).toBe(0); expect(jiehua.blendMode.opacity.value).toBe(0);
    app.events.emit('practice.active', false); app.events.flush('update');
    expect(jiehua.u.uRain.value.x).toBe(BLEED.rain); expect(jiehua.blendMode.opacity.value).toBe(1);
    app.events.emit('explore.studio', true); app.events.flush('update');
    expect(shared.u.uFogBase.value).toBe(0); expect(shared.u.uBands.value.every((band) => band.z === 0)).toBe(true);
    app.events.emit('explore.studio', true); app.events.flush('update');
    app.events.emit('explore.studio', false); app.events.flush('update');
    expect(shared.u.uFogBase.value).toBe(air); expect(shared.u.uBands.value.map((band) => band.z)).toEqual(depths);
    app.events.emit('explore.studio', true); app.events.flush('update'); scope.dispose();
    expect(app.events.census().listeners).toBe(0); expect(shared.u.uFogBase.value).toBe(air);
    expect(shared.u.uBands.value.map((band) => band.z)).toEqual(depths);
    app.events.emit('practice.active', true); app.events.flush('update');
    expect(jiehua.blendMode.opacity.value).toBe(1);
    jiehua.dispose();
  });
});
