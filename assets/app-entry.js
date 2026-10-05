/* The old root URL remains an OAuth callback and an entry for installed PWAs. */
(function (root) {
  'use strict';
  const appTabs = new Set(['home', 'explore', 'journey', 'community', 'more', 'signin']);
  function destination(href, standalone = false) {
    const url = new URL(href);
    if (url.pathname !== '/' && url.pathname !== '/index.html') return null;
    const fragment = url.hash.slice(1);
    const token = new URLSearchParams(fragment);
    const callback = ['auth', 'code', 'error', 'error_description'].some(key => url.searchParams.has(key)) ||
      ['access_token', 'refresh_token', 'error', 'error_description', 'token_hash'].some(key => token.has(key));
    const oldApp = ['appv', 'resume', 'mobile', '_rescue'].some(key => url.searchParams.has(key));
    if (!standalone && !callback && !oldApp && !appTabs.has(fragment)) return null;
    url.pathname = '/app/';
    return url.pathname + url.search + url.hash;
  }
  root.RunSGDEntry = { destination };
  if (root.location) {
    const redirect = () => {
      const standalone = root.matchMedia?.('(display-mode: standalone)')?.matches ||
        root.navigator?.standalone === true || root.document?.referrer.startsWith('android-app://');
      const next = destination(root.location.href, standalone);
      if (next) root.location.replace(next);
    };
    redirect();
    root.addEventListener?.('hashchange', redirect);
    root.addEventListener?.('pageshow', redirect);
  }
})(typeof window === 'undefined' ? globalThis : window);
