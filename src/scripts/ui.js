const header = document.querySelector('.top');
const backToTop = document.querySelector('.back-to-top');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scrollScheduled = false;

function updateScroll() {
  header?.classList.toggle('is-scrolled', scrollY > 14);
  backToTop?.classList.toggle('is-visible', scrollY > 480);
  scrollScheduled = false;
}

addEventListener('scroll', () => {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(updateScroll);
}, {passive:true});
addEventListener('resize', updateScroll);
backToTop?.addEventListener('click', () => scrollTo({top:0, behavior:reducedMotion.matches ? 'auto' : 'smooth'}));
updateScroll();


const chapterLinks = [...document.querySelectorAll('.home-contents a')];
const chapters = chapterLinks.map(link => document.getElementById(link.hash.slice(1)));

function highlightChapter() {
  const marker = Math.min(innerHeight * 0.4, 280);
  const active = chapters.filter(section => section && section.getBoundingClientRect().top <= marker).at(-1);
  chapterLinks.forEach(link => {
    if (active && link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

if (chapters.length) {
  let queued = false;
  const scheduleChapter = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { highlightChapter(); queued = false; });
  };
  addEventListener('scroll', scheduleChapter, {passive:true});
  addEventListener('resize', scheduleChapter);
  highlightChapter();
}

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (reducedMotion.matches) continue;
      const section = entry.target;
      const parts = section.querySelectorAll('.section-head, #watch-list, .post-list, .stats-cards, .activity-list, .photo-grid');
      const layers = parts.length ? [...parts] : [section];
      layers.forEach((layer, index) => layer.animate(
        [{ opacity: .25, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, delay: index * 65, easing: 'ease-out', fill: 'backwards' }
      ));
    }
  }, { threshold: 0.04 });
  document.querySelectorAll('.watching, .collection-stats, .activity, .home-space, .gallery-wall').forEach(section => observer.observe(section));
}
