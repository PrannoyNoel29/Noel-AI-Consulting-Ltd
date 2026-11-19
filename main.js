/* ==========================================================================
   NOEL AI CONSULTING LTD — main.js
   Vanilla JS, no dependencies. Every motion effect is skipped under
   prefers-reduced-motion (the CSS handles the visual states too).
   ========================================================================== */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------------ */
  /* Header: translucent-on-scroll + mobile MENU toggle                  */
  /* ------------------------------------------------------------------ */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const toggle = $('.menu-toggle', header);
    const nav = $('#site-nav', header);
    const setOpen = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    };
    if (toggle && nav) {
      toggle.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
      nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); toggle.focus(); }
      });
      window.matchMedia('(min-width: 1020px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Chisel reveal: split headline into letters, stagger 30ms            */
  /* ------------------------------------------------------------------ */
  $$('.chisel').forEach((el) => {
    if (!reduce) {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      let i = 0;
      const wordsHTML = (str) => str.trim().split(/\s+/).map((w) =>
        '<span class="word">' + Array.from(w).map((c) => `<span class="ch" style="--i:${i++}">${c}</span>`).join('') + '</span>'
      ).join(' ');
      // optional <span class="nb"> groups keep a phrase together on one line (desktop)
      const groups = $$('.nb', el);
      const inner = groups.length
        ? groups.map((g) => `<span class="nb">${wordsHTML(g.textContent)}</span>`).join(' ')
        : wordsHTML(text);
      el.innerHTML = `<span class="sr-only">${text}</span><span aria-hidden="true">${inner}</span>`;
    }
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    if (document.fonts && document.fonts.ready) {
      Promise.race([document.fonts.ready, sleep(1500)]).then(go);
    } else {
      go();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Scroll reveal: fade up once. Also drives column "rise" + terminal.  */
  /* ------------------------------------------------------------------ */
  const revealTargets = $$('.reveal, .columns');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach((t) => io.observe(t));
  } else {
    revealTargets.forEach((t) => t.classList.add('is-in'));
  }

  /* ------------------------------------------------------------------ */
  /* 1-bit dithering (Bayer 8x8) on <canvas>, with cursor shimmer        */
  /* ------------------------------------------------------------------ */
  // Bayer matrix, built recursively. Thresholds normalised to (0,1).
  const THR = (() => {
    let m = [[0]];
    for (let n = 1; n < 8; n *= 2) {
      const out = Array.from({ length: n * 2 }, () => new Array(n * 2));
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        out[y][x] = v; out[y][x + n] = v + 2; out[y + n][x] = v + 3; out[y + n][x + n] = v + 1;
      }
      m = out;
    }
    const t = new Float32Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) t[y * 8 + x] = (m[y][x] + 0.5) / 64;
    return t;
  })();

  const INK = 0xFF120E0E;   // #0E0E12 (little-endian ABGR)
  const IMPERIAL = 0xFFE01F1F; // #1F1FE0
  const PAPER_CUTOFF = 0.985; // anything lighter is background: never inked

  function initDither(box) {
    const img = $('img', box);
    const cols = parseInt(box.dataset.cols, 10) || 240;
    const interactive = box.dataset.interactive === 'true' && !reduce;
    const source = new Image();
    source.decoding = 'async';

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d', { willReadFrequently: true });

    let gw = 0, gh = 0, cell = 1, dpr = 1;
    let lum, base, energy, imageData, px32;
    let raf = 0, frame = 0;
    let active = new Int32Array(1024), activeN = 0; // indices of excited cells

    function paintBase() {
      for (let i = 0; i < base.length; i++) px32[i] = base[i] ? INK : 0;
      ctx.putImageData(imageData, 0, 0);
    }

    function fit() {
      const cssW = box.clientWidth;
      if (!cssW || !source.naturalWidth) return;
      dpr = window.devicePixelRatio || 1;
      const devW = cssW * dpr;
      cell = Math.max(2, Math.round(devW / cols)); // device px per dither cell
      gw = Math.floor(devW / cell);
      gh = Math.round(gw * source.naturalHeight / source.naturalWidth);
      canvas.width = off.width = gw;
      canvas.height = off.height = gh;
      canvas.style.width = (gw * cell / dpr) + 'px';
      canvas.style.height = (gh * cell / dpr) + 'px';

      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
      offCtx.clearRect(0, 0, gw, gh);
      offCtx.drawImage(source, 0, 0, gw, gh);
      const d = offCtx.getImageData(0, 0, gw, gh).data;

      lum = new Float32Array(gw * gh);
      base = new Uint8Array(gw * gh);
      energy = new Float32Array(gw * gh);
      activeN = 0;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const i = y * gw + x;
          const v = d[i * 4] / 255;
          lum[i] = v;
          base[i] = (v < PAPER_CUTOFF && v < THR[(y & 7) * 8 + (x & 7)]) ? 1 : 0;
        }
      }
      imageData = ctx.createImageData(gw, gh);
      px32 = new Uint32Array(imageData.data.buffer);
      paintBase();
    }

    /* shimmer: excite cells within a radius; they re-dither on a shifting
       Bayer phase and flash imperial where the pattern differs, then settle */
    function excite(cx, cy, r, amount) {
      if (!energy) return;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(gw - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(gh - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r) continue;
          const p = 1 - d / r;
          if (Math.random() < 0.3 + 0.7 * p) {
            const i = y * gw + x;
            if (energy[i] === 0) {
              if (activeN === active.length) { const g = new Int32Array(active.length * 2); g.set(active); active = g; }
              active[activeN++] = i;
            }
            energy[i] = Math.max(energy[i], amount * (0.55 + 0.45 * p));
          }
        }
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function tick() {
      frame++;
      const phase = (frame / 3) | 0;
      const sx = phase & 7, sy = (phase * 5 >> 1) & 7;
      let n = 0;
      for (let k = 0; k < activeN; k++) {
        const i = active[k];
        const e = energy[i] * 0.9;
        if (e < 0.04) {
          energy[i] = 0;
          px32[i] = base[i] ? INK : 0;
          continue;
        }
        const x = i % gw, y = (i / gw) | 0;
        const v = lum[i];
        const t = THR[((y + sy) & 7) * 8 + ((x + sx) & 7)] + (Math.random() - 0.5) * 0.55 * e;
        const ink = (v < PAPER_CUTOFF && v < t) ? 1 : 0;
        px32[i] = (ink !== base[i] && e > 0.5) ? IMPERIAL : (ink ? INK : 0);
        energy[i] = e;
        active[n++] = i;
      }
      activeN = n;
      ctx.putImageData(imageData, 0, 0);
      raf = activeN ? requestAnimationFrame(tick) : 0;
    }

    source.onload = () => {
      try {
        fit();
      } catch (err) {
        // e.g. opened via file:// (canvas is "tainted"): keep the static 1-bit PNG
        canvas.remove();
        return;
      }
      box.classList.add('is-live');
      if (typeof ResizeObserver !== 'undefined') {
        let t = 0, lastW = box.clientWidth;
        new ResizeObserver(() => {
          if (box.clientWidth === lastW) return;
          lastW = box.clientWidth;
          clearTimeout(t);
          t = setTimeout(fit, 120);
        }).observe(box);
      }
    };
    source.src = box.dataset.src;

    if (interactive) {
      const target = box.parentElement || box;
      const hit = (e) => {
        if (!energy) return;
        const r = canvas.getBoundingClientRect();
        const cs = cell / dpr; // css px per dither cell
        excite((e.clientX - r.left) / cs, (e.clientY - r.top) / cs, 60 / cs, 1);
      };
      target.addEventListener('pointermove', hit);
      target.addEventListener('pointerdown', hit);

      let last = 0;
      window.addEventListener('scroll', () => {
        const now = performance.now();
        if (now - last < 160 || !energy) return;
        last = now;
        const r = box.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const cs = cell / dpr;
        excite(gw * (0.25 + Math.random() * 0.5), gh * (0.2 + Math.random() * 0.6), 60 / cs, 0.85);
      }, { passive: true });
    }
  }
  $$('[data-dither]').forEach(initDither);

  /* ------------------------------------------------------------------ */
  /* Terminal "types out" when scrolled into view                        */
  /* ------------------------------------------------------------------ */
  $$('[data-type]').forEach((pre) => {
    if (reduce) return;
    const lines = pre.textContent.replace(/\s+$/, '').split('\n');
    pre.style.minHeight = pre.offsetHeight + 'px'; // lock height: no layout shift
    pre.textContent = '';

    const cursor = document.createElement('span');
    cursor.className = 'cursor';

    async function run() {
      for (const [n, line] of lines.entries()) {
        const row = document.createElement('span');
        pre.appendChild(row);
        if (line.trim().startsWith('>')) {
          const cmd = line.trim().slice(1).trim();
          row.innerHTML = '<span class="p">&gt;</span> ';
          const text = document.createTextNode('');
          row.appendChild(text);
          row.appendChild(cursor);
          for (const ch of cmd) { text.data += ch; await sleep(34 + Math.random() * 34); }
          await sleep(cmd ? 320 : 0);
        } else {
          row.textContent = line;
          row.appendChild(cursor);
          await sleep(170);
        }
        if (n < lines.length - 1) pre.appendChild(document.createTextNode('\n'));
      }
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
      }, { threshold: 0.5 });
      io.observe(pre);
    } else {
      run();
    }
  });

  /* ------------------------------------------------------------------ */
  /* FAQ accordion (buttons, aria-expanded, arrow-key navigation)        */
  /* ------------------------------------------------------------------ */
  $$('.faq').forEach((faq) => {
    const buttons = $$('.faq-q', faq);
    buttons.forEach((btn, idx) => {
      const item = btn.closest('.faq-item');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        item.classList.toggle('is-open', open);
      });
      btn.addEventListener('keydown', (e) => {
        let to = null;
        if (e.key === 'ArrowDown') to = buttons[(idx + 1) % buttons.length];
        else if (e.key === 'ArrowUp') to = buttons[(idx - 1 + buttons.length) % buttons.length];
        else if (e.key === 'Home') to = buttons[0];
        else if (e.key === 'End') to = buttons[buttons.length - 1];
        if (to) { e.preventDefault(); to.focus(); }
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* Contact form -> Formspree (JSON), inline mono success state         */
  /* ------------------------------------------------------------------ */
  const form = $('#contact-form');
  if (form) {
    const status = $('.form-status', form);
    const submit = $('button[type="submit"]', form);
    const mailEl = $('.contact-side .mail');
    const email = mailEl ? mailEl.textContent.trim() : 'hello@noelaiconsulting.co.uk';
    const setStatus = (html, cls) => { status.className = 'form-status ' + (cls || ''); status.innerHTML = html; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const action = form.getAttribute('action') || '';
      if (/[\[\]]/.test(action)) {
        setStatus(`&gt; form endpoint not configured yet. please email ${email} instead`, 'is-error');
        return;
      }
      submit.disabled = true;
      setStatus('&gt; sending…');
      try {
        const res = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        setStatus('&gt; message received. reply within 2 working days <span class="cursor"></span>', 'is-ok');
      } catch (err) {
        setStatus(`&gt; error: message not sent. please email ${email} instead`, 'is-error');
      } finally {
        submit.disabled = false;
      }
    });
  }
})();
