import './fonts.css';
import './styles.css';
import { label, matchups, type Sport, YOU } from './rivals';

const ACCENT = '#dd2b37';
const LINKS = {
  player: import.meta.env.VITE_PLAYER_URL ?? 'http://localhost:8081',
  venue: import.meta.env.VITE_VENUE_URL ?? 'http://localhost:5173',
};

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

/** Sakuga's effects palette is plain JS, not CSS: swap its pink for the verzus red. */
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

// ------------------------------------------------------------------- splash

function splash() {
  // Aim at the last word: the red phrase wraps, so its box centre falls between lines.
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
      fill.set(0.5);
      setTimeout(() => fill.set(1), 1300);
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
    toast.show(`Request sent to ${name}`);
  });

  render(false);
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
splash();
storyboard();
arena();
