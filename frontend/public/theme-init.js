// Runs before the first paint so a dark-theme user never sees a flash of the light one.
// It is a separate file (not inline) because the Content-Security-Policy only allows scripts from our own origin.
(function () {
  var dark = false;
  try {
    var saved = localStorage.getItem('theme');
    dark =
      saved === 'dark' ||
      ((saved === null || saved === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    // Blocked storage: follow the system, the choice just does not survive a reload.
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
