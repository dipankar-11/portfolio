/**
 * KYRO — PORTFOLIO OF DIPANKAR DAS
 * Modern Vanilla JavaScript — Noir & Crimson Ambient Canvas, Interactive Project Explorer, Bento Filter & Clipboard
 */

(function () {
  'use strict';

  // ==========================================================================
  // PROJECT DEEP-DIVE TABS DATA
  // ==========================================================================
  const LAYER_DATA = {
    1: { badge: 'STEP 01 // IDEA', title: 'The Idea', desc: 'A personal portfolio that presents my profile, technical learning and creative interests through a responsive web experience.', tags: ['HTML', 'CSS'] },
    2: { badge: 'STEP 02 // DESIGN', title: 'The Design', desc: 'Planning the information hierarchy, choosing a clean visual direction and keeping the layout easy to navigate.', tags: ['Layout', 'Visual hierarchy'] },
    3: { badge: 'STEP 03 // BUILD', title: 'The Build', desc: 'Built with vanilla HTML, CSS and JavaScript while practising semantic structure, responsive styling and front-end fundamentals.', tags: ['HTML', 'CSS', 'JavaScript'] },
    4: { badge: 'STEP 04 // FEATURES', title: 'Key Features', desc: 'Responsive sections, clear navigation, project summaries and direct links to my current profiles.', tags: ['Responsive UI', 'Navigation'] },
    5: { badge: 'STEP 05 // STACK', title: 'Tech Stack', desc: 'The earlier site uses core web technologies and familiar developer tools to keep the experience lightweight.', tags: ['HTML', 'CSS', 'JavaScript', 'Git'] },
    6: { badge: 'STEP 06 // RESULTS', title: 'Results', desc: 'The project helped me practise building and presenting a complete responsive website from the ground up.', tags: ['Self-directed', 'Learning'] },
    7: { badge: 'STEP 07 // NEXT', title: "What's Next", desc: 'Continue refining my front-end skills and publish new logo, editing and design work as it is ready.', tags: ['Practice', 'Publish'] }
  };

  // ==========================================================================
  // AMBIENT NOIR & CRIMSON OP-ART CANVAS (Optimized with Hero IntersectionObserver)
  // ==========================================================================
  function initAuroraCanvas() {
    const canvas = document.getElementById('aurora-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let animationFrameId = null;
    let isRunning = false;
    let mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    let frame = 0;

    // Atmospheric Crimson Orbs (Red & Noir focus)
    const orbs = [
      { x: 0.35, y: 0.40, radius: 0.50, vx: 0.0003, vy: 0.0002, color: 'rgba(239, 68, 68, 0.14)' }, // Crimson Red
      { x: 0.70, y: 0.45, radius: 0.42, vx: -0.0002, vy: 0.0003, color: 'rgba(185, 28, 28, 0.10)' }, // Deep Blood Red
      { x: 0.50, y: 0.80, radius: 0.48, vx: 0.0002, vy: -0.0002, color: 'rgba(255, 255, 255, 0.03)' }  // Ghost Monochrome
    ];

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();

    window.addEventListener('mousemove', (e) => {
      mouse.targetX = e.clientX / width;
      mouse.targetY = e.clientY / height;
    }, { passive: true });

    function render() {
      if (!isRunning) return;
      frame++;

      // Ease mouse coordinates for smooth parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Render subtle crimson orbs
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x < 0.1 || orb.x > 0.9) orb.vx *= -1;
        if (orb.y < 0.1 || orb.y > 0.9) orb.vy *= -1;

        const px = (orb.x + (mouse.x - 0.5) * 0.06) * width;
        const py = (orb.y + (mouse.y - 0.5) * 0.06) * height;
        const r = orb.radius * Math.min(width, height);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtle Op-Art Concentric Ambient Rings
      const centerX = width * 0.5 + (mouse.x - 0.5) * 20;
      const centerY = height * 0.45 + (mouse.y - 0.5) * 20;
      const baseR = (frame * 0.4) % 120;

      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ringRadius = baseR + i * 140;
        const alpha = Math.max(0, 0.04 - (ringRadius / (Math.max(width, height) * 0.7)) * 0.04);
        if (alpha > 0.005) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    function startLoop() {
      if (!isRunning) {
        isRunning = true;
        render();
      }
    }

    function stopLoop() {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    startLoop();

    // Pause rendering when tab is hidden to conserve GPU/CPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    });

    // Pause rendering when Hero is scrolled out of viewport (Solves GPU waste flaw)
    const heroSection = document.getElementById('hero');
    if (heroSection && 'IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startLoop();
          } else {
            stopLoop();
          }
        });
      }, { threshold: 0.02 });
      heroObserver.observe(heroSection);
    }
  }

  // ==========================================================================
  // PROJECT DEEP-DIVE TAB SWITCHER
  // ==========================================================================
  function initLayerTabs() {
    const tabs = document.querySelectorAll('.layer-tab');
    const badgeEl = document.getElementById('layer-inspect-id');
    const titleEl = document.getElementById('layer-inspect-title');
    const descEl = document.getElementById('layer-inspect-desc');
    const tagsEl = document.getElementById('layer-inspect-tags');
    const contentPane = document.getElementById('layer-content');

    if (!tabs.length || !titleEl) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const layerNum = tab.getAttribute('data-layer');
        const data = LAYER_DATA[layerNum];
        if (!data) return;

        // Update active tab styling
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Smooth content swap animation
        if (contentPane) {
          contentPane.style.opacity = '0';
          contentPane.style.transform = 'translateY(6px)';
          contentPane.style.transition = 'opacity 0.18s ease, transform 0.18s ease';

          setTimeout(() => {
            badgeEl.textContent = data.badge;
            titleEl.textContent = data.title;
            descEl.textContent = data.desc;

            // Render tags
            tagsEl.innerHTML = '';
            data.tags.forEach((tagText) => {
              const span = document.createElement('span');
              span.className = 'tech-tag';
              span.textContent = tagText;
              tagsEl.appendChild(span);
            });

            contentPane.style.opacity = '1';
            contentPane.style.transform = 'translateY(0)';
          }, 180);
        }
      });
    });
  }

  // ==========================================================================
  // BENTO GRID CATEGORY FILTERING
  // ==========================================================================
  function initProjectFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const bentoCards = document.querySelectorAll('.bento-card');

    if (!filterButtons.length || !bentoCards.length) return;

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');

        // Toggle active button state
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter cards
        bentoCards.forEach((card) => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });
  }

  // ==========================================================================
  // 1-CLICK EMAIL COPY TO CLIPBOARD WITH FLOATING TOAST
  // ==========================================================================
  function initCopyEmail() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    let toastTimeout = null;

    function showToast(message) {
      if (!toast) return;
      if (toastMsg) toastMsg.textContent = message;
      toast.classList.add('show');

      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 3200);
    }

    copyButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const textToCopy = btn.getAttribute('data-copy') || 'kyrozen1107@gmail.com';

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              showToast(`Copied to clipboard: ${textToCopy}`);
            })
            .catch(() => {
              fallbackCopy(textToCopy);
            });
        } else {
          fallbackCopy(textToCopy);
        }
      });
    });

    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast(`Copied to clipboard: ${text}`);
      } catch (err) {
        showToast(`Direct email: ${text}`);
      }
      document.body.removeChild(textarea);
    }
  }

  // ==========================================================================
  // ACTIVE NAVIGATION DOCK SECTION OBSERVER
  // ==========================================================================
  function initScrollObserver() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('section[id]');

    if (!navItems.length || !sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navItems.forEach((item) => {
              if (item.getAttribute('href') === `#${id}`) {
                item.classList.add('active');
              } else {
                item.classList.remove('active');
              }
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  // ==========================================================================
  // LIGHTWEIGHT HERO BUILD + SCROLL REVEALS
  // ==========================================================================
  function initMotionReveals() {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const heroParts = document.querySelectorAll('.hero-flank, .hero-center-col');
    heroParts.forEach((part) => part.classList.add('hero-build'));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => heroParts.forEach((part) => part.classList.add('is-built')));
    });

    const revealItems = document.querySelectorAll(
      '.section-header, .flagship-card, .subgrid-card, .bento-card, .stack-grid > .glass-card, .about-grid, .contact-card'
    );
    const observer = new IntersectionObserver((entries, revealObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    revealItems.forEach((item) => {
      item.classList.add('reveal-item');
      observer.observe(item);
    });
  }

  // ==========================================================================
  // BOOTSTRAP ALL MODULES ON DOM READY
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initMotionReveals();
    initAuroraCanvas();
    initLayerTabs();
    initProjectFilters();
    initCopyEmail();
    initScrollObserver();
  });

})();