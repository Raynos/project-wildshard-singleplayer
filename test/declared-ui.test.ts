// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Read committed shardfile fixtures.
import { readFileSync, readdirSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { SystemSpec } from '../src/engine/app/systems';
import { BossBar } from '../src/engine/ui/BossBar';
import type { DeclaredHud } from '../src/engine/ui/declared';
import type { HudBand, DiscSpot } from '../src/engine/ui/hudSlots';
import type { TabFragment, TabSpec } from '../src/engine/ui/tabs';
import { mountDeclaredUi } from '../src/game/shard/declaredUi';
import { parseShardfile } from '../src/game/shardfile/schema';
import { UiSchema, uiRules, type ShardUiDeclaration } from '../src/game/shardfile/ui';
import { STRINGS } from '../src/shards/_template/strings';

const dir = 'test/fixtures/shardfile/';
const fields = v.array(v.object({ name: v.string(), type: v.picklist(['bool', 'i32', 'f64', 'string']) }));
/** the two sections the UI rules read, without the whole-file semantic check */
const sections = v.object({ ui: UiSchema, state: v.object({ shared: fields, player: fields }) });
const fixture = (): unknown => JSON.parse(readFileSync(`${dir}ui.json`, 'utf8'));
// The game's validated output is the engine's declared shape (no casts between the layers).
const engineShape = (d: ShardUiDeclaration): DeclaredHud | null => d.kind === 'bagPanel' ? null : d;

type Call = [string, ...unknown[]];
/** a recording stand-in for ctx.hud / ctx.bag / ctx.system: what was mounted, where, as which markup */
function recorder() {
  const calls: Call[] = [], systems: SystemSpec[] = [], scope = new Scope('declared.test');
  const html = (el: HTMLElement): string => el.outerHTML;
  return { calls, systems, scope,
    hud: {
      widget: (band: HudBand, el: HTMLElement, order: number) => { calls.push(['widget', band, html(el), order]); document.body.append(el); },
      pin: (at: Vector3 | (() => Vector3 | null), el: HTMLElement) => { calls.push(['pin', typeof at === 'function' ? at() : at, html(el)]); document.body.append(el); },
      relabel: (spot: DiscSpot, label: string, icon: string) => { calls.push(['relabel', spot, label, icon]); return () => undefined; },
    },
    bag: {
      tab: (spec: TabSpec) => { calls.push(['tab', spec]); },
      fragment: (tab: string, fragment: TabFragment) => { const host = document.createElement('div'); fragment.render(host); calls.push(['fragment', tab, fragment.id, fragment.order ?? 0, host.innerHTML]); },
    },
    system: (spec: SystemSpec) => { systems.push(spec); },
  };
}
const scopes: Scope[] = [];
afterEach(() => { for (const s of scopes.splice(0)) s.dispose(); document.body.replaceChildren(); });

describe('SF7f declared UI', () => {
  it('parses the fixture and every rejection fails for its own rule', () => {
    const parsed = parseShardfile(fixture());
    expect(parsed.ui.map((d) => d.kind)).toEqual(['marker', 'counter', 'bagPanel', 'bossPanel', 'relabel']);
    expect(parsed.ui.map(engineShape).filter((d) => d !== null)).toHaveLength(4);
    const rejects = readdirSync(dir).filter((f) => f.startsWith('reject-ui-'));
    expect(rejects.length).toBeGreaterThanOrEqual(14);
    for (const file of rejects) expect(() => parseShardfile(JSON.parse(readFileSync(dir + file, 'utf8'))), file).toThrow();
    const semantic: Record<string, string> = { 'boss-twice': 'one boss panel per encounter', 'counter-field': 'counter field lantern.missing',
      'counter-string-field': 'counter field lantern.oil', 'duplicate-id': 'unique ui ids', 'relabel-twice': 'one relabel per disc', 'tab-conflict': 'bag tab notes declared twice differently' };
    for (const [name, rule] of Object.entries(semantic)) {
      const raw = v.parse(sections, JSON.parse(readFileSync(`${dir}reject-ui-${name}.json`, 'utf8')));
      expect(uiRules(raw.ui, raw.state), name).toEqual([rule]);
    }
    const empty = parseShardfile(JSON.parse(readFileSync(`${dir}empty.json`, 'utf8')));
    expect(empty.ui).toEqual([]);
  });

  it('renders each kind from data exactly as the template builds it by hand today', () => {
    // today: src/shards/_template/plugin.ts play() (the meter, the relabel, the pin, the bag fragment)
    const today = recorder(); scopes.push(today.scope);
    let oil = 0.75;
    const meter = document.createElement('meter'); meter.min = 0; meter.max = 1; meter.value = oil; meter.setAttribute('aria-label', STRINGS.oil);
    today.hud.widget('band.3', meter, 0); today.hud.relabel('jump', STRINGS.toggle, '');
    const pin = document.createElement('span'); pin.textContent = STRINGS.hut; today.hud.pin(new Vector3(0, 1.15, -9), pin);
    today.bag.tab({ id: 'notes', title: STRINGS.notes, icon: 'book', order: 50 });
    today.bag.fragment('notes', { id: 'template.notes', render: (host) => { const p = document.createElement('p'); p.textContent = STRINGS.note; host.append(p); } });

    const declared = recorder(); scopes.push(declared.scope);
    const ui = parseShardfile(fixture()).ui;
    const handles = mountDeclaredUi(ui, { ...declared, read: (field) => field === 'lantern.oil' ? oil : Number.NaN, bossRoot: document.body });
    const sorted = (calls: Call[]): string[] => calls.map((c) => JSON.stringify(c)).sort();
    expect(sorted(declared.calls)).toEqual(sorted(today.calls));

    // the counter follows its field in the late phase, like today's template.oil system
    expect(declared.systems.map((s) => s.phase)).toEqual(['late']);
    oil = 0.25; for (const s of declared.systems) s.run(1 / 60, 0);
    expect(handles.counters.get('template.oil')?.value).toBe(0.25);
    expect(handles.markers.get('template.hut')?.textContent).toBe(STRINGS.hut);
  });

  it('draws the boss panel with the engine boss bar, identical markup at every step', () => {
    const scope = new Scope('declared.boss'); scopes.push(scope);
    const host = recorder(); scopes.push(host.scope);
    const ui = parseShardfile(fixture()).ui;
    const left = document.createElement('div'), right = document.createElement('div'); document.body.append(left, right);
    const handles = mountDeclaredUi(ui, { ...host, scope, read: () => 1, bossRoot: right });
    const boss = handles.bosses.get('template.boss');
    expect(boss?.definition).toEqual({ name: STRINGS.boss, title: STRINGS.bossTitle, retryTitle: STRINGS.retry });
    const today = new BossBar(left); scope.onDispose(() => { today.scope.dispose(); });
    for (const view of [today, boss?.presentation]) {
      view?.showNameCard(STRINGS.boss, STRINGS.bossTitle, false); view?.setSkip(0.5); view?.hideNameCard();
      view?.showBar(STRINGS.boss, [0.5]); view?.setHp(0.6); view?.setShield(true); view?.setPhase(1, STRINGS.phase2);
      view?.showRetry(STRINGS.retry, 2); view?.update(0.1);
    }
    expect(right.innerHTML).toBe(left.innerHTML);
    expect(right.querySelector('.show')).not.toBeNull();
    scope.dispose();
    expect(right.childElementCount).toBe(0);
  });

  it('never parses markup: labels are text and icons are engine ids', () => {
    const doc = fixture();
    const host = recorder(); scopes.push(host.scope);
    const ui = parseShardfile(doc).ui;
    for (const d of ui) if (d.kind === 'marker') d.label = '<img src=x onerror=alert(1)>';
    const handles = mountDeclaredUi(ui, { ...host, read: () => 1, bossRoot: document.body });
    expect(handles.markers.get('template.hut')?.childElementCount).toBe(0);
  });
});
