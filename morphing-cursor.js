/* KYRO — red morphing cursor for the portfolio (not the entrance).
 *
 * Entrance screen: the EXPLORE reveal lives entirely in intro.js; this cursor stays hidden there.
 * Website: a red circle follows the pointer. Any text under it is redrawn in BLACK inside the
 * circle so it stays readable. Over small boxes and rectangles (buttons, pills, tags, stat boxes,
 * the contact email box, social links…) the circle morphs into that box's shape and size.
 * No words are ever shown inside the cursor on the website.
 */
(function () {
  'use strict';
  if (window.__kyroMorphCursor) return;
  window.__kyroMorphCursor = true;

  var CONFIG = {
    size: 42,             // resting circle diameter
    posLerp: 0.15,        // pointer follow easing
    shapeLerp: 0.2,       // size / radius morph easing
    padX: 12, padY: 8,    // how far the morph box extends past the element
    minW: 38, minH: 34,
    maxW: 560, maxH: 96,  // large enough for the contact email box and social pills
    red: '#EF4444',
    redOnRed: '#FF7A7A'   // lighter red so the circle stays visible over red surfaces
  };

  var finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var root = document.documentElement;

  var SHAPE_SELECTOR = [
    'a[href]', 'button:not(:disabled)', '[role="button"]', '.nav-item', '.dock-cta', '.btn', '.filter-btn',
    '.layer-tab', '.tech-tag', '.tag', '.category-chip', '.social-pill', '.email-action-box', '.hero-role-pill',
    '.hero-stat-box', '.metric-pill', '.flagship-badge', '.hud-tag', '.brand-monogram', '.cutout-status-badge'
  ].join(',');
  var SKIP_TEXT = 'script,style,noscript,canvas,.kyro-global-morph-cursor,.sw-agent,.sw-layer,#kyro-intro';

  var enabled = false, pointerSeen = false, frameId = 0, observer = null;
  var layer = null, circle = null;
  var pointerX = -100, pointerY = -100;      // raw pointer
  var targetX = -100, targetY = -100;        // where the shape wants to be (pointer, or control centre)
  var curX = -100, curY = -100;              // animated centre
  var shape = { w: CONFIG.size, h: CONFIG.size, r: CONFIG.size / 2 };
  var shapeTarget = { w: CONFIG.size, h: CONFIG.size, r: CONFIG.size / 2 };
  var activeControl = null;
  var clones = [];                           // [{ src, el }]
  var blockCache = [], blocksDirty = true, blocksBuiltAt = 0;
  var lastSetX = -999, lastSetY = -999;

  /* ---------- helpers ---------- */
  function motionAllowed() {
    return !!(finePointer && finePointer.matches && !(reducedMotion && reducedMotion.matches));
  }
  function introActive() { return root.classList.contains('kyro-intro-active'); }
  function elOf(node) { return node && (node.nodeType === 1 ? node : node.parentElement); }
  function parseColor(c) {
    if (!c || c === 'transparent') return null;
    var m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (!m) return null;
    var a = m[4] == null ? 1 : (m[4].indexOf('%') >= 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a: a };
  }
  function backgroundAt(node) {
    var el = elOf(node);
    while (el && el !== root) {
      var p = parseColor(getComputedStyle(el).backgroundColor);
      if (p && p.a > 0.08) return p;
      el = el.parentElement;
    }
    return { r: 5, g: 5, b: 5, a: 1 };
  }
  function isRedSurface(bg) { return bg.r > 115 && bg.r > bg.g * 1.22 && bg.r > bg.b * 1.2; }

  /* ---------- layer ---------- */
  function createLayer() {
    if (layer || !document.body) return;
    layer = document.createElement('div');
    layer.className = 'kyro-global-morph-cursor';
    layer.setAttribute('aria-hidden', 'true');
    circle = document.createElement('div');
    circle.className = 'kyro-global-morph-circle';
    layer.appendChild(circle);
    document.body.appendChild(layer);
  }

  /* ---------- small-box detection ---------- */
  function isBoxedControl(el) {
    if (!el || !el.isConnected) return false;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.width > CONFIG.maxW || rect.height > CONFIG.maxH) return false;
    var s = getComputedStyle(el);
    var bg = parseColor(s.backgroundColor);
    var border = ['Top', 'Right', 'Bottom', 'Left'].some(function (side) {
      return parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none';
    });
    var radius = parseFloat(s.borderTopLeftRadius) > 0;
    return !!((bg && bg.a > 0.04) || border || radius);
  }
  function findControl(node) {
    var el = elOf(node);
    while (el && el !== document.body && el !== root) {
      if (el.matches && el.matches(SHAPE_SELECTOR) && isBoxedControl(el)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function shapeFor(control) {
    if (!control) return { w: CONFIG.size, h: CONFIG.size, r: CONFIG.size / 2 };
    var rect = control.getBoundingClientRect();
    var w = Math.max(CONFIG.minW, Math.min(CONFIG.maxW + CONFIG.padX, rect.width + CONFIG.padX));
    var h = Math.max(CONFIG.minH, Math.min(CONFIG.maxH + CONFIG.padY, rect.height + CONFIG.padY));
    var s = getComputedStyle(control);
    var r = parseFloat(s.borderTopLeftRadius);
    r = r > 0 ? r + 2 : 2;   // square controls stay (almost) square
    r = Math.min(r, Math.min(w, h) / 2);
    if (s.borderTopLeftRadius.indexOf('%') >= 0) r = Math.min(w, h) / 2;
    return { w: w, h: h, r: r };
  }

  /* ---------- text blocks (what gets redrawn in black) ---------- */
  function buildBlockCache() {
    blocksDirty = false; blocksBuiltAt = performance.now();
    var found = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      var el = n.parentElement;
      if (!el || (el.closest && el.closest(SKIP_TEXT))) continue;
      var block = null;
      var svg = el.closest ? el.closest('svg') : null;
      if (svg) {
        block = svg.closest('.hero-wordmark-svg');
        if (!block) continue;
      } else {
        block = el;
        while (block.parentElement && block !== document.body) {
          var d = getComputedStyle(block).display;
          if (d === 'inline' || d === 'contents') block = block.parentElement; else break;
        }
      }
      if (block && found.indexOf(block) < 0) found.push(block);
    }
    // outermost wins: drop blocks that live inside another cached block
    blockCache = found.filter(function (b) {
      for (var i = 0; i < found.length; i++) if (found[i] !== b && found[i].contains(b)) return false;
      return true;
    });
  }
  function visibleEnough(el) {
    var node = el, depth = 0;
    while (node && node !== document.body && depth < 8) {
      var s = getComputedStyle(node);
      if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.1) return false;
      node = node.parentElement; depth++;
    }
    return true;
  }
  function blocksUnder(box) {
    if (blocksDirty && performance.now() - blocksBuiltAt > 250) buildBlockCache();
    else if (!blockCache.length) buildBlockCache();
    var out = [];
    for (var i = 0; i < blockCache.length; i++) {
      var b = blockCache[i];
      if (!b.isConnected) { blocksDirty = true; continue; }
      var r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var l = Math.max(r.left, box.left), t = Math.max(r.top, box.top);
      var rr = Math.min(r.right, box.right), bb = Math.min(r.bottom, box.bottom);
      if (rr <= l || bb <= t) continue;
      if (!visibleEnough(b)) continue;
      // skip text that is covered by something else (e.g. the floating nav dock)
      if (!b.classList.contains('hero-wordmark-svg')) {
        var hit = document.elementFromPoint((l + rr) / 2, (t + bb) / 2);
        if (!hit || !b.contains(hit)) continue;
      }
      out.push(b);
    }
    return out;
  }

  /* ---------- black clones ---------- */
  var COPY_PROPS = [
    'box-sizing', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch',
    'letter-spacing', 'word-spacing', 'line-height', 'text-align', 'text-transform', 'text-decoration-line',
    'text-decoration-style', 'text-decoration-thickness', 'text-underline-offset', 'white-space', 'word-break',
    'overflow-wrap', 'direction', 'vertical-align', 'padding-top', 'padding-right', 'padding-bottom',
    'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'text-indent',
    'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'align-content', 'justify-items',
    'gap', 'row-gap', 'column-gap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'grid-template-columns', 'grid-template-rows', 'list-style-type', 'list-style-position'
  ];
  function blockify(display) {
    if (display === 'inline-flex') return 'flex';
    if (display === 'inline-grid') return 'grid';
    if (display === 'inline' || display === 'inline-block') return 'block';
    return display;
  }
  function blackout(src, copy, isRoot) {
    if (src.nodeType !== 1 || copy.nodeType !== 1) return;
    var cs = getComputedStyle(src);
    var tag = src.tagName.toLowerCase();
    for (var i = 0; i < COPY_PROPS.length; i++) {
      var v = cs.getPropertyValue(COPY_PROPS[i]);
      if (v) copy.style.setProperty(COPY_PROPS[i], v, 'important');
    }
    var display = blockify(cs.display);
    if (!isRoot && cs.display === 'inline') display = 'inline';
    if (tag !== 'svg' && tag !== 'text' && tag !== 'tspan' && tag !== 'path' && tag !== 'rect' && tag !== 'circle' && tag !== 'line') {
      copy.style.setProperty('display', display, 'important');
    }
    if (!isRoot && cs.display !== 'inline' && cs.width !== 'auto') {
      copy.style.setProperty('width', cs.width, 'important');
      copy.style.setProperty('height', cs.height, 'important');
    }
    var fill = cs.fill === 'none' ? 'none' : '#000000';
    var stroke = (cs.stroke === 'none' || !cs.stroke) ? 'none' : '#000000';
    var o = {
      color: '#000000', '-webkit-text-fill-color': '#000000', fill: fill, stroke: stroke,
      background: 'transparent', 'background-image': 'none', 'border-color': 'transparent',
      'box-shadow': 'none', 'text-shadow': 'none', 'text-decoration-color': '#000000', filter: 'none',
      'backdrop-filter': 'none', 'mix-blend-mode': 'normal', opacity: '1', transform: 'none', translate: 'none',
      animation: 'none', transition: 'none', outline: 'none'
    };
    Object.keys(o).forEach(function (k) { copy.style.setProperty(k, o[k], 'important'); });
    // keep layout, hide pictures: images/video/iframes become invisible placeholders
    if (/^(img|picture|video|audio|iframe|object|embed|canvas)$/.test(tag)) copy.style.setProperty('visibility', 'hidden', 'important');
    if (src.getAttribute && src.getAttribute('aria-hidden') === 'true' && !isRoot && !/^(svg|path|rect|circle|line|text|g)$/.test(tag)) {
      // decorative glyphs (e.g. status dots) keep their space but are not redrawn
      copy.style.setProperty('visibility', 'hidden', 'important');
    }
    copy.removeAttribute('id');
    copy.removeAttribute('href');
    for (var j = 0; j < src.children.length && j < copy.children.length; j++) blackout(src.children[j], copy.children[j], false);
  }
  function makeClone(src) {
    var el = src.cloneNode(true);
    el.querySelectorAll('script,style,canvas').forEach(function (n) { n.remove(); });
    blackout(src, el, true);
    el.classList.add('kyro-global-morph-text');
    el.setAttribute('aria-hidden', 'true');
    var st = el.style;
    st.setProperty('position', 'fixed', 'important');
    st.setProperty('margin', '0', 'important');
    st.setProperty('overflow', 'visible', 'important');
    st.setProperty('pointer-events', 'none', 'important');
    st.setProperty('z-index', '2', 'important');
    st.setProperty('clip-path', 'inset(50%)', 'important');
    layer.appendChild(el);
    return { src: src, el: el };
  }
  function syncClones(sources) {
    var keep = [];
    clones.forEach(function (c) {
      if (sources.indexOf(c.src) >= 0 && c.src.isConnected) keep.push(c);
      else if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
    });
    sources.forEach(function (s) {
      if (!keep.some(function (c) { return c.src === s; })) keep.push(makeClone(s));
    });
    clones = keep;
  }
  function clearClones() { syncClones([]); }
  function positionClones() {
    var left = curX - shape.w / 2, top = curY - shape.h / 2;
    for (var i = 0; i < clones.length; i++) {
      var c = clones[i];
      if (!c.src.isConnected) continue;
      var r = c.src.getBoundingClientRect();
      var s = c.el.style;
      s.left = r.left + 'px'; s.top = r.top + 'px';
      s.width = r.width + 'px'; s.height = r.height + 'px';
      var iTop = Math.max(0, top - r.top);
      var iLeft = Math.max(0, left - r.left);
      var iRight = Math.max(0, r.right - (left + shape.w));
      var iBottom = Math.max(0, r.bottom - (top + shape.h));
      var clip = 'inset(' + iTop.toFixed(2) + 'px ' + iRight.toFixed(2) + 'px ' + iBottom.toFixed(2) + 'px ' +
        iLeft.toFixed(2) + 'px round ' + shape.r.toFixed(2) + 'px)';
      s.setProperty('clip-path', clip, 'important');
      s.setProperty('-webkit-clip-path', clip, 'important');
    }
  }
  function updateSources(force) {
    if (!layer) return;
    if (activeControl) {          // the control itself is redrawn black inside the morphed box
      syncClones([activeControl]);
      return;
    }
    var moved = Math.abs(curX - lastSetX) + Math.abs(curY - lastSetY);
    if (!force && moved < 5) return;
    lastSetX = curX; lastSetY = curY;
    var pad = 3;
    syncClones(blocksUnder({
      left: curX - shape.w / 2 - pad, top: curY - shape.h / 2 - pad,
      right: curX + shape.w / 2 + pad, bottom: curY + shape.h / 2 + pad
    }));
  }

  /* ---------- state + animation ---------- */
  function applyState(node) {
    if (!circle) return;
    var control = findControl(node);
    activeControl = control;
    shapeTarget = shapeFor(control);
    if (control) {
      var r = control.getBoundingClientRect();
      targetX = r.left + r.width / 2;
      targetY = r.top + r.height / 2;
    } else {
      targetX = pointerX; targetY = pointerY;
    }
    circle.style.backgroundColor = isRedSurface(backgroundAt(node)) ? CONFIG.redOnRed : CONFIG.red;
    updateSources(true);
  }
  function requestFrame() {
    if (!frameId && enabled && pointerSeen) frameId = requestAnimationFrame(renderFrame);
  }
  function renderFrame() {
    frameId = 0;
    if (!enabled || !pointerSeen || !layer) return;
    var f = reducedMotion && reducedMotion.matches ? 1 : CONFIG.posLerp;
    var g = reducedMotion && reducedMotion.matches ? 1 : CONFIG.shapeLerp;
    curX += (targetX - curX) * f;
    curY += (targetY - curY) * f;
    shape.w += (shapeTarget.w - shape.w) * g;
    shape.h += (shapeTarget.h - shape.h) * g;
    shape.r += (shapeTarget.r - shape.r) * g;
    var settled = Math.abs(targetX - curX) < 0.12 && Math.abs(targetY - curY) < 0.12 &&
      Math.abs(shapeTarget.w - shape.w) < 0.3 && Math.abs(shapeTarget.h - shape.h) < 0.3 &&
      Math.abs(shapeTarget.r - shape.r) < 0.3;
    if (settled) {
      curX = targetX; curY = targetY;
      shape.w = shapeTarget.w; shape.h = shapeTarget.h; shape.r = shapeTarget.r;
    }
    var rad = Math.min(shape.r, Math.min(shape.w, shape.h) / 2);
    circle.style.left = curX.toFixed(2) + 'px';
    circle.style.top = curY.toFixed(2) + 'px';
    circle.style.width = shape.w.toFixed(2) + 'px';
    circle.style.height = shape.h.toFixed(2) + 'px';
    circle.style.borderRadius = rad.toFixed(2) + 'px';
    shape.r = Math.min(shape.r, Math.min(shape.w, shape.h) / 2 + 0.01);
    updateSources(false);
    positionClones();
    if (!settled) requestFrame();
  }
  function onPointerMove(e) {
    if (introActive()) return;
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var first = !pointerSeen;
    pointerSeen = true;
    pointerX = e.clientX; pointerY = e.clientY;
    if (first || curX < -50) { curX = pointerX; curY = pointerY; }
    applyState(document.elementFromPoint(pointerX, pointerY) || e.target);
    layer.classList.add('is-visible');
    requestFrame();
  }
  function onPointerOut(e) {
    if (e && e.relatedTarget) return;
    pointerSeen = false;
    if (layer) layer.classList.remove('is-visible');
    if (frameId) { cancelAnimationFrame(frameId); frameId = 0; }
    clearClones();
    activeControl = null;
    shapeTarget = { w: CONFIG.size, h: CONFIG.size, r: CONFIG.size / 2 };
    shape = { w: CONFIG.size, h: CONFIG.size, r: CONFIG.size / 2 };
  }
  function refresh() {
    if (!pointerSeen || introActive()) return;
    blocksDirty = true;
    applyState(document.elementFromPoint(pointerX, pointerY));
    requestFrame();
  }

  /* ---------- lifecycle ---------- */
  function setIntro(active) {
    if (!layer) return;
    layer.classList.toggle('is-intro-mode', active);
    if (active) onPointerOut(null); else refresh();
  }
  function enable() {
    if (enabled || !motionAllowed() || !document.body) return;
    enabled = true;
    createLayer();
    root.classList.add('kyro-morph-cursor-enabled');
    setIntro(introActive());
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('blur', onPointerOut);
    window.addEventListener('scroll', refresh, { passive: true, capture: true });
    window.addEventListener('resize', refresh, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { blocksDirty = true; });
    if (window.MutationObserver) {
      observer = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var t = records[i].target, el = elOf(t);
          if (el && el.closest && el.closest('.kyro-global-morph-cursor')) continue;
          blocksDirty = true;
          if (pointerSeen) refresh();
          break;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerout', onPointerOut);
    window.removeEventListener('blur', onPointerOut);
    window.removeEventListener('scroll', refresh, true);
    window.removeEventListener('resize', refresh);
    if (observer) { observer.disconnect(); observer = null; }
    if (frameId) { cancelAnimationFrame(frameId); frameId = 0; }
    clones = [];
    if (layer) layer.remove();
    layer = circle = null;
    pointerSeen = false;
    root.classList.remove('kyro-morph-cursor-enabled');
  }
  function mediaChanged() { if (motionAllowed()) enable(); else disable(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enable, { once: true });
  else enable();
  document.addEventListener('kyro:intro-started', function () { if (!enabled) enable(); setIntro(true); });
  document.addEventListener('kyro:intro-finished', function () { if (!enabled) enable(); setIntro(false); });
  if (finePointer && finePointer.addEventListener) finePointer.addEventListener('change', mediaChanged);
  if (reducedMotion && reducedMotion.addEventListener) reducedMotion.addEventListener('change', mediaChanged);
  window.addEventListener('pagehide', disable);
  window.addEventListener('pageshow', function (e) { if (e.persisted) enable(); });
  window.kyroMorphCursor = { enable: enable, disable: disable, refresh: refresh };
})();
