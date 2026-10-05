(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  const closeMenu = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeMenu(); toggle.focus(); }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  const form = document.querySelector('[data-explore-form]');
  const question = document.getElementById('landing-question');
  for (const chip of document.querySelectorAll('[data-question]')) {
    chip.addEventListener('click', () => { question.value = chip.dataset.question; question.focus(); });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = question.value.trim().slice(0, 500);
    try { if (value) sessionStorage.setItem('runsgdLandingQuestion', value); } catch {}
    location.assign('/app/#explore');
  });
  const bar = document.querySelector('.mobile-app-bar');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { bar.hidden = entries[0].isIntersecting; }, {threshold:0}).observe(document.querySelector('.hero'));
  } else bar.hidden = false;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'})
        .then(reg => reg.update()).catch(() => {});
    });
  }
})();
