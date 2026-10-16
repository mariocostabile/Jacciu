import { stateAt, temperature } from './state.js';
import { detect } from './capability.js';

const $ = (sel) => document.querySelector(sel);
const root = document.documentElement;
const { useWebGL, pixelRatio } = detect(window);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function initNav() {
  const btn = $('.nav-toggle');
  const menu = $('#navbarResponsive');
  const set = (open) => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
}

function initLightbox() {
  const dlg = $('#lightbox');
  const img = dlg.querySelector('img');
  document.querySelectorAll('.portfolio-box').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      img.src = a.href;
      dlg.showModal();
    }));
  dlg.addEventListener('click', () => dlg.close());
}

function initReveal() {
  if (reduced || !window.gsap) return;
  window.gsap.utils.toArray('[data-reveal]').forEach((el) =>
    window.gsap.from(el, {
      opacity: 0, y: 40, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    }));
}

async function initScene() {
  const { createScene } = await import('./scene.js');
  const canvas = $('#ice');
  const scene = createScene(canvas, { pixelRatio });
  const temp = $('#temp');
  const glass = document.createElement('div');
  glass.className = 'frost-glass';
  glass.setAttribute('aria-hidden', 'true');
  document.body.append(glass);
  const ids = ['about', 'services', 'portfolio'];
  const sections = {};

  const measure = () => {
    ids.forEach((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      sections[id] = { top: r.top + scrollY, height: r.height };
    });
    sections.boxes = [...document.querySelectorAll('.service-box')].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height };
    });
  };
  const update = () => {
    const st = stateAt(scrollY, innerHeight, sections);
    // mobile: 0 = scheda ancora in basso, 1 = scheda arrivata in alto (l'oggetto 3D sotto di lei raggiunge la misura massima)
    const box = sections.boxes[Math.min(2, Math.round(st.service))];
    const spawnY = innerHeight * 0.4; // punto di spawn del fumo: l'oggetto cresce solo da quando il bordo alto della scheda lo raggiunge
    const grow = Math.min(1, Math.max(0, (spawnY - (box.top - scrollY)) / (spawnY - 72)));
    // exit: le foto del portfolio stanno salendo, l'oggetto rimpicciolisce prima di essere coperto
    const exit = Math.min(1, Math.max(0, (innerHeight * 1.05 - (sections.portfolio.top - scrollY)) / (innerHeight * 0.25)));
    scene.setState({ ...st, y: scrollY, grow, exit });
    root.style.setProperty('--freeze', st.freeze.toFixed(3));
    temp.textContent = temperature(st);
  };

  if (window.ScrollTrigger) {
    window.ScrollTrigger.create({
      trigger: document.body, start: 0, end: 'max',
      onUpdate: update, onRefresh: () => { measure(); update(); },
    });
  } else {
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', () => { measure(); update(); });
  }
  measure();
  update();

  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => scene.pointer(e.clientX / innerWidth, e.clientY / innerHeight), { passive: true });
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? scene.stop() : scene.start()));
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    scene.stop();
    root.classList.remove('webgl');
  });

  scene.start();
  root.classList.add('webgl');
}

if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
initNav();
initLightbox();
initReveal();
if (useWebGL) initScene().catch((err) => console.error('WebGL scene disabled:', err));
