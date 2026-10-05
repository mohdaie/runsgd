/* Apply before the first paint. Appearance is independent of sign-in and journeys. */
(() => {
  'use strict';
  const key = 'runsgdTheme';
  const themes = { classic: 'Current theme', neobrutalism: 'Rounded Neobrutalism' };
  let current = 'classic';
  let defaultChrome;
  const normalize = value => Object.hasOwn(themes, value) ? value : 'classic';

  function apply(value) {
    current = normalize(value);
    document.documentElement.dataset.runsgdTheme = current;
    const chrome = document.querySelector('meta[name="theme-color"]');
    if (chrome) {
      if (defaultChrome === undefined) defaultChrome = chrome.content;
      chrome.content = current === 'neobrutalism' ? '#f7f8fa' : defaultChrome;
    }
    document.querySelectorAll('input[name="runsgd-theme"]').forEach(input => {
      input.checked = input.value === current;
    });
  }

  try { apply(localStorage.getItem(key)); } catch { apply('classic'); }

  function choose(value) {
    apply(value);
    let saved = true;
    try { localStorage.setItem(key, current); } catch { saved = false; }
    const status = document.getElementById('themeStatus');
    if (status) status.textContent = themes[current] + ' applied. ' +
      (saved ? 'Saved on this device.' : 'Storage is unavailable; this choice lasts for this page only.');
  }

  document.addEventListener('change', event => {
    if (event.target.matches('input[name="runsgd-theme"]')) choose(event.target.value);
  });
  document.addEventListener('DOMContentLoaded', () => apply(current), { once: true });
  window.addEventListener('pageshow', () => {
    try { apply(localStorage.getItem(key)); } catch { apply(current); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    apply(event.newValue);
    const status = document.getElementById('themeStatus');
    if (status) status.textContent = themes[current] + ' applied from another tab.';
  });
})();
