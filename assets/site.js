// Rouje Technologies® v3 — small, dependency-free script.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // feature rows swap the real screenshot inside the phone (view transition where supported)
  document.querySelectorAll('.show').forEach((show) => {
    const shot = show.querySelector('.phone img');
    const btns = show.querySelectorAll('.feat');
    if (!shot) return;
    btns.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      const swap = () => {
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        shot.src = b.dataset.shot; shot.alt = b.dataset.alt;
      };
      if (document.startViewTransition && !reduce.matches) {
        shot.style.viewTransitionName = 'shot';
        document.startViewTransition(swap).finished.finally(() => { shot.style.viewTransitionName = ''; });
      } else swap();
      const r = shot.getBoundingClientRect();
      if (r.bottom < innerHeight * 0.3) shot.closest('.phone').scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' });
    }));
  });
  // contact: one field that opens a ready-to-send email
  const form = document.querySelector('.composer');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const box = form.querySelector('textarea'); const body = box.value.trim();
    if (!body) return box.focus();
    location.href = 'mailto:roujetechnologies@gmail.com?subject=' + encodeURIComponent('Contacto desde la web de Rouje Technologies') + '&body=' + encodeURIComponent(body);
  });
})();
