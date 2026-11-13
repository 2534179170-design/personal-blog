const header = document.querySelector('.top');
const backToTop = document.querySelector('.back-to-top');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scrollScheduled = false;

function updateScroll() {
  const distance = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const progress = Math.min(100, Math.max(0, scrollY / distance * 100));
  document.documentElement.style.setProperty('--page-progress', progress + '%');
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

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll(
    '.welcome, .watching, .home-panels, .home-space, .profile-card, .side-section, .archive .post-row, .album-card, .profile-hero, .collection-panel, .tool-panel'
  );
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('reveal-pending');
      observer.unobserve(entry.target);
    }
  }, {rootMargin:'0px 0px 80px 0px', threshold:0.01});
  for (const target of targets) {
    if (target.hidden || target.getBoundingClientRect().top < innerHeight + 80) continue;
    target.classList.add('reveal-item', 'reveal-pending');
    observer.observe(target);
  }
}
