/**
 * The cell screen (SHARD-PLATFORM SF18b / SF58, Jake's G217): a neighbour you can't enter (its shard is loading, waiting
 * for its shardfile, or refused) shows **the full Developer loading screen of the SHARD SELECT flow** (`Loading.ts`: the
 * wordmark, "LOADING CHUNK · <shard>", the tier / memory / build lines, the DOWNLOAD and SETUP tracks, the step log and the
 * diagnostics), drawn in 3D on its cell at its soft wall, facing the road, **for everyone**. It replaced the soft wall's
 * LOADING bar and G167's refused look (the grey far view under a dome, the void and the SHARD UNAVAILABLE sign).
 *
 * The pure part, `cellScreenContent`, maps the cell's live state (a read-only snapshot the session composes from the
 * readiness stages, the admission's refusal, the one allocator and the far view) to the screen's text; `drawCellScreen`
 * paints it on a 2D canvas. `installCellScreens` keeps a small pool of world-space panels (one per unenterable cell, the
 * nearest `slots` of them): one mesh and one CanvasTexture each, redrawn only when the screen's text changes (a loading
 * cell's clock ticks in whole seconds), never per frame. Each live slot is admitted before allocation and freed outside
 * the existing nearest-cell/distance selection; hidden canvases never remain as an unbounded cache.
 */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from 'three';
import { PlatformRenderAdmissionError, type PlatformRenderAdmission } from './renderResidency';
import { refusalReason, type FarViewStatus, type ShardRefusal } from './refusal';
import { GAME_STRINGS } from '../strings';

/** Why the cell can't be entered now. */
export type CellScreenStatus = 'loading' | 'waiting' | 'refused';
/** What a waiting cell waits for: a shardfile at all, or the hybrid runtime (both arrive in M3). */
export type CellWait = 'format' | 'hybrid';
/** One cell's live state, read through the session's read-only port (null from the port: the cell can be entered). */
export interface CellScreenInput {
  readonly instance: string; readonly slug: string; readonly name: string;
  readonly status: CellScreenStatus;
  readonly refusal: ShardRefusal | null;
  readonly wait: CellWait | null;
  /** the admission's own message (a refusal's or a wait's), for the diagnostics */
  readonly issue: string | null;
  readonly far: FarViewStatus;
  /** the readiness stages: requested, the admitted product, the runtime, the colliders, the sim */
  readonly requested: boolean; readonly product: boolean; readonly runtime: boolean; readonly colliders: boolean; readonly sim: boolean;
  /** this cell's claims in the one allocator (its own and its shared product) */
  readonly claimedBytes: number; readonly claims: number;
  /** the readiness bundle's declared critical wire bytes (0: none declared) */
  readonly declaredBytes: number;
  /** the page's playing cost and the envelope (§3.2) */
  readonly pageBytes: number; readonly capBytes: number;
  /** G216: bytes past the envelope this cell's claim was admitted with under Developer (0: within it), from the page's memory reports */
  readonly overBytes: number;
}
/** What the installer adds: the build, the tier and a loading cell's whole seconds since it was first seen loading. */
export interface CellScreenFrame { readonly build: string; readonly tier: string; readonly elapsedS: number | null }
export type CellScreenRowState = 'ok' | 'on' | 'todo' | 'fail';
export interface CellScreenRow { readonly label: string; readonly detail: string; readonly state: CellScreenRowState }
export interface CellScreenTrack { readonly name: string; readonly fact: string; readonly pct: number }
/** The screen's text, exactly as drawn. */
export interface CellScreen {
  readonly status: CellScreenStatus;
  readonly kicker: string; readonly title: string; readonly chip: string; readonly clock: string; readonly build: string;
  readonly meta: readonly (readonly [string, string])[];
  /** the reason (refused) or the wait (waiting), big, with its second line; null while loading */
  readonly headline: string | null; readonly sub: string | null;
  readonly tracks: readonly [CellScreenTrack, CellScreenTrack];
  readonly rows: readonly CellScreenRow[];
  readonly diagnostics: readonly string[];
  /** the player's one bar (both tracks, half each) and its line */
  readonly bar: number; readonly line: string;
}

const S = GAME_STRINGS.grid.screen;
/** decimal MB (10^6), the allocator's and the PTS overlay's unit */
const formatMB = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;
const pct = (fraction: number): number => Math.floor(Math.max(0, Math.min(1, fraction)) * 100); // 100 only when done
const short = (build: string): string => (build === '' ? 'dev' : build.slice(0, 9));
/** split a long admission message into at most `lines` lines of `width` characters */
function wrap(text: string, width: number, lines: number): string[] {
  const out: string[] = []; let rest = text.replaceAll(/\s+/gu, ' ').trim();
  while (rest.length > 0 && out.length < lines) {
    if (rest.length <= width) { out.push(rest); rest = ''; break; }
    const cut = rest.lastIndexOf(' ', width); const at = cut > width / 2 ? cut : width;
    out.push(rest.slice(0, at)); rest = rest.slice(at).trim();
  }
  if (rest.length > 0 && out.length > 0) out[out.length - 1] = `${(out.at(-1) ?? '').slice(0, width - 1)}…`;
  return out;
}

/** The state → screen mapping (pure: the tests read it, the painter draws it). */
export function cellScreenContent(input: CellScreenInput, frame: CellScreenFrame): CellScreen {
  const { status } = input;
  const stages = [
    { label: S.rows.product, done: input.product }, { label: S.rows.runtime, done: input.product && input.runtime },
    { label: S.rows.colliders, done: input.colliders }, { label: S.rows.sim, done: input.sim },
  ];
  const doneCount = stages.filter((stage) => stage.done).length, current = stages.find((stage) => !stage.done);
  // a refusal lands on the first stage that did not finish (the product when nothing did)
  const failedAt = status === 'refused' ? current?.label ?? S.rows.sim : null;
  const rowState = (done: boolean, label: string): CellScreenRowState => (done ? 'ok' : label === failedAt ? 'fail' : status === 'loading' && input.requested && label === current?.label ? 'on' : 'todo');
  const declared = input.declaredBytes > 0 ? formatMB(input.declaredBytes) : '—';
  const far: CellScreenRow = { label: S.rows.far, detail: S.far[input.far], state: input.far === 'resident' ? 'ok' : input.far === 'loading' ? 'on' : 'fail' };
  const reason = input.refusal === null ? null : refusalReason(input.refusal);
  let rows: CellScreenRow[], tracks: [CellScreenTrack, CellScreenTrack];
  if (status === 'waiting') {
    rows = [far, { label: S.rows.shardfile, detail: S.shardfile[input.wait ?? 'format'], state: 'fail' }, { label: S.rows.select, detail: S.select, state: 'ok' },
      { label: S.rows.wall, detail: S.wall.closed, state: 'todo' }];
    tracks = [{ name: S.download, fact: S.noProduct, pct: 0 }, { name: S.setup, fact: S.setupFact(0, stages.length, S.rows.shardfile), pct: 0 }];
  } else {
    const productState = input.product ? S.state.admitted : status === 'refused' ? S.state.refused : input.requested ? S.state.admitting : S.state.queued;
    rows = [far, { label: S.rows.request, detail: input.requested || status === 'refused' ? S.request.on : S.request.todo, state: input.requested || status === 'refused' ? 'ok' : 'todo' },
      ...stages.map((stage): CellScreenRow => {
        const state = rowState(stage.done, stage.label);
        const detail = state === 'ok' ? (stage.label === S.rows.product ? `${S.done} · ${formatMB(input.claimedBytes)}` : S.done) : state === 'fail' ? reason ?? S.failed : S.pending;
        return { label: stage.label, detail, state };
      }),
      { label: S.rows.wall, detail: status === 'refused' ? S.wall.refused : S.wall.closed, state: status === 'refused' ? 'fail' : 'todo' }];
    tracks = [{ name: S.download, fact: S.productFact(productState, declared), pct: input.product ? 100 : 0 },
      { name: S.setup, fact: S.setupFact(Math.min(doneCount + 1, stages.length), stages.length, failedAt ?? current?.label ?? S.done), pct: pct(doneCount / stages.length) }];
  }
  const elapsed = frame.elapsedS;
  const clock = elapsed === null ? '--:--' : `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const diagnostics = [S.claims(input.claims, declared), ...(input.issue === null ? [] : wrap(input.issue, 46, 3))];
  if (status === 'waiting') diagnostics.splice(1, 0, ...wrap(S.waitingWhy, 46, 2));
  const bar = status === 'waiting' ? 0 : (tracks[0].pct + tracks[1].pct) / 200;
  return {
    status, kicker: S.kicker[status], title: input.name, chip: S.chip[status], clock, build: S.build(short(frame.build)),
    meta: [[S.meta.memory, S.memory(formatMB(input.claimedBytes), formatMB(input.pageBytes), formatMB(input.capBytes))],
      ...(input.overBytes > 0 ? [[S.meta.over, S.over(formatMB(input.overBytes))] as const] : []), [S.meta.tier, frame.tier], [S.meta.cell, input.instance], [S.meta.build, short(frame.build)]],
    headline: status === 'refused' ? GAME_STRINGS.unavailable.line(input.name, reason ?? S.failed) : status === 'waiting' ? GAME_STRINGS.grid.waiting(input.name) : null,
    sub: status === 'refused' ? GAME_STRINGS.upgrade.saveKept : status === 'waiting' ? GAME_STRINGS.grid.waitingSelect : null,
    tracks, rows, diagnostics,
    bar, line: status === 'loading' ? S.line.loading(pct(bar)) : status === 'waiting' ? S.line.waiting : reason ?? S.failed,
  };
}

/** The canvas's size (px) and the panel's (m): 1024 × 640 over 10.4 × 6.5 m, ~98 px a metre. */
export const SCREEN_PX = { w: 1024, h: 640 } as const;
export const SCREEN_M = { w: 10.4, h: 6.5, bottom: 0.4 } as const;
const CYAN = '#8fe3ff', CYAN_DIM = 'rgba(143, 227, 255, 0.62)', LINE = 'rgba(143, 227, 255, 0.35)', TEXT = '#e6f2f8', DIM = 'rgba(196, 220, 232, 0.66)', AMBER = '#ffb547';
const DISPLAY = "'Rajdhani', 'Bahnschrift', 'DIN Alternate', 'Helvetica Neue', Arial, sans-serif", MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

/** The 2D calls the painter uses (a browser canvas context, or a test's recorder). */
export type ScreenContext = Pick<CanvasRenderingContext2D, 'fillRect' | 'strokeRect' | 'fillText' | 'measureText' | 'save' | 'restore' | 'translate' | 'scale' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'drawImage'>
  & { fillStyle: CanvasRenderingContext2D['fillStyle']; strokeStyle: CanvasRenderingContext2D['strokeStyle']; lineWidth: number; font: string; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline; globalAlpha: number;
    createLinearGradient?: CanvasRenderingContext2D['createLinearGradient']; createRadialGradient?: CanvasRenderingContext2D['createRadialGradient'] };

/** Paint the live loading facts; `near` uses large essential text at the soft wall, otherwise full diagnostics. */
export function drawCellScreen(g: ScreenContext, screen: CellScreen, art: CanvasImageSource | null, near = false): void {
  const { w, h } = SCREEN_PX, accent = screen.status === 'refused' ? AMBER : CYAN;
  // background: the loading screen's radial dark, the shard's card under a dark veil, faint scanlines
  const radial = g.createRadialGradient?.(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.75);
  if (radial !== undefined) { radial.addColorStop(0, '#0d1a26'); radial.addColorStop(0.6, '#06090f'); radial.addColorStop(1, '#030508'); g.fillStyle = radial; } else g.fillStyle = '#06090f';
  g.fillRect(0, 0, w, h);
  if (art !== null) {
    g.globalAlpha = 0.42; g.drawImage(art, 0, 0, w, h); g.globalAlpha = 1;
    const veil = g.createLinearGradient?.(0, 0, 0, h);
    if (veil !== undefined) { veil.addColorStop(0, 'rgba(3, 8, 15, 0.55)'); veil.addColorStop(0.54, 'rgba(3, 8, 15, 0.8)'); veil.addColorStop(1, 'rgba(3, 8, 15, 0.92)'); g.fillStyle = veil; } else g.fillStyle = 'rgba(3, 8, 15, 0.78)';
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = 'rgba(143, 227, 255, 0.03)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.strokeStyle = accent; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  const text = (value: string, x: number, y: number, font: string, colour: string, maxWidth: number, align: CanvasTextAlign = 'left'): number => {
    g.font = font; g.fillStyle = colour; g.textAlign = align; g.textBaseline = 'alphabetic';
    const width = g.measureText(value).width, k = Math.min(1, maxWidth / Math.max(1, width));
    g.save(); g.translate(x, y); g.scale(k, 1); g.fillText(value, 0, 0); g.restore();
    return width * k;
  };
  // At the soft wall use the same live facts in large type; the full diagnostics stay on the distant screen.
  if (near) {
    const left = 54, width = w - 108;
    text(screen.chip, left, 96, `700 48px ${MONO}`, accent, width);
    text(screen.title.toUpperCase(), left, 194, `700 82px ${DISPLAY}`, TEXT, width);
    const headline = screen.headline === null ? screen.tracks[1].fact : screen.headline.slice(screen.headline.indexOf(' · ') + 3);
    for (const [i, line] of wrap(headline, 30, 2).entries()) text(line, left, 284 + i * 62, `600 52px ${DISPLAY}`, accent, width);
    text(screen.sub ?? screen.line, left, 420, `600 38px ${MONO}`, DIM, width);
    g.fillStyle = LINE; g.fillRect(left, 466, width, 10);
    g.fillStyle = accent; g.fillRect(left, 466, width * screen.bar, 10);
    text(screen.build, left, 544, `500 28px ${MONO}`, CYAN_DIM, width);
    return;
  }
  // head: the wordmark (Project, then Wildshard in cyan) and the build chip
  const project = text('PROJECT ', 34, 62, `700 40px ${DISPLAY}`, '#fff', 200);
  text(GAME_STRINGS.mainMenu.logo, 34 + project, 62, `700 40px ${DISPLAY}`, CYAN, 320);
  g.strokeStyle = LINE; g.lineWidth = 2; g.strokeRect(w - 250, 30, 216, 40);
  text(screen.build, w - 142, 58, `500 20px ${MONO}`, CYAN_DIM, 200, 'center');
  // the glass panel and its corner accent
  const px = 34, py = 88, pw = w - 68, ph = h - 88 - 26;
  g.fillStyle = 'rgba(6, 10, 18, 0.62)'; g.fillRect(px, py, pw, ph);
  g.strokeStyle = LINE; g.lineWidth = 2; g.strokeRect(px, py, pw, ph);
  g.strokeStyle = accent; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py + 36); g.lineTo(px, py); g.lineTo(px + 36, py); g.stroke();
  // title: kicker, the shard, the state chip, the clock
  const kx = px + 24, ty = py + 48;
  const kw = text(screen.kicker.toUpperCase(), kx, ty, `700 22px ${DISPLAY}`, CYAN_DIM, 260);
  const nw = text(screen.title.toUpperCase(), kx + kw + 10, ty, `700 34px ${DISPLAY}`, CYAN, 430);
  const cx = kx + kw + nw + 24; g.font = `700 18px ${MONO}`; const cw = Math.min(160, g.measureText(screen.chip).width + 22);
  g.strokeStyle = accent; g.lineWidth = 2; g.strokeRect(cx, ty - 24, cw, 30); text(screen.chip, cx + cw / 2, ty - 3, `700 18px ${MONO}`, accent, cw - 10, 'center');
  text(screen.clock, px + pw - 24, ty, `400 24px ${MONO}`, CYAN, 120, 'right');
  // left column: meta, the headline (reason / wait), the two tracks
  const lx = kx, lw = 486;
  let y = ty + 40;
  for (const [label, value] of screen.meta) {
    text(label.toUpperCase(), lx, y, `500 15px ${MONO}`, DIM, 110);
    text(value, lx + lw, y, `500 18px ${MONO}`, TEXT, lw - 120, 'right');
    g.fillStyle = 'rgba(143, 227, 255, 0.12)'; g.fillRect(lx, y + 9, lw, 1); y += 32;
  }
  if (screen.headline !== null) {
    y += 6; g.fillStyle = screen.status === 'refused' ? 'rgba(255, 181, 71, 0.12)' : 'rgba(143, 227, 255, 0.1)'; g.fillRect(lx, y, lw, 84);
    g.fillStyle = accent; g.fillRect(lx, y, 5, 84);
    text(screen.headline, lx + 18, y + 38, `700 30px ${DISPLAY}`, screen.status === 'refused' ? AMBER : TEXT, lw - 30);
    if (screen.sub !== null) text(screen.sub, lx + 18, y + 70, `600 21px ${DISPLAY}`, DIM, lw - 30);
    y += 100;
  } else y += 14;
  for (const track of screen.tracks) {
    text(track.name.toUpperCase(), lx, y + 22, `500 16px ${MONO}`, CYAN_DIM, 110);
    text(track.fact, lx + 112, y + 22, `400 16px ${MONO}`, DIM, lw - 112 - 76);
    text(String(track.pct), lx + lw - 18, y + 26, `700 32px ${DISPLAY}`, '#fff', 64, 'right');
    text('%', lx + lw, y + 26, `500 16px ${DISPLAY}`, DIM, 18, 'right');
    g.fillStyle = 'rgba(143, 227, 255, 0.14)'; g.fillRect(lx, y + 36, lw, 6);
    g.fillStyle = accent; g.fillRect(lx, y + 36, Math.round(lw * track.pct / 100), 6);
    y += 60;
  }
  // right column: the step log, then the diagnostics
  const rx = lx + lw + 34, rw = px + pw - 24 - rx;
  let ry = ty + 40;
  text(S.steps.toUpperCase(), rx, ry, `500 15px ${MONO}`, DIM, 120); ry += 30;
  for (const row of screen.rows) {
    const colour = row.state === 'fail' ? AMBER : row.state === 'on' ? '#fff' : row.state === 'ok' ? CYAN_DIM : 'rgba(196, 220, 232, 0.42)';
    const mark = row.state === 'ok' ? '✓' : row.state === 'fail' ? '✗' : row.state === 'on' ? '…' : '·';
    text(`▸ ${row.label}`, rx, ry, `500 17px ${MONO}`, colour, 150);
    text(row.detail, rx + 156, ry, `400 16px ${MONO}`, row.state === 'todo' ? 'rgba(196, 220, 232, 0.5)' : row.state === 'fail' ? AMBER : TEXT, rw - 156 - 26);
    text(mark, rx + rw, ry, `700 18px ${MONO}`, colour, 24, 'right');
    ry += 29;
  }
  ry += 6; g.fillStyle = 'rgba(143, 227, 255, 0.22)'; g.fillRect(rx, ry, rw, 1); ry += 24;
  for (const line of screen.diagnostics.slice(0, 5)) { text(line, rx, ry, `400 15px ${MONO}`, CYAN_DIM, rw); ry += 22; }
  // the player's one bar and line along the panel's foot
  const by = py + ph - 44;
  g.fillStyle = 'rgba(143, 227, 255, 0.14)'; g.fillRect(lx, by, pw - 48, 8);
  g.fillStyle = accent; g.fillRect(lx, by, Math.round((pw - 48) * screen.bar), 8);
  text(screen.line, lx, by + 32, `600 19px ${MONO}`, screen.status === 'refused' ? AMBER : DIM, pw - 48);
}

/** A neighbour the screens may stand on: its centre in the home frame, its card art. */
export interface CellScreenCell { readonly instance: string; readonly x: number; readonly z: number; readonly art: string | null }
export interface CellScreenPorts {
  /** every unenterable neighbour's live state (a cell that can be entered is absent), read a few times a second */
  readonly read: () => ReadonlyMap<string, CellScreenInput>;
  /** the traveller's feet in the home frame */
  readonly feet: () => { readonly x: number; readonly z: number };
}
/** The readout: which cells wear a screen now and how many redraws there have been. */
export interface CellScreensState { readonly shown: readonly { readonly instance: string; readonly status: CellScreenStatus }[]; readonly draws: number }

interface Slot {
  readonly mesh: Mesh; readonly material: MeshBasicMaterial; readonly canvas: HTMLCanvasElement; readonly context: CanvasRenderingContext2D | null; readonly texture: CanvasTexture;
  readonly ordinal: number; readonly dispose: () => void; instance: string | null; key: string; along: number; sliding: boolean; status: CellScreenStatus | null; since: number;
}
const RANGE = 320, REFRESH = 6, DEAD_ZONE = 6;
// Screens stay inside the closed cell, beyond a 20 m glide, leaving the entire road and soft wall clear.
const SETBACK = 24, NEAR = 55, NEAR_SCALE = 2;

/** The byte plan of `slots` screens: each a canvas (JS) and its texture with mips (GPU). */
export function cellScreenBytes(slots: number): { jsBytes: number; gpuBytes: number } {
  const bytes = SCREEN_PX.w * SCREEN_PX.h * 4;
  return { jsBytes: slots * bytes, gpuBytes: slots * Math.ceil(bytes * 4 / 3) };
}

/** Stand the screens on the unenterable neighbours; `step` runs each fixed step. Disposed with the scope. */
export function installCellScreens(input: {
  readonly cells: readonly CellScreenCell[]; readonly wall: number; readonly ports: CellScreenPorts; readonly scene: Object3D;
  readonly admission: PlatformRenderAdmission; readonly time: () => number; readonly build: string; readonly tier: string; readonly slots?: number;
}): { step: () => void; state: () => CellScreensState } {
  const { cells, ports, wall, time } = input, count = input.slots ?? 3, byInstance = new Map(cells.map((cell) => [cell.instance, cell]));
  // Four plane vertices: position, normal and UV, plus six uint16 indices, retained on both CPU and GPU.
  return input.admission.allocate({ id: 'cell-screens', jsBytes: 140, gpuBytes: 140 }, (owner) => {
    const group = new Group(); group.name = 'grid-cell-screens';
    const geometry = new PlaneGeometry(SCREEN_M.w, SCREEN_M.h);
    const slots: Slot[] = [];
    const art = new Map<string, { image: HTMLImageElement; ready: boolean }>();
    const slot = (): Slot | undefined => {
      let ordinal = 0;
      while (slots.some(candidate => candidate.ordinal === ordinal)) ordinal++;
      if (ordinal >= count) return undefined;
      return input.admission.allocate({ id: `cell-screens.slot-${String(ordinal)}`, ...cellScreenBytes(1) }, (slotOwner) => {
        // Slot lifetime is shorter than the session: leave the old range before releasing its claim.
        const forget = owner.capture('disposers', () => { slotOwner.dispose(); });
        slotOwner.onDispose(forget);
        const canvas = document.createElement('canvas'); canvas.width = SCREEN_PX.w; canvas.height = SCREEN_PX.h;
        const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
        const material = new MeshBasicMaterial({ map: texture, toneMapped: false, fog: false });
        const mesh = new Mesh(geometry, material); mesh.name = 'grid-cell-screen'; mesh.visible = false; mesh.matrixAutoUpdate = false;
        slotOwner.onDispose(() => { mesh.removeFromParent(); texture.dispose(); material.dispose(); canvas.width = 0; canvas.height = 0; });
        group.add(mesh);
        return { ordinal, dispose: () => { slotOwner.dispose(); }, mesh, material, canvas, context: canvas.getContext('2d'), texture,
          instance: null, key: '', along: 0, sliding: false, status: null, since: 0 };
      });
    };
    input.scene.add(group);
    let ticks = 0, draws = 0, snapshot: ReadonlyMap<string, CellScreenInput> = new Map();
    const image = (cell: CellScreenCell | undefined): HTMLImageElement | null => {
      if (cell?.art === null || cell === undefined || typeof Image === 'undefined') return null;
      let entry = art.get(cell.art);
      if (entry === undefined) {
        const loaded = new Image(), made = { image: loaded, ready: false }; entry = made;
        loaded.onload = () => { made.ready = true; }; loaded.src = cell.art; art.set(cell.art, made);
      }
      return entry.ready ? entry.image : null;
    };
    const place = (s: Slot, cell: CellScreenCell, feet: { readonly x: number; readonly z: number }): void => {
      const dx = feet.x - cell.x, dz = feet.z - cell.z, onX = Math.abs(dx) >= Math.abs(dz);
      const side = Math.sign(onX ? dx : dz) || 1, limit = wall - SCREEN_M.w * NEAR_SCALE / 2 - 2;
      const target = Math.max(-limit, Math.min(limit, onX ? dz : dx));
      // slides along its wall toward the traveller once they are DEAD_ZONE m off it, until it is in front of them again
      const off = Math.abs(target - s.along);
      if (off > DEAD_ZONE) s.sliding = true; else if (off < 0.3) s.sliding = false;
      if (s.sliding) s.along += (target - s.along) * 0.08;
      const face = side * (wall - SETBACK);
      const near = Math.hypot(dx - (onX ? face : s.along), dz - (onX ? s.along : face)) < NEAR;
      // The authoritative wall stops the player tens of metres away: enlarge the same plane for readable near text.
      const scale = near ? NEAR_SCALE : 1, m = s.mesh, y = SCREEN_M.bottom + SCREEN_M.h * scale / 2;
      m.scale.setScalar(scale);
      if (onX) { m.position.set(cell.x + side * (wall - SETBACK), y, cell.z + s.along); m.rotation.set(0, side * Math.PI / 2, 0); }
      else { m.position.set(cell.x + s.along, y, cell.z + side * (wall - SETBACK)); m.rotation.set(0, side > 0 ? 0 : Math.PI, 0); }
      m.updateMatrix();
    };
    const step = (): void => {
      if (ticks++ % REFRESH === 0) snapshot = ports.read();
      const feet = ports.feet(), now = time();
      const distance = (cell: CellScreenCell): number => Math.hypot(Math.max(0, Math.abs(feet.x - cell.x) - wall), Math.max(0, Math.abs(feet.z - cell.z) - wall));
      const wanted = [...snapshot.keys()].flatMap((id) => { const cell = byInstance.get(id); return cell === undefined || distance(cell) > RANGE ? [] : [cell]; })
        .sort((a, b) => distance(a) - distance(b) || a.instance.localeCompare(b.instance)).slice(0, count);
      const keep = new Set(wanted.map((cell) => cell.instance));
      for (let i = slots.length - 1; i >= 0; i--) {
        const s = slots[i];
        if (s !== undefined && s.instance !== null && !keep.has(s.instance)) { s.dispose(); slots.splice(i, 1); }
      }
      for (const cell of wanted) {
        let s = slots.find((candidate) => candidate.instance === cell.instance);
        if (s === undefined) {
          try { s = slots.length < count ? slot() : undefined; }
          catch (error) {
            // An optional extra screen must not disable movement or the authoritative wall if its canvas cannot fit.
            if (!(error instanceof PlatformRenderAdmissionError)) throw error;
            continue;
          }
          if (s === undefined) continue;
          if (!slots.includes(s)) slots.push(s);
          s.instance = cell.instance; s.key = ''; s.status = null; s.sliding = false;
          const dx = feet.x - cell.x, dz = feet.z - cell.z; s.along = Math.abs(dx) >= Math.abs(dz) ? dz : dx;
        }
        const state = snapshot.get(cell.instance); if (state === undefined) continue;
        if (state.status !== s.status) { s.status = state.status; s.since = now; }
        const frame = { build: input.build, tier: input.tier, elapsedS: state.status === 'loading' ? Math.max(0, Math.floor(now - s.since)) : null };
        const picture = image(cell);
        place(s, cell, feet);
        const near = Math.hypot(feet.x - s.mesh.position.x, feet.z - s.mesh.position.z) < NEAR;
        const screen = cellScreenContent(state, frame), key = `${near ? 1 : 0}${picture === null ? 0 : 1}${JSON.stringify(screen)}`;
        if (key !== s.key && s.context !== null) { s.key = key; drawCellScreen(s.context, screen, picture, near); s.texture.needsUpdate = true; draws++; }
        s.mesh.visible = true;
      }
      const liveArt = new Set(slots.flatMap(s => {
        const url = s.instance === null ? null : byInstance.get(s.instance)?.art;
        return url === null || url === undefined ? [] : [url];
      }));
      for (const [url, { image: loaded }] of art) if (!liveArt.has(url)) { loaded.onload = null; loaded.src = ''; art.delete(url); }
    };
    owner.onDispose(() => {
      group.removeFromParent(); geometry.dispose();
      for (const s of slots) s.dispose();
      slots.length = 0;
      for (const { image: loaded } of art.values()) { loaded.onload = null; loaded.src = ''; }
      art.clear();
    });
    return { step, state: () => ({ shown: slots.flatMap((s) => (s.instance === null || s.status === null ? [] : [{ instance: s.instance, status: s.status }])), draws }) };
  });
}
