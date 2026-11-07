/* KYRO intro overlay controller — full-screen morph reveal and any-key-to-enter transition. */
(function () {
  'use strict';

  var intro = document.getElementById('kyro-intro');
  if (!intro) {
    document.dispatchEvent(new Event('kyro:intro-finished'));
    return;
  }

  var title = intro.querySelector('.kyro-intro-title');
  var morphLayer = intro.querySelector('.kyro-intro-morph-layer');
  var morphWord = intro.querySelector('.kyro-intro-morph-word');
  var introInner = intro.querySelector('.kyro-intro-inner');
  var cursor = intro.querySelector('.kyro-intro-cursor');
  var letters = Array.prototype.slice.call(intro.querySelectorAll('.kyro-letter'));
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var finished = false;
  var leaving = false;
  var exitFallbackTimer = 0;
  var cursorFrame = 0;
  var letterFrame = 0;
  var morphFrame = 0;
  var morphTargetX = 0, morphTargetY = 0, morphCurrentX = 0, morphCurrentY = 0;
  var pointerSeen = false;
  var insideTitle = false;
  var targetX = -100, targetY = -100, currentX = -100, currentY = -100;
  var letterCenters = [];
  var titleRect = null;
  var introRect = null;
  // Per-letter jelly state: each glyph has independent position, tilt and squash/stretch values.
  var letterMotion = letters.map(function () {
    return { x: 0, y: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, skew: 0, tx: 0, ty: 0, trx: 0, tryy: 0, trz: 0, tsx: 1, tsy: 1, tskew: 0 };
  });
  var resizeObserver = null;
  var fontSet = document.fonts || null;

  function cacheLetterCenters() {
    if (!letters.length) return;
    titleRect = title ? title.getBoundingClientRect() : null;
    introRect = intro.getBoundingClientRect();
    if (morphWord && titleRect) {
      morphWord.style.left = (titleRect.left - introRect.left) + 'px';
      morphWord.style.top = (titleRect.top - introRect.top) + 'px';
      morphWord.style.width = titleRect.width + 'px';
      morphWord.style.height = titleRect.height + 'px';
    }
    letterCenters = letters.map(function (letter, index) {
      var r = letter.getBoundingClientRect();
      var motion = letterMotion[index];
      return { x: r.left + r.width / 2 - motion.x, y: r.top + r.height / 2 - motion.y };
    });
  }

  function onIntroInnerTransitionEnd(event) {
    if (event.propertyName === 'transform') cacheLetterCenters();
  }

  function requestLetterFrame() {
    if (!letterFrame && !reduced && letters.length) letterFrame = requestAnimationFrame(animateLetters);
  }

  function animateLetters() {
    letterFrame = 0;
    var moving = false;
    for (var i = 0; i < letters.length; i++) {
      var s = letterMotion[i];
      s.x += (s.tx - s.x) * 0.20;
      s.y += (s.ty - s.y) * 0.20;
      s.rx += (s.trx - s.rx) * 0.18;
      s.ry += (s.tryy - s.ry) * 0.18;
      s.rz += (s.trz - s.rz) * 0.16;
      // Slightly slower scale recovery creates the soft, elastic jelly response.
      s.sx += (s.tsx - s.sx) * 0.14;
      s.sy += (s.tsy - s.sy) * 0.14;
      s.skew += (s.tskew - s.skew) * 0.16;
      if (Math.abs(s.tx - s.x) > 0.08 || Math.abs(s.ty - s.y) > 0.08 ||
          Math.abs(s.trx - s.rx) > 0.08 || Math.abs(s.tryy - s.ry) > 0.08 ||
          Math.abs(s.trz - s.rz) > 0.08 || Math.abs(s.tsx - s.sx) > 0.001 ||
          Math.abs(s.tsy - s.sy) > 0.001 || Math.abs(s.tskew - s.skew) > 0.08) moving = true;
      else {
        s.x = s.tx; s.y = s.ty; s.rx = s.trx; s.ry = s.tryy; s.rz = s.trz;
        s.sx = s.tsx; s.sy = s.tsy; s.skew = s.tskew;
      }
      letters[i].style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,' + s.y.toFixed(2) + 'px,0) ' +
        'rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) ' +
        'rotateZ(' + s.rz.toFixed(2) + 'deg) skewX(' + s.skew.toFixed(2) + 'deg) scale(' + s.sx.toFixed(3) + ',' + s.sy.toFixed(3) + ')';
    }
    if (moving) letterFrame = requestAnimationFrame(animateLetters);
  }

  // Smoothly interpolated mask position for the EXPLORE reveal. This layer is
  // purely visual and pointer-transparent; the existing intro/global cursors
  // continue to operate independently and are not replaced by this effect.
  function requestMorphFrame() {
    if (!morphFrame && !reduced && morphLayer) morphFrame = requestAnimationFrame(animateMorph);
  }

  function animateMorph() {
    morphFrame = 0;
    morphCurrentX += (morphTargetX - morphCurrentX) * 0.15;
    morphCurrentY += (morphTargetY - morphCurrentY) * 0.15;
    if (morphLayer) {
      morphLayer.style.setProperty('--morph-x', morphCurrentX.toFixed(2) + 'px');
      morphLayer.style.setProperty('--morph-y', morphCurrentY.toFixed(2) + 'px');
    }
    if (Math.abs(morphTargetX - morphCurrentX) > 0.15 || Math.abs(morphTargetY - morphCurrentY) > 0.15) {
      morphFrame = requestAnimationFrame(animateMorph);
    } else {
      morphCurrentX = morphTargetX;
      morphCurrentY = morphTargetY;
      if (morphLayer) {
        morphLayer.style.setProperty('--morph-x', morphCurrentX.toFixed(2) + 'px');
        morphLayer.style.setProperty('--morph-y', morphCurrentY.toFixed(2) + 'px');
      }
    }
  }

  function updateLetterTargets(x, y) {
    if (reduced || !letterCenters.length) return;
    var radius = 245;
    for (var i = 0; i < letterCenters.length; i++) {
      var c = letterCenters[i], s = letterMotion[i];
      var dx = x - c.x, dy = y - c.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var strength = Math.max(0, 1 - dist / radius);
      var impact = strength * strength;
      var dirX = dx / dist, dirY = dy / dist;
      // Each glyph swells toward the pointer and compresses on its vertical axis,
      // giving the word a soft jelly-like deformation without changing its layout.
      var pull = impact * 8.5;
      s.tx = dirX * pull;
      s.ty = dirY * pull * 0.72;
      s.trx = Math.max(-3.5, Math.min(3.5, (-dy / 150) * impact * 3.5));
      s.tryy = Math.max(-4, Math.min(4, (dx / 150) * impact * 4));
      s.trz = Math.max(-4.5, Math.min(4.5, (dx / radius) * impact * 5.5));
      s.tsx = 1 + impact * (0.15 + Math.abs(dirX) * 0.025);
      s.tsy = 1 - impact * (0.12 + Math.abs(dirY) * 0.02);
      s.tskew = Math.max(-3.5, Math.min(3.5, (dx / radius) * impact * 3.8));
    }
    requestLetterFrame();
  }

  function cursorLoop() {
    cursorFrame = 0;
    if (finished || !cursor || !pointerSeen) return;
    // A small amount of easing keeps the ring fluid without noticeable pointer lag.
    currentX += (targetX - currentX) * 0.48;
    currentY += (targetY - currentY) * 0.48;
    cursor.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px,' + currentY.toFixed(2) + 'px,0)';
    if (Math.abs(targetX - currentX) > 0.12 || Math.abs(targetY - currentY) > 0.12) {
      cursorFrame = requestAnimationFrame(cursorLoop);
    } else {
      currentX = targetX; currentY = targetY;
      cursor.style.transform = 'translate3d(' + currentX.toFixed(2) + 'px,' + currentY.toFixed(2) + 'px,0)';
    }
  }

  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    pointerSeen = true;
    targetX = event.clientX;
    targetY = event.clientY;
    root.classList.add('is-pointer-ready');
    if (cursor) cursor.classList.add('is-active');
    if (!cursorFrame) cursorFrame = requestAnimationFrame(cursorLoop);
    var hovering = false;
    if (titleRect) {
      var r = titleRect;
      hovering = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      if (hovering !== insideTitle) {
        insideTitle = hovering;
        if (cursor) cursor.classList.toggle('is-hovering', hovering);
      }
    }

    // The circular reveal follows the pointer across the complete entrance
    // screen, not only while it is over the KYRO letters. The alternate word
    // remains aligned to the title through the cached title bounds.
    if (morphLayer && introRect) {
      var wasMorphing = morphLayer.classList.contains('is-morphing');
      morphTargetX = event.clientX - introRect.left;
      morphTargetY = event.clientY - introRect.top;
      if (!wasMorphing) {
        morphCurrentX = morphTargetX;
        morphCurrentY = morphTargetY;
        morphLayer.style.setProperty('--morph-x', morphCurrentX.toFixed(2) + 'px');
        morphLayer.style.setProperty('--morph-y', morphCurrentY.toFixed(2) + 'px');
      }
      morphLayer.classList.add('is-morphing');
      requestMorphFrame();
    }
    updateLetterTargets(event.clientX, event.clientY);
  }

  function onWindowPointerOut(e) {
    if (!e.relatedTarget && (e.clientY <= 0 || e.clientY >= innerHeight || e.clientX <= 0 || e.clientX >= innerWidth)) onPointerLeave();
  }

  function onPointerLeave() {
    pointerSeen = false;
    insideTitle = false;
    root.classList.remove('is-pointer-ready');
    if (cursor) cursor.classList.remove('is-active', 'is-hovering');
    if (morphLayer) morphLayer.classList.remove('is-morphing');
    if (morphFrame) cancelAnimationFrame(morphFrame);
    morphFrame = 0;
    for (var i = 0; i < letterMotion.length; i++) {
      var s = letterMotion[i];
      s.tx = s.ty = s.trx = s.tryy = s.trz = s.tskew = 0;
      s.tsx = s.tsy = 1;
    }
    requestLetterFrame();
  }

  function setupInteractions() {
    if (reduced || !finePointer) return;
    cacheLetterCenters();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    if (introInner) introInner.addEventListener('transitionend', onIntroInnerTransitionEnd);
    window.addEventListener('pointerout', onWindowPointerOut, { passive: true });
    window.addEventListener('blur', onPointerLeave);
    window.addEventListener('resize', cacheLetterCenters, { passive: true });
    window.addEventListener('scroll', cacheLetterCenters, { passive: true });
    if (window.ResizeObserver && title) {
      resizeObserver = new ResizeObserver(cacheLetterCenters);
      resizeObserver.observe(title);
    }
    if (fontSet && fontSet.ready) fontSet.ready.then(function () { if (!finished) cacheLetterCenters(); });
  }

  function cleanup() {
    document.removeEventListener('keydown', requestExit);
    window.removeEventListener('pointermove', onPointerMove);
    if (introInner) introInner.removeEventListener('transitionend', onIntroInnerTransitionEnd);
    window.removeEventListener('pointerout', onWindowPointerOut);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('resize', cacheLetterCenters);
    window.removeEventListener('scroll', cacheLetterCenters);
    if (cursorFrame) cancelAnimationFrame(cursorFrame);
    if (letterFrame) cancelAnimationFrame(letterFrame);
    if (morphFrame) cancelAnimationFrame(morphFrame);
    morphFrame = 0;
    if (resizeObserver) resizeObserver.disconnect();
    root.classList.remove('is-pointer-ready');
    if (fontSet && fontSet.removeEventListener) fontSet.removeEventListener('loadingdone', cacheLetterCenters);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (exitFallbackTimer) { window.clearTimeout(exitFallbackTimer); exitFallbackTimer = 0; }
    cleanup();
    intro.remove();
    root.classList.remove('kyro-intro-active');
    document.dispatchEvent(new Event('kyro:intro-finished'));
  }

  function requestExit(event) {
    if (finished || leaving) return;
    if (event && event.preventDefault) event.preventDefault();
    leaving = true;
    intro.classList.add('is-leaving');
    // The intro remains indefinitely until any keyboard key is pressed.
    // Reduced-motion users keep the same exit state with a near-instant transition.
    exitFallbackTimer = window.setTimeout(finish, reduced ? 60 : 1100);
  }

  function begin() {
    setupInteractions();
    root.classList.add('kyro-intro-active');
    // Keep both entry methods available: any key press or a click/tap on the
    // full-screen intro starts the same one-shot slide-up transition.
    document.addEventListener('keydown', requestExit);
    intro.addEventListener('click', requestExit);
    intro.addEventListener('transitionend', function (event) {
      if (event.target === intro && event.propertyName === 'transform' && intro.classList.contains('is-leaving')) finish();
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (!finished) intro.classList.add('is-visible'); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
  else begin();
})();
