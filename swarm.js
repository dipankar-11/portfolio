/* KYRO — build animation loader.
 * Runs the real "Swarm Rebuild" effect (swarm-rebuild.js, unmodified) once the entrance screen has slid away:
 * the page blanks, a swarm of multiplayer cursors rebuilds it piece by piece with typing and click sounds
 * and soft music, then "Go live" hands back the real page. Press M to mute, Esc to skip.
 * ?swarm=off disables the auto-run. A small "Watch the build" button replays it. */
(function () {
  'use strict';
  var KEY = '__swarmRebuild';
  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var loaded = false, loading = false, watcher = 0, pill = null;

  function morph(on) {
    var m = window.kyroMorphCursor;
    if (!m) return;
    try { if (on) m.enable(); else m.disable(); } catch (e) {}
  }

  function setPill(show) { if (pill) pill.style.display = show ? 'block' : 'none'; }

  function watch() {
    clearInterval(watcher);
    watcher = setInterval(function () {
      var sw = window[KEY];
      if (sw && sw.app) return;                       // still running
      clearInterval(watcher);
      // the swarm fades out for ~1.2 s after "Go live"; bring the site cursor back once it is gone
      setTimeout(function () { morph(true); setPill(true); }, 1300);
    }, 250);
  }

  function run() {
    morph(false); setPill(false);
    var sw = window[KEY];
    if (sw) { if (!sw.app) sw.start(); }
    else if (!loading) {
      loading = true;
      var s = document.createElement('script');
      s.src = 'swarm-rebuild.js';
      s.onload = function () { loaded = true; loading = false; };
      s.onerror = function () { loading = false; morph(true); setPill(false); };
      document.head.appendChild(s);                   // the script starts itself when it loads
    }
    window.scrollTo(0, 0);
    watch();
    autoTour();
  }

  // The extension only auto-scrolls when its "Tour" button is on; switch it on so the swarm builds the whole page hands-free.
  function autoTour() {
    var tries = 0, t = setInterval(function () {
      var sw = window[KEY], a = sw && sw.app;
      if (++tries > 200 || (tries > 8 && !a)) { clearInterval(t); return; }
      if (!a || !a.view || !a.engine || !a.engine.started || !a.view.hud) return;
      clearInterval(t);
      var b = a.view.hud.querySelector('[data-a="tour"]');
      if (b && !a.tour) b.click();
    }, 150);
  }

  function init() {
    pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'btn sw-pill'; pill.textContent = '\u25B6 Watch the build';
    pill.addEventListener('click', run);
    document.body.appendChild(pill);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  function autoStart() {
    if (params.get('swarm') === 'off' || reduce) return;
    // let the page's own entrance animations settle so the snapshot sees the finished layout
    setTimeout(function () { if (document.visibilityState === 'visible') run(); }, 700);
  }
  if (document.getElementById('kyro-intro')) document.addEventListener('kyro:intro-finished', autoStart, { once: true });
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart, { once: true });
  else autoStart();

  window.kyroBuild = { start: run, stop: function () { var sw = window[KEY]; if (sw && sw.app) sw.stop(true); } };
})();
