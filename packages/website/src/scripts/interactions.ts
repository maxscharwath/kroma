// Page-level interactivity: copy buttons, FAQ accordion, entry reveals, and the
// hero screenshot's scroll-driven opening mask. Motion is gated behind
// prefers-reduced-motion.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function copyButtons(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    b.addEventListener('click', async () => {
      const t =
        document.getElementById(b.dataset.copy ?? '')?.innerText.replace(/^\$\s*/, '') ?? '';
      try {
        await navigator.clipboard.writeText(t);
        b.textContent = 'copied';
      } catch {
        b.textContent = 'select it';
      }
      setTimeout(() => {
        b.textContent = 'copy';
      }, 1500);
    });
  }
}

function accordion(): void {
  for (const qa of document.querySelectorAll<HTMLElement>('.qa')) {
    const btn = qa.querySelector('button');
    btn?.addEventListener('click', () => {
      const open = qa.hasAttribute('data-open');
      for (const other of document.querySelectorAll('.qa[data-open]')) {
        other.removeAttribute('data-open');
        other.querySelector('button')?.setAttribute('aria-expanded', 'false');
      }
      if (!open) {
        qa.setAttribute('data-open', '');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }
}

function reveals(): void {
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es)
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
    },
    { threshold: 0.14, rootMargin: '0px 0px -4% 0px' },
  );
  for (const el of document.querySelectorAll('.rv')) io.observe(el);
}

/** One rAF-throttled scroll loop drives the hero screenshot's opening mask.
 *  It is a one-shot entry animation: once fully open, the listener detaches. */
function scrollMask(): void {
  if (reduced) return;
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  if (!stage) return;
  let ticking = false;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const frame = () => {
    ticking = false;
    const vh = innerHeight;
    const r = stage.getBoundingClientRect();
    if (r.top > vh) return; // still below the fold; nothing to reveal yet
    const p = clamp01((vh - r.top) / (vh * 0.85));
    const e = 1 - (1 - p) ** 3;
    const x = (9 * (1 - e)).toFixed(2);
    const t = (4 * (1 - e)).toFixed(2);
    const b = (10 * (1 - e)).toFixed(2);
    stage.style.clipPath = `inset(${t}% ${x}% ${b}% ${x}% round ${22 - 6 * e}px)`;
    stage.style.transform = `scale(${0.965 + 0.035 * e})`;
    if (e > 0.999) removeEventListener('scroll', onScroll); // fully open, done
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  frame();
}

copyButtons();
accordion();
reveals();
scrollMask();
