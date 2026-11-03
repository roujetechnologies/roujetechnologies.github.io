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

(function(){var d=document.querySelector('.stage.deck');if(!d)return;var ps=[].slice.call(d.querySelectorAll('.phone')),n=ps.length,i=0,t;
function lay(){ps.forEach(function(p,k){var o=((k-i)%n+n)%n;if(o>n/2)o-=n;p.setAttribute('data-p',Math.max(-3,Math.min(3,o)));p.setAttribute('aria-hidden',o?'true':'false');});}
lay();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
function go(){clearInterval(t);t=setInterval(function(){if(!document.hidden){i=(i+1)%n;lay();}},3800);}go();
var last=0,raf=0,mx=0,my=0;function step(k){i=((i+k)%n+n)%n;lay();last=Date.now();}
d.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;var r=d.getBoundingClientRect();mx=(e.clientX-r.left)/r.width*2-1;my=(e.clientY-r.top)/r.height*2-1;
if(!raf)raf=requestAnimationFrame(function(){raf=0;d.style.setProperty('--mx',mx.toFixed(3));d.style.setProperty('--my',my.toFixed(3));});
if(Math.abs(mx)>.55&&Date.now()-last>1300)step(mx>0?1:-1);});
d.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'){clearInterval(t);d.classList.add('live');}});
d.addEventListener('pointerleave',function(){d.classList.remove('live');d.style.setProperty('--mx',0);d.style.setProperty('--my',0);go();});
ps.forEach(function(p,k){p.addEventListener('click',function(){var o=+p.getAttribute('data-p');if(o)step(o);});});})();
