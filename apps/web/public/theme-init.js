(function () {
  try {
    var theme = localStorage.getItem('titanapt-theme');
    var accent = localStorage.getItem('titanapt-accent');
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    if (['orange', 'green', 'purple', 'blue'].indexOf(accent) === -1) accent = 'orange';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#080808' : '#F4F0E6');
  } catch (error) {}
})();
