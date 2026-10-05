const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;

// ----- header turns solid once the hero scrolls away -----
const header = document.querySelector('.site-header');
const topSentinel = document.createElement('div');
topSentinel.style.cssText = 'position:absolute;top:0;height:40px;width:1px;pointer-events:none';
document.body.prepend(topSentinel);
new IntersectionObserver(([e]) => header.classList.toggle('is-solid', !e.isIntersecting)).observe(topSentinel);

// ----- the 3D room: one scene, driven by whichever block is in view -----
const stageEl = document.getElementById('stage');
const picker = document.getElementById('picker');
const blocks = [...document.querySelectorAll('.scrolly [data-shot]')];
let scene = null;
let shot = 'hero';
let activeEl = null;

// ----- loading screen: a 3 x 3 floor gets tiled as the room's files arrive -----
const loader = document.getElementById('loader');
const loaderPct = loader.querySelector('.loader-pct');
const loaderTiles = [...loader.querySelectorAll('.loader-grid span')];
const tileOrder = [0, 1, 3, 2, 4, 6, 5, 7, 8];   // laid from one corner outwards
let shownP = 0, targetP = 0.04, loaderDone = false;
const setTarget = (p) => { targetP = Math.max(targetP, Math.min(1, p)); };
const creep = setInterval(() => setTarget(targetP + (0.14 - targetP) * 0.08), 120);
(function fillLoop() {
  if (loaderDone && shownP >= 0.999) return;
  shownP += (targetP - shownP) * (reducedMotion ? 1 : 0.09);
  if (targetP - shownP < 0.002) shownP = targetP;
  const laid = Math.floor(shownP * 9 + 0.001);
  tileOrder.forEach((idx, i) => loaderTiles[idx].classList.toggle('on', i < laid));
  loaderPct.textContent = `${Math.round(shownP * 100)}%`;
  requestAnimationFrame(fillLoop);
})();
function finishLoading() {
  if (loaderDone) return;
  loaderDone = true;
  clearInterval(creep);
  setTarget(1);
  setTimeout(() => {
    loader.classList.add('is-done');
    document.documentElement.classList.remove('is-loading');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    setTimeout(() => loader.remove(), 1600);
  }, reducedMotion ? 0 : 650);
}
setTimeout(finishLoading, 12000);

import('./scene.js?v=7').then(({ initRoomScene, FINISHES, PAINTS }) => {
  try {
    scene = initRoomScene(stageEl, {
      reducedMotion,
      lowPower,
      onProgress: (p) => setTarget(0.14 + p * 0.82),
      onReady: () => requestAnimationFrame(() => requestAnimationFrame(finishLoading)),
      onCut: (on) => stageEl.classList.toggle('is-cut', on),
    });
    scene.setShot(shot);
    setupPicker(FINISHES, PAINTS);
    if (location.hash === '#debug') window.__room = scene;
  } catch (err) {
    console.warn('3D room unavailable, showing the photo instead', err);
    picker.remove();
    finishLoading();
  }
}).catch((err) => { console.warn('3D room failed to load', err); picker.remove(); finishLoading(); });

const activate = (el) => {
  if (el === activeEl) return;
  activeEl = el;
  blocks.forEach((b) => b.classList.toggle('is-active', b === el));
  if (el.dataset.shot === shot) return;
  shot = el.dataset.shot;
  scene?.setShot(shot);
  picker.hidden = !(shot === 'hero' || shot === 'finish');
};
// the block crossing the middle band of the viewport drives the camera and the job
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) activate(e.target);
}, { rootMargin: '-45% 0px -45% 0px' });
blocks.forEach((b) => io.observe(b));

// ----- finish picker: swaps the floor tiles and wall colour in the room -----
function setupPicker(FINISHES, PAINTS) {
  const finishName = document.getElementById('finish-name');
  const paintName = document.getElementById('paint-name');
  const groups = [
    { buttons: [...picker.querySelectorAll('[data-finish]')], key: 'finish', apply: (v) => { scene.setFinish(v); finishName.textContent = FINISHES[v].label; } },
    { buttons: [...picker.querySelectorAll('[data-paint]')], key: 'paint', apply: (v) => { scene.setPaint(v); paintName.textContent = PAINTS[v].label.toLowerCase(); } },
  ];
  for (const g of groups) {
    const select = (btn, focus) => {
      g.buttons.forEach((b) => { b.setAttribute('aria-checked', String(b === btn)); b.tabIndex = b === btn ? 0 : -1; });
      g.apply(btn.dataset[g.key]);
      if (focus) btn.focus();
    };
    g.buttons.forEach((btn, i) => {
      btn.tabIndex = btn.getAttribute('aria-checked') === 'true' ? 0 : -1;
      btn.addEventListener('click', () => select(btn));
      btn.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        select(g.buttons[(i + d + g.buttons.length) % g.buttons.length], true);
      });
    });
  }
}

// ----- photos: tap one to see it large, with previous / next -----
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('.lightbox-img');
const lbCap = lightbox.querySelector('.lightbox-caption');
const shots = [...document.querySelectorAll('.work-open')];
let shotIndex = 0;
const caption = (btn) => (btn.closest('figure')?.querySelector('figcaption') || btn.parentElement.querySelector('p'))?.textContent || '';
const showShot = (i) => {
  shotIndex = (i + shots.length) % shots.length;
  const btn = shots[shotIndex];
  lbImg.src = btn.dataset.full;
  lbImg.alt = btn.querySelector('img').alt;
  lbCap.textContent = caption(btn);
};
shots.forEach((btn, i) => btn.addEventListener('click', () => { showShot(i); lightbox.showModal(); }));
lightbox.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => showShot(shotIndex + Number(b.dataset.step))));
lightbox.querySelector('.lb-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') showShot(shotIndex + 1);
  if (e.key === 'ArrowLeft') showShot(shotIndex - 1);
});
lightbox.addEventListener('close', () => shots[shotIndex].focus());

// ----- "Ask about ..." links preselect the service in the form -----
const form = document.getElementById('quote-form');
const serviceSel = document.getElementById('f-service');
document.querySelectorAll('[data-service]').forEach((a) => a.addEventListener('click', () => {
  serviceSel.value = a.dataset.service;
}));

// ----- quote form: builds a WhatsApp or email message, no server needed -----
const errorEl = document.getElementById('form-error');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const via = e.submitter?.value || 'whatsapp';
  const f = Object.fromEntries(new FormData(form));
  const missing = [];
  for (const [key, label] of [['name', 'your name'], ['message', 'a few words about the job']]) {
    const input = form.elements[key];
    const empty = !f[key].trim();
    input.setAttribute('aria-invalid', empty ? 'true' : 'false');
    if (empty) missing.push(label);
  }
  if (missing.length) {
    errorEl.textContent = `Add ${missing.join(' and ')} so Chris knows what the job is.`;
    errorEl.hidden = false;
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }
  errorEl.hidden = true;

  const lines = [`Hi Chris, this is ${f.name.trim()}.`, `I need help with: ${f.service}.`];
  if (f.area.trim()) lines.push(`Suburb: ${f.area.trim()}`);
  if (f.phone.trim()) lines.push(`My number: ${f.phone.trim()}`);
  lines.push('', f.message.trim());
  const text = lines.join('\n');

  if (via === 'email') {
    window.location.href = `mailto:yobechris@gmail.com?subject=${encodeURIComponent(`Quote request: ${f.service}`)}&body=${encodeURIComponent(text)}`;
  } else {
    window.open(`https://wa.me/27749733869?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
});

document.getElementById('year').textContent = new Date().getFullYear();
