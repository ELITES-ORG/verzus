import './fonts.css';
import './styles.css';
import { label, matchups, type Sport, YOU } from './rivals';

// The effects' accent: the logo's bright green (marks and sparks, never text).
const ACCENT = '#22c55e';
const LINKS = {
  player: import.meta.env.VITE_PLAYER_URL ?? 'http://localhost:8081',
  venue: import.meta.env.VITE_VENUE_URL ?? 'http://localhost:5173',
};

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

/** Sakuga's effects palette is plain JS, not CSS: swap its pink for the verzus green. */
function theme(fx: SakugaFX) {
  fx.P.accent = ACCENT;
}

/** Runs an effect only when the library is present. It already skips effects under reduced motion. */
function fx(run: (fx: SakugaFX) => void) {
  if (window.SakugaFX) run(window.SakugaFX);
}

// ---------------------------------------------------------------- navigation

for (const el of $$('[data-go]')) {
  el.addEventListener('click', () => {
    const target = el.dataset.go === 'venue' ? LINKS.venue : LINKS.player;
    // Let the button's release land before leaving the page.
    setTimeout(() => window.location.assign(target), 380);
  });
}

// ----------------------------------------------------------------- register

/** Register asks who you are, then opens that app's sign-up. */
function register() {
  const dialog = $<HTMLDialogElement>('[data-register-dialog]');
  if (!dialog) return;
  for (const a of $$<HTMLAnchorElement>('[data-register-to]')) {
    a.href = `${a.dataset.registerTo === 'venue' ? LINKS.venue : LINKS.player}/register`;
  }
  $('[data-register]')?.addEventListener('click', () => dialog.showModal());
  // A click on the backdrop lands on the dialog itself: close it, like Esc.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

// ------------------------------------------------------------------- splash

function splash() {
  // Aim at the last word: the green phrase wraps, so its box centre falls between lines.
  const hit = $('[data-hit]');
  // The headline's smear lands ~0.55 s in (see the "hit" keyframes).
  setTimeout(() => {
    fx((f) => {
      if (!hit) return;
      // Just past the full stop, where the sentence lands.
      const p = f.at(hit, 1, 0.55);
      f.burst(p.x + 4, p.y, { r: 62, spikes: 15 });
      f.shards(p.x + 4, p.y, { n: 9, speed: 260 });
      // Above "on it", inside the panel rather than on its border.
      f.sfx('don', p.x - p.w * 1.6, p.y - p.h * 1.2, { size: 70, rot: -0.12 });
    });
  }, 560);

  // A rival takes the open spot in the lobby.
  setTimeout(() => {
    const slot = $('[data-rival-slot]');
    const face = $('[data-rival-face]');
    const tier = $('[data-rival-tier]');
    const split = $('[data-split]');
    if (!slot || !face || !tier || !split) return;
    slot.classList.remove('slot--open');
    slot.classList.add('slot--filled');
    face.textContent = 'MD';
    tier.textContent = 'Migs, Silver I';
    split.textContent = '₱150 each. Nobody owes anybody.';
    fx((f) => {
      const p = f.at(face);
      f.burst(p.x, p.y, { r: 46, spikes: 12 });
      f.puff(p.x, p.y + p.h * 0.45, { n: 4, size: 11 });
      f.sfx('pon', p.x + 6, p.y - p.h * 0.95, { size: 52 });
    });
  }, 1900);
}

// --------------------------------------------------------------- storyboard

function storyboard() {
  const mode = $<SakugaValueElement>('[data-mode]');
  const note = $('[data-mode-note]');
  mode?.addEventListener('change', () => {
    if (!note) return;
    note.textContent =
      mode.value === 'casual'
        ? "Casual lets anyone join. Nobody's rank moves, and you can still see everyone's badge before you say yes."
        : 'Ranked counts toward your tier, so we look for someone close to your level first.';
  });

  // Spots fill when the cut scrolls into view: you, then the joiner.
  const fill = $<SakugaProgressElement>('[data-fill]');
  if (fill) {
    once(fill, () => {
      wake(fill);
      fill.set(0.5);
      setTimeout(() => {
        wake(fill);
        fill.set(1);
      }, 1300);
    });
  }

  const call = $<SakugaCheckboxElement>('[data-call]');
  const tier = $('[data-call-tier]');
  call?.addEventListener('change', () => {
    if (!tier) return;
    if (call.checked) {
      tier.innerHTML = '<span class="chip__was">Silver II</span><span class="chip chip--up">Silver I</span>';
      fx((f) => {
        const chip = tier.querySelector('.chip');
        if (!chip) return;
        const p = f.at(chip);
        f.burst(p.x, p.y, { r: 50, spikes: 13 });
        f.kira(p.x + p.w / 2, p.y - p.h / 2);
      });
    } else {
      tier.innerHTML = '<span class="chip">Silver II</span>';
    }
  });

  // Each picture panel throws a small puff the first time it lands on screen.
  for (const pic of $$('.row__pic')) {
    once(pic, () =>
      fx((f) => {
        const p = f.at(pic, 0.04, 0.96);
        f.puff(p.x, p.y, { n: 3, size: 10, vx: -10, vy: -10 });
      }),
    );
  }
}

// -------------------------------------------------------------------- arena

function arena() {
  const tabs = $<SakugaValueElement>('[data-sport]');
  const range = $<SakugaSliderElement>('[data-range]');
  const next = $('[data-next]');
  const ask = $('[data-ask]');
  const toast = $<SakugaToastElement>('[data-toast]');
  const vs = $('.hud__vs');

  let sport: Sport = 'badminton';
  let km = 6;
  let index = 0;

  const set = (sel: string, text: string) => {
    const el = $(sel);
    if (el) el.textContent = text;
  };
  const width = (sel: string, pct: number) => {
    const el = $(sel);
    if (el) el.style.width = `${pct}%`;
  };

  function render(hit: boolean) {
    const list = matchups(sport, km);
    set('[data-you-tier]', label(YOU[sport]));

    const m = list[index % Math.max(1, list.length)];
    if (!m) {
      set('[data-rival-name]', 'Nobody');
      set('[data-rival-tier-hud]', 'No fair game in range');
      set('[data-where]', `Nothing within 60/40 inside ${km} km. Go a bit further.`);
      set('[data-odds-you]', '–');
      set('[data-odds-rival]', '–');
      width('[data-bar-you]', 0);
      width('[data-bar-rival]', 0);
      return;
    }

    const you = Math.round(m.youWin * 100);
    set('[data-rival-name]', m.rival.name);
    set('[data-rival-tier-hud]', m.rivalLabel);
    set(
      '[data-where]',
      `${m.rival.venue} · ${m.rival.when} · ${m.rival.km.toFixed(1)} km · ${(index % list.length) + 1} of ${list.length}`,
    );
    set('[data-odds-you]', String(you));
    set('[data-odds-rival]', String(100 - you));
    width('[data-bar-you]', you);
    width('[data-bar-rival]', 100 - you);

    if (hit && vs) {
      fx((f) => {
        const p = f.at(vs);
        f.burst(p.x, p.y, { r: 64, spikes: 14 });
        f.shards(p.x, p.y, { n: 7, speed: 220 });
      });
    }
  }

  tabs?.addEventListener('change', () => {
    sport = tabs.value as Sport;
    index = 0;
    render(true);
  });
  range?.addEventListener('input', () => {
    km = range.valueAsNumber;
    index = 0;
    render(false);
  });
  next?.addEventListener('click', () => {
    index++;
    render(true);
  });
  ask?.addEventListener('click', () => {
    const name = $('[data-rival-name]')?.textContent ?? '';
    if (!toast || name === 'Nobody') return;
    wake(toast);
    toast.show(`Request sent to ${name}`);
  });

  render(false);
}

// --------------------------------------------------------------- idle sleep

/**
 * Lets the effects loop rest. Every Sakuga control keeps a per-frame callback on the library's one
 * shared loop for as long as it is on the page, so the loop ran every frame forever, restyling each
 * control even when nothing moved: on a phone, that is the scroll lag. The library's rule is that
 * nothing animates at rest, so a control sleeps while it is off screen or untouched for a few
 * seconds, and wakes before anything can move it. Sleeping and waking use the control's own
 * lifecycle callbacks, which only remove and re-add that per-frame callback (the control is not
 * rebuilt); the vendored files stay untouched.
 */
type Sleeper = HTMLElement & { connectedCallback?(): void; disconnectedCallback?(): void };
const SETTLE_MS = 4000; // long enough for any press, hover or fill to finish settling
const naps = new Map<Sleeper, { seen: boolean; recent: boolean; awake: boolean; timer?: number }>();

function nap(el: Sleeper) {
  const s = naps.get(el);
  if (!s) return;
  const want = s.seen && s.recent;
  if (want === s.awake) return;
  s.awake = want;
  if (want) el.connectedCallback?.();
  else el.disconnectedCallback?.();
}

/** Keeps `el` animating for a few seconds: call before changing it from code. */
function wake(el: Element | null) {
  const s = el && naps.get(el as Sleeper);
  if (!s) return;
  s.recent = true;
  clearTimeout(s.timer);
  s.timer = window.setTimeout(() => {
    s.recent = false;
    nap(el as Sleeper);
  }, SETTLE_MS);
  nap(el as Sleeper);
}

function sleepWhenIdle() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = naps.get(e.target as Sleeper);
        if (!s) continue;
        s.seen = e.isIntersecting;
        if (s.seen) wake(e.target);
        else nap(e.target as Sleeper);
      }
    },
    // Wake a little before a control scrolls in, so it's ready when it arrives.
    { rootMargin: '120px 0px' },
  );
  for (const el of $$<Sleeper>(
    'sakuga-button, sakuga-radio, sakuga-progress, sakuga-checkbox, sakuga-tabs, sakuga-slider, sakuga-toast',
  )) {
    naps.set(el, { seen: true, recent: true, awake: true });
    // Anything a person does to a control wakes it first and keeps it awake while it goes on
    // (hover, press, a long slider drag, focus, keys).
    for (const type of ['pointerenter', 'pointerdown', 'pointermove', 'focusin', 'keydown', 'input'])
      el.addEventListener(type, () => wake(el), { passive: true });
    io.observe(el);
    wake(el);
  }
}

// ------------------------------------------------------------------- helpers

/** Calls `fn` the first time `el` is mostly on screen. */
function once(el: Element, fn: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { threshold: 0.6 },
  );
  io.observe(el);
}

// -------------------------------------------------------------------- start

if (window.SakugaFX) theme(window.SakugaFX);
register();
splash();
storyboard();
arena();
// After the controls built from <option>s have finished connecting (they wait for the parser).
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sleepWhenIdle, { once: true });
else sleepWhenIdle();
